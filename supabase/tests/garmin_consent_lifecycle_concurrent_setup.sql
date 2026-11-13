-- CI only: two-session consent lifecycle model with PostgreSQL row locks.
-- Never run against production. Synthetic identifiers only.
\set ON_ERROR_STOP on
CREATE SCHEMA IF NOT EXISTS consent_ci;
DROP TABLE IF EXISTS consent_ci.lifecycle CASCADE;
CREATE TABLE consent_ci.lifecycle (
 owner_id uuid PRIMARY KEY,
 generation uuid NOT NULL,
 state text NOT NULL CHECK(state IN ('connected','disconnect_requested','revoke_inflight','revoke_unknown','disconnected')),
 pending_generation uuid NULL,
 can_import boolean NOT NULL,
 CHECK ((state='connected' AND can_import AND pending_generation IS NULL)
        OR (state<>'connected' AND NOT can_import))
);
INSERT INTO consent_ci.lifecycle VALUES
 ('00000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-000000000001','connected',NULL,true),
 ('00000000-0000-0000-0000-0000000000b2','20000000-0000-0000-0000-000000000001','connected',NULL,true);
-- A DB transaction provides row-level serialization for all changes to one owner.
CREATE OR REPLACE FUNCTION consent_ci.apply(
 p_owner uuid,p_generation uuid,p_action text,p_new_generation uuid DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE s consent_ci.lifecycle%ROWTYPE;
BEGIN
 SELECT * INTO s FROM consent_ci.lifecycle WHERE owner_id=p_owner FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF p_action='reauthorize' THEN
  IF p_new_generation IS NULL OR p_new_generation=s.generation THEN RETURN false; END IF;
  IF s.state IN ('disconnect_requested','revoke_inflight','revoke_unknown') THEN
    UPDATE consent_ci.lifecycle SET pending_generation=p_new_generation,can_import=false WHERE owner_id=p_owner;
    RETURN true;
  END IF;
  IF s.state IN ('connected','disconnected') THEN
    UPDATE consent_ci.lifecycle SET generation=p_new_generation,
      state='connected',pending_generation=NULL,can_import=true WHERE owner_id=p_owner;
    RETURN true;
  END IF;
  RETURN false;
 END IF;
 IF s.generation<>p_generation THEN RETURN false; END IF;
 IF p_action='disconnect' AND s.state='connected' THEN
  UPDATE consent_ci.lifecycle SET state='disconnect_requested',can_import=false WHERE owner_id=p_owner;
 ELSIF p_action='begin_revoke' AND s.state='disconnect_requested' THEN
  UPDATE consent_ci.lifecycle SET state='revoke_inflight',can_import=false WHERE owner_id=p_owner;
 ELSIF p_action='revoke_timeout' AND s.state='revoke_inflight' THEN
  UPDATE consent_ci.lifecycle SET state='revoke_unknown',can_import=false WHERE owner_id=p_owner;
 ELSIF p_action='retry_revoke' AND s.state='revoke_unknown' THEN
  UPDATE consent_ci.lifecycle SET state='revoke_inflight',can_import=false WHERE owner_id=p_owner;
 ELSIF p_action='revoke_confirmed' AND s.state IN ('revoke_inflight','revoke_unknown') THEN
  UPDATE consent_ci.lifecycle SET state='disconnected',can_import=false,pending_generation=NULL WHERE owner_id=p_owner;
 ELSE RETURN false;
 END IF;
 RETURN true;
END $$;
