-- Rings Now REVIEW CANDIDATE ONLY. DO NOT EXECUTE OR DEPLOY.
-- No GRANT, ALTER POLICY, migrations, or network activity is performed by this file.
-- Existing public.runs schema, types, indexes, actual JWT/RLS and fees are UNVERIFIED.
--
-- One PostgreSQL statement uses one MVCC statement snapshot, in contrast to
-- multiple OFFSET calls or two independent reads. This is a design hypothesis
-- to verify in staging with an authenticated client, not proof of production safety.
--
-- SECURITY INVOKER: never grant this function to anon or bypass RLS.
-- The caller still MUST invalidate responses after logout/session rotation.
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
  )
  SELECT CASE
    WHEN (SELECT uid FROM owner) IS NULL
      THEN jsonb_build_object('status','blocked','reason','unauthenticated')
    WHEN (SELECT total FROM count_check) > 1000
      THEN jsonb_build_object('status','blocked','reason','too_many_rows')
    ELSE jsonb_build_object('status','candidate_snapshot','rows',
                           (SELECT rows FROM safe_rows))
  END;
$rings_now_candidate$;

-- Deliberately NO GRANT EXECUTE, REVOKE, or deployment steps.
-- Before adoption: independently check RLS policy on public.runs, actual
-- return column types, service-role bypass, a real JWT, permissions,
-- 1000/1001 boundary, performance, plan pricing and failure conditions.
