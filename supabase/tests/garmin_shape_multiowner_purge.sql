-- CI ONLY. Isolated PostgreSQL fixture; NOT a production migration.
-- Verify owner/run isolation and generation fencing across multiple accounts.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA probe_scope;
CREATE TABLE probe_scope.connection (
  owner_ref text PRIMARY KEY,
  generation text NOT NULL,
  import_enabled boolean NOT NULL DEFAULT true,
  export_allowed boolean NOT NULL DEFAULT true
);
CREATE TABLE probe_scope.run (
  run_ref text PRIMARY KEY,
  owner_ref text NOT NULL REFERENCES probe_scope.connection(owner_ref) ON DELETE CASCADE,
  deleted_at timestamptz,
  UNIQUE(run_ref,owner_ref)
);
CREATE TABLE probe_scope.probe (
  run_ref text PRIMARY KEY,
  owner_ref text NOT NULL,
  generation text NOT NULL,
  counts jsonb NOT NULL,
  FOREIGN KEY(run_ref,owner_ref) REFERENCES probe_scope.run(run_ref,owner_ref) ON DELETE CASCADE,
  CHECK (jsonb_typeof(counts)='object')
);
CREATE FUNCTION probe_scope.check_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM probe_scope.connection c
    JOIN probe_scope.run r ON r.owner_ref=c.owner_ref
    WHERE r.run_ref=NEW.run_ref AND r.owner_ref=NEW.owner_ref
      AND r.deleted_at IS NULL AND c.generation=NEW.generation
      AND c.import_enabled AND c.export_allowed
  ) THEN
    RAISE EXCEPTION 'stale_or_unowned_probe';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER verify_probe BEFORE INSERT OR UPDATE ON probe_scope.probe
FOR EACH ROW EXECUTE FUNCTION probe_scope.check_insert();
CREATE FUNCTION probe_scope.on_connection_change() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    DELETE FROM probe_scope.probe WHERE owner_ref=OLD.owner_ref;
    RETURN OLD;
  END IF;
  IF NEW.generation IS DISTINCT FROM OLD.generation
    OR NOT NEW.import_enabled OR NOT NEW.export_allowed THEN
    DELETE FROM probe_scope.probe WHERE owner_ref=OLD.owner_ref;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER purge_connection
BEFORE UPDATE OF generation,import_enabled,export_allowed OR DELETE
ON probe_scope.connection FOR EACH ROW EXECUTE FUNCTION probe_scope.on_connection_change();
CREATE FUNCTION probe_scope.on_run_soft_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS DISTINCT FROM NEW.deleted_at THEN
    DELETE FROM probe_scope.probe WHERE run_ref=NEW.run_ref AND owner_ref=NEW.owner_ref;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER purge_run_soft_delete AFTER UPDATE OF deleted_at ON probe_scope.run
FOR EACH ROW EXECUTE FUNCTION probe_scope.on_run_soft_delete();

-- Three distinct owners; each has two runs, all with saved synthetic counts.
INSERT INTO probe_scope.connection(owner_ref,generation) VALUES ('owner-A','gen-A1'),('owner-B','gen-B1'),('owner-C','gen-C1');
INSERT INTO probe_scope.run(run_ref,owner_ref) VALUES
('A1','owner-A'),('A2','owner-A'),('B1','owner-B'),('B2','owner-B'),('C1','owner-C'),('C2','owner-C');
INSERT INTO probe_scope.probe(run_ref,owner_ref,generation,counts)
SELECT r.run_ref,r.owner_ref,c.generation,'{"activityCount":1,"sampleCount":8}'::jsonb
FROM probe_scope.run r JOIN probe_scope.connection c USING(owner_ref);

DO $$BEGIN
 IF (SELECT count(*) FROM probe_scope.probe)<>6 THEN RAISE EXCEPTION 'initial rows'; END IF;
END $$;
-- A soft-deletes one run: A2 and every B/C run must remain untouched.
UPDATE probe_scope.run SET deleted_at=clock_timestamp() WHERE run_ref='A1';
DO $$BEGIN
 IF (SELECT count(*) FROM probe_scope.probe)<>5
 OR (SELECT count(*) FROM probe_scope.probe WHERE owner_ref='owner-A')<>1
 OR (SELECT count(*) FROM probe_scope.probe WHERE owner_ref IN ('owner-B','owner-C'))<>4
 THEN RAISE EXCEPTION 'cross run/owner purge'; END IF;
END $$;
-- A re-links Garmin: stale A1 generation is deleted, new generation may register new valid run.
UPDATE probe_scope.connection SET generation='gen-A2' WHERE owner_ref='owner-A';
DO $$BEGIN
 IF (SELECT count(*) FROM probe_scope.probe)<>4
 OR EXISTS(SELECT 1 FROM probe_scope.probe WHERE owner_ref='owner-A')
 THEN RAISE EXCEPTION 'generation isolation'; END IF;
END $$;
INSERT INTO probe_scope.run(run_ref,owner_ref) VALUES ('A3','owner-A');
INSERT INTO probe_scope.probe VALUES('A3','owner-A','gen-A2','{"activityCount":1,"sampleCount":10}');
-- Attempt to attach A3 to another owner is refused by composite FK.
DO $$BEGIN
 BEGIN
  INSERT INTO probe_scope.probe VALUES('A2','owner-B','gen-B1','{}');
  RAISE EXCEPTION 'test unexpectedly accepted cross-owner';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
  WHEN raise_exception THEN
   IF SQLERRM <> 'stale_or_unowned_probe' THEN RAISE; END IF;
  END;
 BEGIN
  INSERT INTO probe_scope.probe VALUES('A2','owner-A','gen-A1','{}');
  RAISE EXCEPTION 'test unexpectedly accepted stale generation';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'stale_or_unowned_probe' THEN RAISE; END IF;
 END;
 BEGIN
  INSERT INTO probe_scope.probe VALUES('A1','owner-A','gen-A2','{}');
  RAISE EXCEPTION 'test unexpectedly accepted deleted run';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'stale_or_unowned_probe' THEN RAISE; END IF;
 END;
END $$;
-- B disconnect: B's two runs and probes removed; A3 and C preserved.
DELETE FROM probe_scope.connection WHERE owner_ref='owner-B';
DO $$BEGIN
 IF EXISTS(SELECT 1 FROM probe_scope.probe WHERE owner_ref='owner-B')
 OR (SELECT count(*) FROM probe_scope.probe)<>3
 OR NOT EXISTS(SELECT 1 FROM probe_scope.probe WHERE run_ref='A3')
 OR (SELECT count(*) FROM probe_scope.probe WHERE owner_ref='owner-C')<>2
 THEN RAISE EXCEPTION 'disconnect contaminated other owners'; END IF;
END $$;
-- C loses export permission: C's two results removed but A3 remains.
UPDATE probe_scope.connection SET export_allowed=false WHERE owner_ref='owner-C';
DO $$BEGIN
 IF (SELECT count(*) FROM probe_scope.probe)<>1
 OR (SELECT run_ref FROM probe_scope.probe LIMIT 1)<>'A3'
 THEN RAISE EXCEPTION 'permission purge contaminated owner A'; END IF;
END $$;
-- Physical deletion of a single A3 removes its result without changing other run records.
DELETE FROM probe_scope.run WHERE run_ref='A3';
DO $$BEGIN
 IF EXISTS(SELECT 1 FROM probe_scope.probe)
 OR (SELECT count(*) FROM probe_scope.run WHERE owner_ref='owner-A')<>2
 THEN RAISE EXCEPTION 'physical delete did not isolate run'; END IF;
END $$;
ROLLBACK;
\echo 'Multi-owner/multi-run purge isolation and generation fencing PASS (CI-only)'
