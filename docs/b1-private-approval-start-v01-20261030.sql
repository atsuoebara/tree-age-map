-- B-1 private approval and start workflow, draft v0.1. ISOLATED REVIEW ONLY.
-- This SQL is NEVER applied to production by CI. No public Edge endpoint or consent collection.
-- Requires docs/b1-production-private-gate-and-ledger-v01-20261030.sql installed first.
BEGIN;
-- Auditors must supply an already-reviewed, sealed decision in this private table.
-- No function in this file creates or marks decisions reviewed.
CREATE TABLE IF NOT EXISTS rr_private.region_rings_release_decision (
 country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
 activity_year integer NOT NULL CHECK (activity_year BETWEEN 2000 AND 2200),
 generation bigint NOT NULL CHECK (generation>0),
 policy_version text NOT NULL CHECK (policy_version <> 'unapproved'),
 rounded_distance_km numeric NOT NULL CHECK (rounded_distance_km>0),
 closed_after timestamptz NOT NULL,
 privacy_review_ref text NOT NULL CHECK(length(btrim(privacy_review_ref))>0),
 consent_review_ref text NOT NULL CHECK(length(btrim(consent_review_ref))>0),
 reviewed_by text NOT NULL CHECK(length(btrim(reviewed_by))>0),
 reviewed_at timestamptz NOT NULL,
 accepted boolean NOT NULL DEFAULT false,
 PRIMARY KEY (country_code,activity_year,generation)
);
-- Release decisions are private, append-only; corrections require new review and
-- an explicitly designed new lifecycle, not silent replacement.
CREATE OR REPLACE FUNCTION rr_private.b1_block_release_decision_change()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $b1_decision_trigger$
BEGIN
 RAISE EXCEPTION 'B-1 release decision immutable';
END $b1_decision_trigger$;
DROP TRIGGER IF EXISTS b1_decision_no_update ON rr_private.region_rings_release_decision;
DROP TRIGGER IF EXISTS b1_decision_no_delete ON rr_private.region_rings_release_decision;
DROP TRIGGER IF EXISTS b1_decision_no_truncate ON rr_private.region_rings_release_decision;
CREATE TRIGGER b1_decision_no_update BEFORE UPDATE ON rr_private.region_rings_release_decision
 FOR EACH ROW EXECUTE FUNCTION rr_private.b1_block_release_decision_change();
CREATE TRIGGER b1_decision_no_delete BEFORE DELETE ON rr_private.region_rings_release_decision
 FOR EACH ROW EXECUTE FUNCTION rr_private.b1_block_release_decision_change();
CREATE TRIGGER b1_decision_no_truncate BEFORE TRUNCATE ON rr_private.region_rings_release_decision
 FOR EACH STATEMENT EXECUTE FUNCTION rr_private.b1_block_release_decision_change();

-- Approve only a reviewed decision, while state remains OFF. This cannot
-- generate values and cannot open the gate. Locking serializes a global stop.
CREATE OR REPLACE FUNCTION rr_private.b1_private_approve_year(
 p_country_code text,p_activity_year integer,p_actor_reference text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $b1_approve$
DECLARE s rr_private.region_rings_publication_state%ROWTYPE;
        legacy rr_private.region_rings_refresh_state%ROWTYPE;
        d rr_private.region_rings_release_decision%ROWTYPE;
BEGIN
 IF nullif(btrim(p_actor_reference),'') IS NULL THEN RAISE EXCEPTION 'actor required'; END IF;
 SELECT * INTO s FROM rr_private.region_rings_publication_state WHERE singleton FOR UPDATE;
 IF NOT FOUND OR s.publication_enabled OR s.policy_version='unapproved' THEN RETURN false; END IF;
 SELECT * INTO legacy FROM rr_private.region_rings_refresh_state WHERE singleton FOR SHARE;
 IF NOT FOUND OR legacy.is_dirty THEN RETURN false; END IF;
 SELECT * INTO d FROM rr_private.region_rings_release_decision
 WHERE country_code=p_country_code AND activity_year=p_activity_year
   AND generation=s.generation AND policy_version=s.policy_version AND accepted
 FOR SHARE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF d.closed_after>statement_timestamp()
    OR d.activity_year>=EXTRACT(YEAR FROM (statement_timestamp() AT TIME ZONE 'UTC'))
    OR d.reviewed_at>statement_timestamp() THEN RETURN false; END IF;
 -- No overwrite: a past approval/suppression cannot be silently recycled.
 INSERT INTO rr_private.region_rings_approved_year
 (country_code,activity_year,rounded_distance_km,generation,policy_version,
  approved,approved_at,closed_after,permanently_suppressed)
 VALUES (d.country_code,d.activity_year,d.rounded_distance_km,d.generation,
 d.policy_version,true,clock_timestamp(),d.closed_after,false)
 ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RETURN false; END IF;
 INSERT INTO rr_private.region_rings_publication_ledger
 (country_code,activity_year,generation,policy_version,rounded_distance_km,
  action,reason,actor_reference)
 VALUES (d.country_code,d.activity_year,d.generation,d.policy_version,
  d.rounded_distance_km,'approve','review:'||d.privacy_review_ref||' / consent:'||d.consent_review_ref,p_actor_reference);
 RETURN true;
END $b1_approve$;

-- Global start is deliberately separate from approval. It is rejected
-- unless all existing approved cells are from the current reviewed generation,
-- the legacy dirty flag is clear, and the private state remains closed.
-- This is still a DRAFT: real per-user consent/attack-proof review is upstream.
CREATE OR REPLACE FUNCTION rr_private.b1_private_start(p_actor_reference text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $b1_start$
DECLARE s rr_private.region_rings_publication_state%ROWTYPE;
        legacy rr_private.region_rings_refresh_state%ROWTYPE;
        a record;
        count_approved integer:=0;
BEGIN
 IF nullif(btrim(p_actor_reference),'') IS NULL THEN RAISE EXCEPTION 'actor required'; END IF;
 SELECT * INTO s FROM rr_private.region_rings_publication_state WHERE singleton FOR UPDATE;
 IF NOT FOUND OR s.publication_enabled OR s.policy_version='unapproved'
    OR NOT s.is_dirty THEN RETURN false; END IF;
 SELECT * INTO legacy FROM rr_private.region_rings_refresh_state WHERE singleton FOR SHARE;
 IF NOT FOUND OR legacy.is_dirty THEN RETURN false; END IF;
 -- Every live, approved snapshot must have an exact accepted review decision.
 FOR a IN SELECT * FROM rr_private.region_rings_approved_year
          WHERE approved AND NOT permanently_suppressed FOR SHARE
 LOOP
   IF a.generation<>s.generation OR a.policy_version<>s.policy_version
      OR a.closed_after>statement_timestamp()
      OR a.activity_year>=EXTRACT(YEAR FROM (statement_timestamp() AT TIME ZONE 'UTC'))
      OR NOT EXISTS (
        SELECT 1 FROM rr_private.region_rings_release_decision d
        WHERE d.country_code=a.country_code AND d.activity_year=a.activity_year
          AND d.generation=a.generation AND d.policy_version=a.policy_version
          AND d.rounded_distance_km=a.rounded_distance_km
          AND d.closed_after=a.closed_after AND d.accepted
      ) THEN RETURN false;
   END IF;
   count_approved:=count_approved+1;
 END LOOP;
 IF count_approved=0 THEN RETURN false; END IF;
 UPDATE rr_private.region_rings_publication_state
  SET publication_enabled=true,is_dirty=false,updated_at=clock_timestamp()
 WHERE singleton;
 -- start records immutable scope and rounded values in the SAME transaction.
 INSERT INTO rr_private.region_rings_publication_ledger
 (country_code,activity_year,generation,policy_version,rounded_distance_km,
  action,reason,actor_reference)
 SELECT a.country_code,a.activity_year,a.generation,a.policy_version,
        a.rounded_distance_km,'start','reviewed global start',p_actor_reference
 FROM rr_private.region_rings_approved_year a
 WHERE a.approved AND NOT a.permanently_suppressed AND a.generation=s.generation;
 RETURN true;
END $b1_start$;
REVOKE ALL ON FUNCTION rr_private.b1_private_approve_year(text,integer,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION rr_private.b1_private_start(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION rr_private.b1_block_release_decision_change() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON rr_private.region_rings_release_decision FROM PUBLIC,anon,authenticated;
ALTER TABLE rr_private.region_rings_release_decision ENABLE ROW LEVEL SECURITY;
COMMIT;
