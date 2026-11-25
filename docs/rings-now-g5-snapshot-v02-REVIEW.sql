-- G5 REVIEW ONLY. NEVER EXECUTE OR DEPLOY without separate exact approval.
-- New candidate; preserve G4 original bytes. Only this RPC enforces strict expiry.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';
-- CREATE (not REPLACE): unexpected pre-existing signature aborts transaction.
CREATE FUNCTION public.rings_now_snapshot_candidate_v02()
RETURNS jsonb
LANGUAGE plpgsql
-- Wall-clock admission can vary within a statement; do not promise STABLE.
-- PostgREST POST uses a read-write transaction, but this body performs no DML.
-- All run rows and checks are derived from one SELECT snapshot.
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $rings_now_v02$
DECLARE
  claims jsonb;
  result jsonb;
BEGIN
  claims := auth.jwt();
  IF current_user <> 'authenticated' OR auth.uid() IS NULL
     OR jsonb_typeof(claims -> 'exp') IS DISTINCT FROM 'number' THEN
    RAISE SQLSTATE 'PT401' USING MESSAGE = 'Invalid or expired token';
  END IF;
  IF (claims ->> 'exp')::numeric <= extract(epoch FROM clock_timestamp()) THEN
    RAISE SQLSTATE 'PT401' USING MESSAGE = 'Invalid or expired token';
  END IF;
  -- Keep the original single data-reading statement intact.
  WITH owner AS MATERIALIZED (
    SELECT auth.uid() AS uid
  ),
  sampled AS MATERIALIZED (
    SELECT r.id, r.user_id, r.activity_date, r.distance_km,
           r.started_at, r.deleted_at
    FROM public.runs AS r
    WHERE r.user_id = (SELECT uid FROM owner)
      AND r.deleted_at IS NULL
    ORDER BY r.id ASC
    LIMIT 1001
  ),
  count_check AS MATERIALIZED (
    SELECT count(*) AS total FROM sampled
  ),
  required_null_check AS MATERIALIZED (
    SELECT count(*) FILTER (
      WHERE activity_date IS NULL
         OR distance_km IS NULL
         OR started_at IS NULL
    ) AS invalid_total
    FROM sampled
  ),
  safe_rows AS (
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'user_id', user_id,
          'activity_date', activity_date,
          'distance_km', distance_km,
          'started_at', started_at,
          'deleted_at', deleted_at
        ) ORDER BY id ASC
      ),
      '[]'::jsonb
    ) AS rows
    FROM sampled
    WHERE (SELECT total FROM count_check) <= 1000
      AND (SELECT invalid_total FROM required_null_check) = 0
  )
  SELECT CASE
    WHEN (SELECT uid FROM owner) IS NULL
      THEN jsonb_build_object('status','blocked','reason','unauthenticated')
    WHEN (SELECT total FROM count_check) > 1000
      THEN jsonb_build_object('status','blocked','reason','too_many_rows')
    WHEN (SELECT invalid_total FROM required_null_check) > 0
      THEN jsonb_build_object('status','blocked','reason','missing_required_fields')
    ELSE jsonb_build_object('status','candidate_snapshot','rows',
                           (SELECT rows FROM safe_rows))
  END INTO result;
  RETURN result;
END;
$rings_now_v02$;
REVOKE ALL ON FUNCTION public.rings_now_snapshot_candidate_v02() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rings_now_snapshot_candidate_v02() FROM anon;
REVOKE ALL ON FUNCTION public.rings_now_snapshot_candidate_v02() FROM service_role;
GRANT EXECUTE ON FUNCTION public.rings_now_snapshot_candidate_v02() TO authenticated;
-- Abort if effective grants or table RLS differ from expectations.
DO $check$
BEGIN
  IF has_function_privilege('anon','public.rings_now_snapshot_candidate_v02()','EXECUTE')
     OR has_function_privilege('service_role','public.rings_now_snapshot_candidate_v02()','EXECUTE')
     OR NOT has_function_privilege('authenticated','public.rings_now_snapshot_candidate_v02()','EXECUTE')
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid='public.runs'::regclass AND relrowsecurity)
     OR EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='authenticated' AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'G5 effective ACL/RLS precondition failed';
  END IF;
END;
$check$;
COMMIT;
