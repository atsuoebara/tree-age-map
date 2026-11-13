-- REVIEW-ONLY, isolated Postgres16 model. Does not call Garmin or modify production.
\set ON_ERROR_STOP on
CREATE SCHEMA IF NOT EXISTS consent_lease_ci;
DROP TABLE IF EXISTS consent_lease_ci.owner_state CASCADE;
CREATE TABLE consent_lease_ci.owner_state (
 owner_id uuid PRIMARY KEY,
 generation uuid NOT NULL,
 phase text NOT NULL CHECK(phase IN ('connected','disconnect_requested','revoke_inflight','revoke_unknown','disconnected')),
 import_enabled boolean NOT NULL,
 pending_generation uuid,
 lease_token uuid,
 attempt_id uuid,
 lease_deadline timestamptz,
 CHECK ((phase='connected' AND import_enabled AND pending_generation IS NULL)
      OR (phase<>'connected' AND NOT import_enabled)),
 CHECK ((lease_token IS NULL AND attempt_id IS NULL AND lease_deadline IS NULL)
     OR (lease_token IS NOT NULL AND attempt_id IS NOT NULL AND lease_deadline IS NOT NULL))
);
INSERT INTO consent_lease_ci.owner_state(owner_id,generation,phase,import_enabled) VALUES
 ('00000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-000000000001','connected',true),
 ('00000000-0000-0000-0000-0000000000b2','20000000-0000-0000-0000-000000000001','connected',true);
-- True only if the expected generation is still current.
CREATE OR REPLACE FUNCTION consent_lease_ci.disconnect(p_owner uuid,p_generation uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 UPDATE consent_lease_ci.owner_state SET phase='disconnect_requested',import_enabled=false
 WHERE owner_id=p_owner AND generation=p_generation AND phase='connected';
 RETURN FOUND;
END $$;
-- Does NOT activate new consent during remote revoke or unknown outcome.
CREATE OR REPLACE FUNCTION consent_lease_ci.reauthorize(p_owner uuid,p_new uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s consent_lease_ci.owner_state%ROWTYPE;
BEGIN
 SELECT * INTO s FROM consent_lease_ci.owner_state WHERE owner_id=p_owner FOR UPDATE;
 IF NOT FOUND OR p_new IS NULL OR p_new=s.generation THEN RETURN false; END IF;
 IF s.phase IN ('disconnect_requested','revoke_inflight','revoke_unknown') THEN
  UPDATE consent_lease_ci.owner_state SET pending_generation=p_new WHERE owner_id=p_owner;
 ELSIF s.phase IN ('connected','disconnected') THEN
  UPDATE consent_lease_ci.owner_state SET generation=p_new,phase='connected',
    import_enabled=true,pending_generation=NULL WHERE owner_id=p_owner;
 ELSE RETURN false;
 END IF;
 RETURN true;
END $$;
-- Claim is a short, transactional atomic transition. A second claimant cannot
-- claim an already inflight or UNKNOWN outcome, even after deadline.
CREATE OR REPLACE FUNCTION consent_lease_ci.claim(
 p_owner uuid,p_generation uuid,p_lease uuid,p_attempt uuid,p_deadline timestamptz
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF p_lease IS NULL OR p_attempt IS NULL OR p_deadline IS NULL OR p_deadline<=clock_timestamp() THEN RETURN false; END IF;
 UPDATE consent_lease_ci.owner_state SET phase='revoke_inflight',
  lease_token=p_lease,attempt_id=p_attempt,lease_deadline=p_deadline
 WHERE owner_id=p_owner AND generation=p_generation AND phase='disconnect_requested'
   AND lease_token IS NULL AND attempt_id IS NULL AND lease_deadline IS NULL;
 RETURN FOUND;
END $$;
-- Expiry is not remote failure proof. It transitions to UNKNOWN and blocks
-- automatic retries. It revokes *local ownership* but cannot cancel an HTTP
-- DELETE already delivered to Garmin.
CREATE OR REPLACE FUNCTION consent_lease_ci.expire(
 p_owner uuid,p_generation uuid,p_lease uuid,p_attempt uuid,p_now timestamptz
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 UPDATE consent_lease_ci.owner_state SET phase='revoke_unknown',
  lease_token=NULL,attempt_id=NULL,lease_deadline=NULL
 WHERE owner_id=p_owner AND generation=p_generation AND phase='revoke_inflight'
   AND lease_token=p_lease AND attempt_id=p_attempt AND lease_deadline<=p_now;
 RETURN FOUND;
END $$;
-- Completion must be fenced against both the claimed generation and attempt.
CREATE OR REPLACE FUNCTION consent_lease_ci.complete(
 p_owner uuid,p_generation uuid,p_lease uuid,p_attempt uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 UPDATE consent_lease_ci.owner_state SET phase='disconnected',
  import_enabled=false,pending_generation=NULL,
  lease_token=NULL,attempt_id=NULL,lease_deadline=NULL
 WHERE owner_id=p_owner AND generation=p_generation AND phase='revoke_inflight'
   AND lease_token=p_lease AND attempt_id=p_attempt
   AND lease_deadline>clock_timestamp();
 RETURN FOUND;
END $$;
-- Recovery from UNKNOWN needs external verification and a separate reviewed
-- operation; the isolated model intentionally offers no automatic re-claim.
