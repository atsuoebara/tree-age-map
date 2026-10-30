-- B-1 wrapper prototype — ISOLATED DATABASE ONLY. DO NOT APPLY TO SUPABASE PRODUCTION.
-- Prerequisites: B-1 baseline SQL and separately provisioned individual login roles.
-- The implementation deliberately excludes decision INSERT until immutable dual-identity
-- attestations have an authenticated source. No public release or service_role.
BEGIN;
CREATE ROLE b1_wrapper_owner NOLOGIN NOINHERIT;
CREATE ROLE b1_approver NOLOGIN;
CREATE ROLE b1_publisher NOLOGIN;
CREATE ROLE b1_emergency_stopper NOLOGIN;
CREATE ROLE b1_private_reader NOLOGIN;
REVOKE ALL ON SCHEMA rr_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA rr_private TO b1_wrapper_owner,b1_approver,b1_publisher,b1_emergency_stopper,b1_private_reader;
-- The owner is NOT the owner of the base tables and must not have BYPASSRLS.
-- Roles and grants must be provisioned by the isolated test's database administrator.
GRANT SELECT ON rr_private.region_rings_release_decision,
 rr_private.region_rings_refresh_state,rr_private.region_rings_publication_state,
 rr_private.region_rings_approved_year TO b1_wrapper_owner;
GRANT UPDATE ON rr_private.region_rings_publication_state,
 rr_private.region_rings_approved_year TO b1_wrapper_owner;
GRANT INSERT ON rr_private.region_rings_approved_year,
 rr_private.region_rings_publication_ledger TO b1_wrapper_owner;
GRANT USAGE,SELECT ON SEQUENCE rr_private.region_rings_publication_ledger_id_seq TO b1_wrapper_owner;
-- Important: a direct table grant to the owner is unavoidable in this INVOKER setup;
-- operational login roles get NO direct grants.
GRANT EXECUTE ON FUNCTION rr_private.b1_private_approve_year(text,integer,text),
 rr_private.b1_private_start(text),rr_private.b1_private_stop(text,text),
 rr_private.b1_read_approved_year(text,integer) TO b1_wrapper_owner;
-- Fail closed unless an individual LOGIN role is authenticated; CURRENT_USER is
-- wrapper owner inside SECURITY DEFINER, while SESSION_USER is the connection identity.
-- SET ROLE tests must reject any session with an assumed cross-functional role.
CREATE OR REPLACE FUNCTION rr_private.b1_session_actor()
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE identity_name text := session_user;
BEGIN
 IF identity_name IN ('postgres','anon','authenticated','service_role','supabase_admin','b1_wrapper_owner')
    OR identity_name LIKE 'b1_%' OR identity_name = '' THEN
   RAISE EXCEPTION 'B1: non-individual actor denied';
 END IF;
 RETURN identity_name;
END $$;
ALTER FUNCTION rr_private.b1_session_actor() OWNER TO b1_wrapper_owner;
REVOKE ALL ON FUNCTION rr_private.b1_session_actor() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION rr_private.b1_session_actor() TO b1_wrapper_owner;

CREATE OR REPLACE FUNCTION rr_private.b1_wrapped_approve(p_country text,p_year integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_country !~ '^[A-Z]{2}$' OR p_year NOT BETWEEN 2000 AND 2200
 THEN RAISE EXCEPTION 'B1: invalid input'; END IF;
 RETURN rr_private.b1_private_approve_year(p_country,p_year,rr_private.b1_session_actor());
END $$;
CREATE OR REPLACE FUNCTION rr_private.b1_wrapped_start()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 RETURN rr_private.b1_private_start(rr_private.b1_session_actor());
END $$;
CREATE OR REPLACE FUNCTION rr_private.b1_wrapped_stop(p_reason text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 8 AND 240
 THEN RAISE EXCEPTION 'B1: stop reason required'; END IF;
 RETURN rr_private.b1_private_stop(p_reason,rr_private.b1_session_actor());
END $$;
CREATE OR REPLACE FUNCTION rr_private.b1_wrapped_read(p_country text,p_year integer)
RETURNS TABLE(country_code text,activity_year integer,distance_km numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_country !~ '^[A-Z]{2}$' OR p_year NOT BETWEEN 2000 AND 2200
 THEN RAISE EXCEPTION 'B1: invalid input'; END IF;
 PERFORM rr_private.b1_session_actor();
 RETURN QUERY SELECT * FROM rr_private.b1_read_approved_year(p_country,p_year);
END $$;
ALTER FUNCTION rr_private.b1_wrapped_approve(text,integer) OWNER TO b1_wrapper_owner;
ALTER FUNCTION rr_private.b1_wrapped_start() OWNER TO b1_wrapper_owner;
ALTER FUNCTION rr_private.b1_wrapped_stop(text) OWNER TO b1_wrapper_owner;
ALTER FUNCTION rr_private.b1_wrapped_read(text,integer) OWNER TO b1_wrapper_owner;
REVOKE ALL ON FUNCTION rr_private.b1_wrapped_approve(text,integer),
 rr_private.b1_wrapped_start(),rr_private.b1_wrapped_stop(text),
 rr_private.b1_wrapped_read(text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION rr_private.b1_wrapped_approve(text,integer) TO b1_approver;
GRANT EXECUTE ON FUNCTION rr_private.b1_wrapped_start() TO b1_publisher;
GRANT EXECUTE ON FUNCTION rr_private.b1_wrapped_stop(text) TO b1_emergency_stopper;
GRANT EXECUTE ON FUNCTION rr_private.b1_wrapped_read(text,integer) TO b1_private_reader;
COMMIT;
