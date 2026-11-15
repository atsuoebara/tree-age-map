-- Rings Now REVIEW CANDIDATE ONLY. DO NOT EXECUTE OR DEPLOY.
-- This file includes an UNEXECUTED transactional ACL proposal; no DB changes occur.
-- Applying this SQL requires separate explicit owner approval and staging proof.
-- Column types and RLS predicates checked read-only 2026-11-15; actual JWT/ACL, costs and performance remain UNVERIFIED.
-- A read-only COUNT found one undeleted started_at NULL in 25,942 rows;
-- no identity, row values, or per-user ownership were obtained.
--
-- One PostgreSQL statement uses one MVCC statement snapshot, in contrast to
-- multiple OFFSET calls or two independent reads. This is a design hypothesis
-- to verify in staging with an authenticated client, not proof of production safety.
--
-- SECURITY INVOKER: never grant this function to anon or bypass RLS.
-- The caller still MUST invalidate responses after logout/session rotation.
-- If separately approved, CREATE/REPLACE and privilege narrowing MUST be
-- executed in the same transaction to avoid an intermediate PUBLIC EXECUTE window.
-- CREATE OR REPLACE retains previous ACLs, so defaults cannot be assumed safe.
BEGIN;
CREATE OR REPLACE FUNCTION public.rings_now_snapshot_candidate_v01()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $rings_now_candidate$
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
  END;
$rings_now_candidate$;

-- PostgreSQL normally grants function EXECUTE to PUBLIC unless revoked.
-- Explicitly revoke inherited/default access; allow only authenticated role.
-- Do not assume REVOKE blocks superusers, function owner or service_role RLS bypass.
REVOKE ALL ON FUNCTION public.rings_now_snapshot_candidate_v01() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rings_now_snapshot_candidate_v01() FROM anon;
REVOKE ALL ON FUNCTION public.rings_now_snapshot_candidate_v01() FROM service_role;
GRANT EXECUTE ON FUNCTION public.rings_now_snapshot_candidate_v01() TO authenticated;
COMMIT;

-- This is a DESIGN, not evidence of an applied or effective ACL.
-- BEFORE any use check pg_proc.proacl, pg_has_role/has_function_privilege,
-- effective role membership, authenticated JWT, owner/table privileges and RLS,
-- whether PostgREST exposes the RPC, and service-role bypass.
-- Before adoption: independently check RLS policy on public.runs, actual
-- return column types, service-role bypass, a real JWT, permissions,
-- 1000/1001 boundary, performance, plan pricing and failure conditions.
