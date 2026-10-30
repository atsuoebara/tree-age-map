-- Synthetic-only test against ephemeral PostgreSQL in GitHub Actions.
\set ON_ERROR_STOP on
CREATE SCHEMA rr_private;
CREATE TABLE rr_private.region_rings_refresh_state (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
 is_dirty boolean NOT NULL DEFAULT false,
 publication_enabled boolean NOT NULL DEFAULT false CHECK (publication_enabled=false)
);
INSERT INTO rr_private.region_rings_refresh_state VALUES(true,false,false);
\i docs/b1-production-private-gate-and-ledger-v01-20261030.sql

-- Prove M1: the legacy public flag remains false, yet the new gate can read
-- a specially created synthetic approved year once the review-only state is enabled.
INSERT INTO rr_private.region_rings_approved_year
(country_code,activity_year,rounded_distance_km,generation,policy_version,approved,approved_at,closed_after)
VALUES('JP',2024,1200,1,'v1',true,now(),timestamptz '2025-04-01 00:00+00');
UPDATE rr_private.region_rings_publication_state
 SET publication_enabled=true,is_dirty=false,policy_version='v1' WHERE singleton;
DO $b1_t1$
BEGIN
 IF (SELECT publication_enabled FROM rr_private.region_rings_refresh_state) THEN
  RAISE EXCEPTION 'legacy fixture must never allow publication';
 END IF;
 IF (SELECT distance_km FROM rr_private.b1_read_approved_year('JP',2024)) IS DISTINCT FROM 1200 THEN
  RAISE EXCEPTION 'M1: valid synthetic read blocked by legacy publication OFF';
 END IF;
END $b1_t1$;
\echo 'B1_M1_VALID_READ_WITH_LEGACY_OFF_PASS'

-- M2 approved snapshot data and approval evidence can never be changed/deleted.
DO $b1_t2$
DECLARE rejected boolean;
BEGIN
 rejected:=false;
 BEGIN
  UPDATE rr_private.region_rings_approved_year SET approved=false WHERE country_code='JP' AND activity_year=2024;
 EXCEPTION WHEN raise_exception THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'approved=false bypass'; END IF;
 rejected:=false;
 BEGIN
  UPDATE rr_private.region_rings_approved_year SET approved_at=now()+interval '1 day' WHERE country_code='JP' AND activity_year=2024;
 EXCEPTION WHEN raise_exception THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'approved_at change bypass'; END IF;
 rejected:=false;
 BEGIN
  UPDATE rr_private.region_rings_approved_year SET closed_after=now()+interval '1 day' WHERE country_code='JP' AND activity_year=2024;
 EXCEPTION WHEN raise_exception THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'closed_after change bypass'; END IF;
 rejected:=false;
 BEGIN
  DELETE FROM rr_private.region_rings_approved_year WHERE country_code='JP' AND activity_year=2024;
 EXCEPTION WHEN raise_exception THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'approved row DELETE bypass'; END IF;
 rejected:=false;
 BEGIN
  TRUNCATE rr_private.region_rings_approved_year;
 EXCEPTION WHEN raise_exception THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'snapshot TRUNCATE bypass'; END IF;
 UPDATE rr_private.region_rings_approved_year SET permanently_suppressed=true WHERE country_code='JP' AND activity_year=2024;
 rejected:=false;
 BEGIN
  UPDATE rr_private.region_rings_approved_year SET permanently_suppressed=false WHERE country_code='JP' AND activity_year=2024;
 EXCEPTION WHEN raise_exception THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'suppression reversal bypass'; END IF;
 IF EXISTS (SELECT 1 FROM rr_private.b1_read_approved_year('JP',2024)) THEN
  RAISE EXCEPTION 'suppressed row was published';
 END IF;
END $b1_t2$;
\echo 'B1_M2_APPROVED_SNAPSHOT_IMMUTABLE_PASS'

-- M3 approval/start ledger action requires positive publication value.
DO $b1_t3$
DECLARE action_name text; rejected boolean;
BEGIN
 FOREACH action_name IN ARRAY ARRAY['approve','start'] LOOP
  rejected:=false;
  BEGIN
   INSERT INTO rr_private.region_rings_publication_ledger
     (country_code,activity_year,generation,policy_version,action,reason,actor_reference)
   VALUES ('JP',2024,1,'v1',action_name,'synthetic','test-only');
  EXCEPTION WHEN check_violation THEN rejected:=true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'M3 missing value accepted for %',action_name; END IF;
 END LOOP;
 INSERT INTO rr_private.region_rings_publication_ledger
 (country_code,activity_year,generation,policy_version,rounded_distance_km,action,reason,actor_reference)
 VALUES ('JP',2024,1,'v1',1200,'approve','synthetic','test-only');
END $b1_t3$;
\echo 'B1_M3_PUBLICATION_VALUE_REQUIRED_PASS'

-- Ledger UPDATE/DELETE/TRUNCATE are all forbidden.
DO $b1_t4$
DECLARE rejected boolean;
BEGIN
 rejected:=false;
 BEGIN
  UPDATE rr_private.region_rings_publication_ledger SET reason='changed';
 EXCEPTION WHEN raise_exception THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'ledger UPDATE bypass'; END IF;
 rejected:=false;
 BEGIN
  DELETE FROM rr_private.region_rings_publication_ledger;
 EXCEPTION WHEN raise_exception THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'ledger DELETE bypass'; END IF;
 rejected:=false;
 BEGIN
  TRUNCATE rr_private.region_rings_publication_ledger;
 EXCEPTION WHEN raise_exception THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'ledger TRUNCATE bypass'; END IF;
END $b1_t4$;
\echo 'B1_M2_LEDGER_APPEND_ONLY_PASS'

-- Legacy trigger dirty must close the new read, even with gate ON.
UPDATE rr_private.region_rings_approved_year SET permanently_suppressed=true WHERE country_code='JP' AND activity_year=2024;
UPDATE rr_private.region_rings_refresh_state SET is_dirty=true WHERE singleton;
DO $b1_t5$
BEGIN
 IF EXISTS(SELECT 1 FROM rr_private.b1_read_approved_year('JP',2024)) THEN
  RAISE EXCEPTION 'legacy dirty gate leaked';
 END IF;
END $b1_t5$;
\echo 'B1_LEGACY_DIRTY_FAIL_CLOSED_PASS'

-- Global stop is atomic, does not re-increment generation on retry, and logs both attempts.
SELECT rr_private.b1_private_stop('test global stop','isolated runner') AS first_generation \gset
SELECT rr_private.b1_private_stop('test global stop repeat','isolated runner') AS second_generation \gset
DO $b1_t6$
BEGIN
 IF :first_generation <> 2 OR :second_generation <> 2 THEN
   RAISE EXCEPTION 'global stop not idempotent';
 END IF;
 IF EXISTS(SELECT 1 FROM rr_private.b1_read_approved_year('JP',2024)) THEN
   RAISE EXCEPTION 'global stop leaked';
 END IF;
 IF (SELECT count(*) FROM rr_private.region_rings_publication_ledger WHERE action='stop') <> 2 THEN
   RAISE EXCEPTION 'missing global stop audit event';
 END IF;
END $b1_t6$;
\echo 'B1_STOP_LEDGER_AND_IDEMPOTENCE_PASS'

-- Prove permission is not accidentally granted to exposed roles.
SELECT CASE WHEN has_function_privilege('anon','rr_private.b1_read_approved_year(text,integer)','EXECUTE')
 OR has_function_privilege('authenticated','rr_private.b1_read_approved_year(text,integer)','EXECUTE')
 THEN 'FAIL' ELSE 'PASS' END AS permissions \gset
\if :{?permissions}
\endif
\echo 'B1_PRIVATE_GATE_ISOLATED_COMPLETE'
