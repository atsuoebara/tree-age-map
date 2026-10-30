-- Synthetic-only test against ephemeral PostgreSQL in GitHub Actions.
\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA rr_private;
CREATE TABLE rr_private.region_rings_refresh_state (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
 is_dirty boolean NOT NULL DEFAULT false,
 publication_enabled boolean NOT NULL DEFAULT false CHECK (publication_enabled=false)
);
INSERT INTO rr_private.region_rings_refresh_state VALUES(true,false,false);
\i docs/b1-production-private-gate-and-ledger-v01-20261030.sql
\i docs/b1-private-approval-start-v01-20261030.sql

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

-- Independent M1/M2 proof: a *different, unsuppressed* cell must first
-- return a value, then legacy dirty alone must close it.
INSERT INTO rr_private.region_rings_approved_year
(country_code,activity_year,rounded_distance_km,generation,policy_version,approved,approved_at,closed_after)
VALUES('US',2024,900,1,'v1',true,now(),timestamptz '2025-04-01 00:00+00');
DO $b1_t5_before$
BEGIN
 IF (SELECT distance_km FROM rr_private.b1_read_approved_year('US',2024)) IS DISTINCT FROM 900 THEN
   RAISE EXCEPTION 'dirty precondition: unsuppressed synthetic cell must be visible';
 END IF;
END $b1_t5_before$;
\echo 'B1_LEGACY_DIRTY_BASELINE_VISIBLE_PASS'
UPDATE rr_private.region_rings_refresh_state SET is_dirty=true WHERE singleton;
DO $b1_t5$
BEGIN
 IF (SELECT publication_enabled FROM rr_private.region_rings_publication_state WHERE singleton) IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'dirty test accidentally disabled new gate';
 END IF;
 IF (SELECT permanently_suppressed FROM rr_private.region_rings_approved_year WHERE country_code='US' AND activity_year=2024) IS DISTINCT FROM false THEN
  RAISE EXCEPTION 'dirty test accidentally suppressed cell';
 END IF;
 IF EXISTS(SELECT 1 FROM rr_private.b1_read_approved_year('US',2024)) THEN
  RAISE EXCEPTION 'legacy dirty gate leaked unsuppressed cell';
 END IF;
END $b1_t5$;
\echo 'B1_LEGACY_DIRTY_FAIL_CLOSED_PASS'

-- Global stop is atomic, does not re-increment generation on retry, and logs both attempts.
SELECT rr_private.b1_private_stop('test global stop','isolated runner');
SELECT rr_private.b1_private_stop('test global stop repeat','isolated runner');
DO $b1_t6$
BEGIN
 IF (SELECT generation FROM rr_private.region_rings_publication_state WHERE singleton) <> 2 THEN
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
DO $b1_perm$
BEGIN
 IF has_function_privilege('anon','rr_private.b1_read_approved_year(text,integer)','EXECUTE')
 OR has_function_privilege('authenticated','rr_private.b1_read_approved_year(text,integer)','EXECUTE')
 OR has_table_privilege('anon','rr_private.region_rings_publication_ledger','SELECT')
 THEN RAISE EXCEPTION 'public roles unexpectedly granted privileges'; END IF;
END $b1_perm$;
\echo 'B1_PRIVATE_ROLES_DENIED_PASS'
-- Full synthetic lifecycle: no review -> no approval; review -> approve but still OFF;
-- start only with a current reviewed value; stop invalidates without replay.
UPDATE rr_private.region_rings_approved_year SET permanently_suppressed=true
 WHERE country_code='US' AND activity_year=2024;
UPDATE rr_private.region_rings_refresh_state SET is_dirty=false WHERE singleton;
UPDATE rr_private.region_rings_publication_state
 SET policy_version='v2', publication_enabled=false,is_dirty=true
 WHERE singleton;
DO $b1_lifecycle0$
BEGIN
 IF rr_private.b1_private_approve_year('JP',2023,'synthetic operator') THEN
  RAISE EXCEPTION 'approval without external privacy review';
 END IF;
 IF rr_private.b1_private_start('synthetic operator') THEN
  RAISE EXCEPTION 'start without approved cell';
 END IF;
END $b1_lifecycle0$;
\echo 'B1_NO_REVIEW_NO_RELEASE_PASS'
INSERT INTO rr_private.region_rings_release_decision
(country_code,activity_year,generation,policy_version,rounded_distance_km,closed_after,
 privacy_review_ref,consent_review_ref,reviewed_by,reviewed_at,accepted)
VALUES('JP',2023,2,'v2',600,timestamptz '2024-04-01 00:00+00',
 'synthetic-privacy-review','synthetic-consent-review','isolated reviewer',now(),true);
DO $b1_lifecycle1$
BEGIN
 IF NOT rr_private.b1_private_approve_year('JP',2023,'synthetic operator') THEN
  RAISE EXCEPTION 'reviewed current-generation approval rejected';
 END IF;
 IF EXISTS(SELECT 1 FROM rr_private.b1_read_approved_year('JP',2023)) THEN
  RAISE EXCEPTION 'approval accidentally started delivery';
 END IF;
 IF rr_private.b1_private_approve_year('JP',2023,'synthetic operator') THEN
  RAISE EXCEPTION 'duplicate approval unexpectedly accepted';
 END IF;
 IF NOT rr_private.b1_private_start('synthetic operator') THEN
  RAISE EXCEPTION 'reviewed release start failed';
 END IF;
 IF (SELECT distance_km FROM rr_private.b1_read_approved_year('JP',2023)) IS DISTINCT FROM 600 THEN
  RAISE EXCEPTION 'approved private gate did not return synthetic value';
 END IF;
END $b1_lifecycle1$;
\echo 'B1_APPROVE_THEN_START_PASS'
SELECT rr_private.b1_private_stop('lifecycle revocation','isolated test') AS revoked_generation;
DO $b1_lifecycle2$
BEGIN
 IF EXISTS(SELECT 1 FROM rr_private.b1_read_approved_year('JP',2023)) THEN
  RAISE EXCEPTION 'revoked publication still readable';
 END IF;
 IF rr_private.b1_private_start('synthetic operator') THEN
  RAISE EXCEPTION 'stale accepted review restarted a stopped generation';
 END IF;
 IF rr_private.b1_private_approve_year('JP',2023,'synthetic operator') THEN
  RAISE EXCEPTION 'old generation reapproval succeeded after revocation';
 END IF;
 IF (SELECT count(*) FROM rr_private.region_rings_publication_ledger
     WHERE country_code='JP' AND activity_year=2023 AND action='start') <> 1 THEN
  RAISE EXCEPTION 'missing single publication start audit event';
 END IF;
END $b1_lifecycle2$;
\echo 'B1_REVOKE_STALE_APPROVAL_BLOCKED_PASS'
\echo 'B1_PRIVATE_GATE_ISOLATED_COMPLETE'
