-- Isolated PostgreSQL 16 account/connection/run deletion ordering model.
-- TEST ONLY: never apply to production or touch real auth.users.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA probe_delete_order;
CREATE TABLE probe_delete_order.users(id uuid PRIMARY KEY);
CREATE TABLE probe_delete_order.connections(
 user_id uuid PRIMARY KEY REFERENCES probe_delete_order.users(id) ON DELETE CASCADE,
 version uuid NOT NULL, enabled boolean NOT NULL
);
CREATE TABLE probe_delete_order.inbox(
 id bigint PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES probe_delete_order.users(id) ON DELETE CASCADE
);
CREATE TABLE probe_delete_order.runs(
 id bigint PRIMARY KEY,
 user_id uuid NULL REFERENCES probe_delete_order.users(id),
 deleted_at timestamptz
);
CREATE UNIQUE INDEX run_owner_for_probe_ci ON probe_delete_order.runs(id,user_id);
CREATE TABLE probe_delete_order.probe_results(
 run_id bigint PRIMARY KEY,
 user_id uuid NOT NULL,
 counts jsonb NOT NULL,
 FOREIGN KEY(run_id,user_id) REFERENCES probe_delete_order.runs(id,user_id) ON DELETE CASCADE
);
CREATE FUNCTION probe_delete_order.purge_connection() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' OR NOT NEW.enabled OR NEW.version IS DISTINCT FROM OLD.version THEN
  DELETE FROM probe_delete_order.probe_results WHERE user_id=OLD.user_id;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER on_connection_change
BEFORE DELETE OR UPDATE OF enabled,version ON probe_delete_order.connections
FOR EACH ROW EXECUTE FUNCTION probe_delete_order.purge_connection();
CREATE FUNCTION probe_delete_order.purge_run() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS DISTINCT FROM NEW.deleted_at THEN
  DELETE FROM probe_delete_order.probe_results WHERE run_id=NEW.id AND user_id=NEW.user_id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER on_run_soft_delete AFTER UPDATE OF deleted_at ON probe_delete_order.runs
FOR EACH ROW EXECUTE FUNCTION probe_delete_order.purge_run();

INSERT INTO probe_delete_order.users VALUES
('00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-0000000000b2');
INSERT INTO probe_delete_order.connections VALUES
('00000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-000000000001',true),
('00000000-0000-0000-0000-0000000000b2','20000000-0000-0000-0000-000000000002',true);
INSERT INTO probe_delete_order.inbox VALUES
(1,'00000000-0000-0000-0000-0000000000a1'),
(2,'00000000-0000-0000-0000-0000000000b2');
INSERT INTO probe_delete_order.runs VALUES
(101,'00000000-0000-0000-0000-0000000000a1',NULL),
(102,'00000000-0000-0000-0000-0000000000a1',NULL),
(201,'00000000-0000-0000-0000-0000000000b2',NULL);
INSERT INTO probe_delete_order.probe_results VALUES
(101,'00000000-0000-0000-0000-0000000000a1','{"sampleCount":10}'),
(102,'00000000-0000-0000-0000-0000000000a1','{"sampleCount":11}'),
(201,'00000000-0000-0000-0000-0000000000b2','{"sampleCount":12}');
-- Disconnect must purge account A's probe data; existing runs remain.
UPDATE probe_delete_order.connections SET enabled=false WHERE user_id='00000000-0000-0000-0000-0000000000a1';
DO $$BEGIN
 IF EXISTS(SELECT 1 FROM probe_delete_order.probe_results WHERE user_id='00000000-0000-0000-0000-0000000000a1')
 OR (SELECT count(*) FROM probe_delete_order.runs WHERE user_id='00000000-0000-0000-0000-0000000000a1')<>2
 OR (SELECT count(*) FROM probe_delete_order.probe_results WHERE user_id='00000000-0000-0000-0000-0000000000b2')<>1
 THEN RAISE EXCEPTION 'disconnect deleted wrong records'; END IF;
END $$;
-- Deleting auth user A while its runs exist must fail (real runs FK has NO ACTION).
DO $$BEGIN
 BEGIN
  DELETE FROM probe_delete_order.users WHERE id='00000000-0000-0000-0000-0000000000a1';
  RAISE EXCEPTION 'unexpected_account_delete';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END $$;
DO $$BEGIN
 IF (SELECT count(*) FROM probe_delete_order.connections)<>2
 OR (SELECT count(*) FROM probe_delete_order.inbox)<>2
 OR (SELECT count(*) FROM probe_delete_order.users)<>2
 THEN RAISE EXCEPTION 'failed deletion was not rolled back'; END IF;
END $$;
-- First purge account A's runs (and probe rows by FK), then auth-user delete succeeds;
-- connection and inbox cascade, while B is untouched.
DELETE FROM probe_delete_order.runs WHERE user_id='00000000-0000-0000-0000-0000000000a1';
DELETE FROM probe_delete_order.users WHERE id='00000000-0000-0000-0000-0000000000a1';
DO $$BEGIN
 IF EXISTS(SELECT 1 FROM probe_delete_order.users WHERE id='00000000-0000-0000-0000-0000000000a1')
 OR EXISTS(SELECT 1 FROM probe_delete_order.connections WHERE user_id='00000000-0000-0000-0000-0000000000a1')
 OR EXISTS(SELECT 1 FROM probe_delete_order.inbox WHERE user_id='00000000-0000-0000-0000-0000000000a1')
 OR EXISTS(SELECT 1 FROM probe_delete_order.runs WHERE user_id='00000000-0000-0000-0000-0000000000a1')
 OR (SELECT count(*) FROM probe_delete_order.users)<>1
 OR (SELECT count(*) FROM probe_delete_order.runs WHERE user_id='00000000-0000-0000-0000-0000000000b2')<>1
 OR (SELECT count(*) FROM probe_delete_order.probe_results WHERE user_id='00000000-0000-0000-0000-0000000000b2')<>1
 THEN RAISE EXCEPTION 'account deletion affected another user or left records'; END IF;
END $$;
ROLLBACK;
\echo 'CI-only deletion order: disconnect retains runs; auth deletion blocks; staged run delete then auth delete passes'
