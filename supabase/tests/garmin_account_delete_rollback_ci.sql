-- CI ONLY: account deletion rollback and safe retry in isolated PostgreSQL.
-- Synthetic identifiers. No real Supabase auth, Garmin push or user data.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA probe_rollback;
CREATE TABLE probe_rollback.users (id uuid PRIMARY KEY);
CREATE TABLE probe_rollback.connections (
 user_id uuid PRIMARY KEY REFERENCES probe_rollback.users(id) ON DELETE CASCADE,
 enabled boolean NOT NULL DEFAULT true
);
CREATE TABLE probe_rollback.inbox (
 id bigint PRIMARY KEY, user_id uuid NOT NULL REFERENCES probe_rollback.users(id) ON DELETE CASCADE
);
-- This copies the production 'runs.user_id REFERENCES auth.users(id)' NO ACTION rule.
CREATE TABLE probe_rollback.runs (
 id bigint PRIMARY KEY, user_id uuid REFERENCES probe_rollback.users(id),
 deleted_at timestamptz
);
CREATE TABLE probe_rollback.results (
 run_id bigint PRIMARY KEY REFERENCES probe_rollback.runs(id) ON DELETE CASCADE,
 user_id uuid NOT NULL,
 counts jsonb NOT NULL
);
CREATE FUNCTION probe_rollback.purge_on_disconnect() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' OR NOT NEW.enabled THEN
  DELETE FROM probe_rollback.results WHERE user_id=OLD.user_id;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER purge_disconnected
BEFORE DELETE OR UPDATE OF enabled ON probe_rollback.connections
FOR EACH ROW EXECUTE FUNCTION probe_rollback.purge_on_disconnect();

INSERT INTO probe_rollback.users VALUES
 ('00000000-0000-0000-0000-0000000000a1'),
 ('00000000-0000-0000-0000-0000000000b2');
INSERT INTO probe_rollback.connections VALUES
 ('00000000-0000-0000-0000-0000000000a1',true),
 ('00000000-0000-0000-0000-0000000000b2',true);
INSERT INTO probe_rollback.inbox VALUES
 (1001,'00000000-0000-0000-0000-0000000000a1'),
 (1002,'00000000-0000-0000-0000-0000000000b2');
INSERT INTO probe_rollback.runs VALUES
 (101,'00000000-0000-0000-0000-0000000000a1',NULL),
 (102,'00000000-0000-0000-0000-0000000000a1',NULL),
 (201,'00000000-0000-0000-0000-0000000000b2',NULL);
INSERT INTO probe_rollback.results VALUES
 (101,'00000000-0000-0000-0000-0000000000a1','{"sampleCount":1}'),
 (102,'00000000-0000-0000-0000-0000000000a1','{"sampleCount":2}'),
 (201,'00000000-0000-0000-0000-0000000000b2','{"sampleCount":3}');

-- Case A: explicit transaction SAVEPOINT rollback after deleting runs and connections.
SAVEPOINT before_cleanup;
DELETE FROM probe_rollback.runs WHERE user_id='00000000-0000-0000-0000-0000000000a1';
DELETE FROM probe_rollback.connections WHERE user_id='00000000-0000-0000-0000-0000000000a1';
-- Simulated external step failure: a still-owned inbox/user remains.
ROLLBACK TO SAVEPOINT before_cleanup;
DO $$ BEGIN
 IF (SELECT count(*) FROM probe_rollback.runs WHERE user_id='00000000-0000-0000-0000-0000000000a1')<>2
 OR (SELECT count(*) FROM probe_rollback.results WHERE user_id='00000000-0000-0000-0000-0000000000a1')<>2
 OR (SELECT count(*) FROM probe_rollback.connections WHERE user_id='00000000-0000-0000-0000-0000000000a1')<>1
 THEN RAISE EXCEPTION 'savepoint rollback left partial deletion'; END IF;
END $$;

-- Case B: a runtime failure after destructive work rolls back its PL/pgSQL subtransaction.
DO $$
DECLARE trapped boolean:=false;
BEGIN
 BEGIN
  DELETE FROM probe_rollback.runs WHERE user_id='00000000-0000-0000-0000-0000000000a1';
  DELETE FROM probe_rollback.connections WHERE user_id='00000000-0000-0000-0000-0000000000a1';
  RAISE EXCEPTION 'synthetic_failure_after_deletes';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'synthetic_failure_after_deletes' THEN RAISE; END IF;
  trapped:=true;
 END;
 IF NOT trapped THEN RAISE EXCEPTION 'injected fault not trapped'; END IF;
 IF (SELECT count(*) FROM probe_rollback.runs WHERE user_id='00000000-0000-0000-0000-0000000000a1')<>2
 OR (SELECT count(*) FROM probe_rollback.results WHERE user_id='00000000-0000-0000-0000-0000000000a1')<>2
 OR (SELECT count(*) FROM probe_rollback.connections WHERE user_id='00000000-0000-0000-0000-0000000000a1')<>1
 THEN RAISE EXCEPTION 'subtransaction failed to restore records'; END IF;
END $$;

-- Case C: deleting auth user before runs is blocked, and the attempted cascade
-- of connection/inbox is undone by statement rollback.
DO $$
BEGIN
 BEGIN
  DELETE FROM probe_rollback.users WHERE id='00000000-0000-0000-0000-0000000000a1';
  RAISE EXCEPTION 'unexpected_auth_delete';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 IF (SELECT count(*) FROM probe_rollback.inbox WHERE user_id='00000000-0000-0000-0000-0000000000a1')<>1
 OR (SELECT count(*) FROM probe_rollback.connections WHERE user_id='00000000-0000-0000-0000-0000000000a1')<>1
 OR (SELECT count(*) FROM probe_rollback.results WHERE user_id='00000000-0000-0000-0000-0000000000a1')<>2
 THEN RAISE EXCEPTION 'failed auth deletion left partial cascade'; END IF;
END $$;

-- Case D: correct retry of local work in ONE transaction succeeds, other owner untouched.
DELETE FROM probe_rollback.runs WHERE user_id='00000000-0000-0000-0000-0000000000a1';
DELETE FROM probe_rollback.users WHERE id='00000000-0000-0000-0000-0000000000a1';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM probe_rollback.users WHERE id='00000000-0000-0000-0000-0000000000a1')
 OR EXISTS(SELECT 1 FROM probe_rollback.connections WHERE user_id='00000000-0000-0000-0000-0000000000a1')
 OR EXISTS(SELECT 1 FROM probe_rollback.inbox WHERE user_id='00000000-0000-0000-0000-0000000000a1')
 OR EXISTS(SELECT 1 FROM probe_rollback.runs WHERE user_id='00000000-0000-0000-0000-0000000000a1')
 OR EXISTS(SELECT 1 FROM probe_rollback.results WHERE user_id='00000000-0000-0000-0000-0000000000a1')
 OR (SELECT count(*) FROM probe_rollback.users)<>1
 OR (SELECT count(*) FROM probe_rollback.runs WHERE user_id='00000000-0000-0000-0000-0000000000b2')<>1
 OR (SELECT count(*) FROM probe_rollback.results WHERE user_id='00000000-0000-0000-0000-0000000000b2')<>1
 THEN RAISE EXCEPTION 'retry did not preserve boundaries'; END IF;
END $$;
ROLLBACK;
\echo 'CI-only account cleanup: savepoint/fault rollback, FK failure and atomic retry PASS'
