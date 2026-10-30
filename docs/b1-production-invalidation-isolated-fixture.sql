-- B-1 production-function isolated fixture. Disposable PostgreSQL ONLY.
-- The invalidation function body is copied from read-only pg_get_functiondef
-- on 2026-10-30. No production data or secrets.
CREATE SCHEMA rr_private;
CREATE TABLE rr_private.region_rings_refresh_state (
 singleton boolean PRIMARY KEY DEFAULT true,
 is_dirty boolean NOT NULL DEFAULT false,
 last_invalidated_at timestamptz,
 reason text,
 publication_enabled boolean NOT NULL DEFAULT false
);
INSERT INTO rr_private.region_rings_refresh_state (singleton,is_dirty,publication_enabled)
VALUES (true,false,false);
CREATE TABLE rr_private.region_rings_public_candidate (
 country_code text, region_code text, region_name text,
 year integer, month integer, participant_count integer,
 distance_km numeric, calculated_at timestamptz
);
CREATE OR REPLACE FUNCTION rr_private.invalidate_region_rings_cache()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
begin
 update rr_private.region_rings_refresh_state set is_dirty=true,last_invalidated_at=now(),reason=TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME||':'||TG_OP where singleton=true;
 delete from rr_private.region_rings_public_candidate;
 return coalesce(new,old);
end;
$function$;
-- Attach to disposable runs fixture in future A/B workflow.
-- A/B should enable/disable the statement trigger only; Today stub unchanged.
