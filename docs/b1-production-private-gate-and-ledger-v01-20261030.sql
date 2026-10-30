-- B-1 production-target PRIVATE gate + append-only publication ledger, v0.2 (M1-M3).
-- REVIEW-ONLY: not applied to any Supabase project. Public release and consent stay OFF.
-- Do NOT execute before independent audit + explicit release process approval.
BEGIN;
CREATE TABLE IF NOT EXISTS rr_private.region_rings_publication_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  publication_enabled boolean NOT NULL DEFAULT false,
  is_dirty boolean NOT NULL DEFAULT true,
  generation bigint NOT NULL DEFAULT 1 CHECK (generation > 0),
  policy_version text NOT NULL DEFAULT 'unapproved',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO rr_private.region_rings_publication_state(singleton)
VALUES (true) ON CONFLICT (singleton) DO NOTHING;

-- Snapshot is private and not sourced from public_candidate by this migration.
-- A separate, audited privacy evaluation must approve any future row.
CREATE TABLE IF NOT EXISTS rr_private.region_rings_approved_year (
  country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  activity_year integer NOT NULL CHECK (activity_year BETWEEN 2000 AND 2200),
  rounded_distance_km numeric NOT NULL CHECK (rounded_distance_km > 0),
  generation bigint NOT NULL CHECK (generation > 0),
  policy_version text NOT NULL,
  approved boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  closed_after timestamptz NOT NULL,
  permanently_suppressed boolean NOT NULL DEFAULT false,
  PRIMARY KEY(country_code, activity_year),
  CHECK (NOT approved OR approved_at IS NOT NULL)
);
-- Block accidental updates to the approved row value once approved.
CREATE OR REPLACE FUNCTION rr_private.b1_prevent_approved_value_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $b1_immutable$
BEGIN
  IF OLD.approved AND (
      NEW.approved IS DISTINCT FROM OLD.approved
      OR (OLD.permanently_suppressed AND NOT NEW.permanently_suppressed)
      OR NEW.rounded_distance_km IS DISTINCT FROM OLD.rounded_distance_km
      OR NEW.generation IS DISTINCT FROM OLD.generation
      OR NEW.policy_version IS DISTINCT FROM OLD.policy_version
      OR NEW.country_code IS DISTINCT FROM OLD.country_code
      OR NEW.activity_year IS DISTINCT FROM OLD.activity_year
      OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
      OR NEW.closed_after IS DISTINCT FROM OLD.closed_after
  ) THEN
    RAISE EXCEPTION 'B-1 approved snapshot is immutable';
  END IF;
  RETURN NEW;
END $b1_immutable$;
DROP TRIGGER IF EXISTS b1_immutable_approved_value ON rr_private.region_rings_approved_year;
CREATE TRIGGER b1_immutable_approved_value
BEFORE UPDATE ON rr_private.region_rings_approved_year
FOR EACH ROW EXECUTE FUNCTION rr_private.b1_prevent_approved_value_mutation();
-- An approved snapshot is evidence; suppress instead of deleting.
CREATE OR REPLACE FUNCTION rr_private.b1_prevent_approved_snapshot_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $b1_del$
BEGIN
  IF OLD.approved THEN
    RAISE EXCEPTION 'B-1 approved snapshot cannot be deleted; suppress it';
  END IF;
  RETURN OLD;
END $b1_del$;
CREATE OR REPLACE FUNCTION rr_private.b1_block_snapshot_truncate()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $b1_snap_trunc$
BEGIN
  RAISE EXCEPTION 'B-1 snapshot TRUNCATE forbidden; suppress rows';
END $b1_snap_trunc$;
DROP TRIGGER IF EXISTS b1_snapshot_no_truncate ON rr_private.region_rings_approved_year;
CREATE TRIGGER b1_snapshot_no_truncate
BEFORE TRUNCATE ON rr_private.region_rings_approved_year
FOR EACH STATEMENT EXECUTE FUNCTION rr_private.b1_block_snapshot_truncate();
DROP TRIGGER IF EXISTS b1_no_approved_delete ON rr_private.region_rings_approved_year;
CREATE TRIGGER b1_no_approved_delete
BEFORE DELETE ON rr_private.region_rings_approved_year
FOR EACH ROW EXECUTE FUNCTION rr_private.b1_prevent_approved_snapshot_delete();


-- Ledger contains sensitive unpublished values: NEVER mirror into repository, logs or web response.
CREATE TABLE IF NOT EXISTS rr_private.region_rings_publication_ledger (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  country_code text NOT NULL,
  activity_year integer NOT NULL,
  generation bigint NOT NULL,
  policy_version text NOT NULL,
  rounded_distance_km numeric,
  action text NOT NULL CHECK (action IN ('approve','start','stop','suppress')),
  CONSTRAINT b1_ledger_value_for_publication CHECK (
    action NOT IN ('approve','start')
    OR (rounded_distance_km IS NOT NULL AND rounded_distance_km > 0)
  ),
  reason text NOT NULL,
  actor_reference text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION rr_private.b1_ledger_append_only()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $b1_ledger$
BEGIN
  RAISE EXCEPTION 'B-1 ledger is append only';
END $b1_ledger$;
DROP TRIGGER IF EXISTS b1_ledger_no_update ON rr_private.region_rings_publication_ledger;
DROP TRIGGER IF EXISTS b1_ledger_no_delete ON rr_private.region_rings_publication_ledger;
DROP TRIGGER IF EXISTS b1_ledger_no_truncate ON rr_private.region_rings_publication_ledger;
CREATE TRIGGER b1_ledger_no_update
  BEFORE UPDATE ON rr_private.region_rings_publication_ledger
  FOR EACH ROW EXECUTE FUNCTION rr_private.b1_ledger_append_only();
CREATE TRIGGER b1_ledger_no_delete
  BEFORE DELETE ON rr_private.region_rings_publication_ledger
  FOR EACH ROW EXECUTE FUNCTION rr_private.b1_ledger_append_only();
CREATE TRIGGER b1_ledger_no_truncate
BEFORE TRUNCATE ON rr_private.region_rings_publication_ledger
FOR EACH STATEMENT EXECUTE FUNCTION rr_private.b1_ledger_append_only();

-- Internal read gate: no public RPC or exposed schema. Locks both gate rows
-- while checking to serialize withdrawal / publication-state invalidation.
CREATE OR REPLACE FUNCTION rr_private.b1_read_approved_year(p_country_code text, p_activity_year integer)
RETURNS TABLE(country_code text, activity_year integer, distance_km numeric)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $b1_read$
DECLARE s rr_private.region_rings_publication_state%ROWTYPE;
        legacy rr_private.region_rings_refresh_state%ROWTYPE;
BEGIN
 SELECT * INTO s FROM rr_private.region_rings_publication_state
  WHERE singleton=true FOR SHARE;
 SELECT * INTO legacy FROM rr_private.region_rings_refresh_state
  WHERE singleton=true FOR SHARE;
 IF NOT FOUND OR s.singleton IS NULL OR NOT s.publication_enabled OR s.is_dirty
   OR legacy.singleton IS NULL OR legacy.is_dirty
   OR s.policy_version='unapproved' THEN
    RETURN;
 END IF;
 RETURN QUERY
 SELECT a.country_code,a.activity_year,a.rounded_distance_km
 FROM rr_private.region_rings_approved_year a
 WHERE a.country_code=p_country_code
   AND a.activity_year=p_activity_year
   AND a.approved AND NOT a.permanently_suppressed
   AND a.policy_version=s.policy_version
   AND a.generation=s.generation
   AND a.closed_after<=statement_timestamp()
   AND a.activity_year < EXTRACT(YEAR FROM (statement_timestamp() AT TIME ZONE 'UTC'))
 LIMIT 1;
END $b1_read$;

-- Fail closed on withdrawal; state remains OFF until a separately audited
-- manual re-approval. Generation only increments once per withdrawal episode.
CREATE OR REPLACE FUNCTION rr_private.b1_private_stop(p_reason text, p_actor_reference text)
RETURNS bigint
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $b1_stop$
DECLARE g bigint;
BEGIN
 IF nullif(btrim(p_reason),'') IS NULL OR nullif(btrim(p_actor_reference),'') IS NULL THEN
   RAISE EXCEPTION 'reason and actor required';
 END IF;
 UPDATE rr_private.region_rings_publication_state
 SET generation=CASE WHEN publication_enabled OR NOT is_dirty THEN generation+1 ELSE generation END,
     publication_enabled=false,is_dirty=true,updated_at=clock_timestamp()
 WHERE singleton=true
 RETURNING generation INTO g;
 IF g IS NULL THEN RAISE EXCEPTION 'publication state is missing'; END IF;
 -- A global stop event is recorded without a fabricated country or published value.
 INSERT INTO rr_private.region_rings_publication_ledger
 (country_code,activity_year,generation,policy_version,action,reason,actor_reference)
 SELECT '--',0,g,policy_version,'stop',p_reason,p_actor_reference
 FROM rr_private.region_rings_publication_state WHERE singleton=true;
 RETURN g;
END $b1_stop$;

-- Default PostgreSQL function EXECUTE is PUBLIC: remove it explicitly.
REVOKE ALL ON FUNCTION rr_private.b1_read_approved_year(text,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rr_private.b1_private_stop(text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rr_private.b1_prevent_approved_value_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rr_private.b1_ledger_append_only() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rr_private.b1_prevent_approved_snapshot_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION rr_private.b1_block_snapshot_truncate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON rr_private.region_rings_publication_state FROM PUBLIC, anon, authenticated;
REVOKE ALL ON rr_private.region_rings_approved_year FROM PUBLIC, anon, authenticated;
REVOKE ALL ON rr_private.region_rings_publication_ledger FROM PUBLIC, anon, authenticated;
ALTER TABLE rr_private.region_rings_publication_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE rr_private.region_rings_approved_year ENABLE ROW LEVEL SECURITY;
ALTER TABLE rr_private.region_rings_publication_ledger ENABLE ROW LEVEL SECURITY;
-- No service-role grants added here: internal server connection/permissions
-- must be reviewed separately; no anonymous access is introduced.
COMMIT;
