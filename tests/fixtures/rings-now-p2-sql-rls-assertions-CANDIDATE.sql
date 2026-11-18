-- Rings Now P2 isolated PostgreSQL-only RLS probe, NOT FOR PRODUCTION.
-- Requires exact candidate fixture + snapshot to have been loaded already.
-- Transaction ALWAYS ROLLBACKS; never use production user records.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO public.runs(user_id, activity_date, distance_km, started_at)
SELECT '00000000-0000-4000-8000-000000000001'::uuid,
       DATE '2026-11-17', 5.0,
       TIMESTAMPTZ '2026-11-17 00:00:00+00'
FROM generate_series(1,1000);
INSERT INTO public.runs(user_id, activity_date, distance_km, started_at)
VALUES ('00000000-0000-4000-8000-000000000002'::uuid,
        DATE '2026-11-17', 6.0, TIMESTAMPTZ '2026-11-17 00:00:00+00');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',
 '00000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims',
 '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
DO $probe$
DECLARE payload jsonb;
BEGIN
 SELECT public.rings_now_snapshot_candidate_v01() INTO payload;
 IF payload->>'status' IS DISTINCT FROM 'candidate_snapshot'
    OR jsonb_array_length(payload->'rows') <> 1000
    OR EXISTS (
     SELECT 1 FROM jsonb_array_elements(payload->'rows') AS record
     WHERE record->>'user_id' <> '00000000-0000-4000-8000-000000000001'
    ) THEN
   RAISE EXCEPTION 'P2_RLS_1000_OR_OWNER_CHECK_FAILED';
 END IF;
END
$probe$;
-- Both GUC representations conflict: auth.uid() MUST fail closed to NULL.
SELECT set_config('request.jwt.claims',
 '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
DO $probe$
DECLARE payload jsonb;
BEGIN
 SELECT public.rings_now_snapshot_candidate_v01() INTO payload;
 IF payload->>'status' IS DISTINCT FROM 'blocked'
    OR payload->>'reason' IS DISTINCT FROM 'unauthenticated' THEN
   RAISE EXCEPTION 'P2_CONFLICTING_SUB_CLAIM_NOT_BLOCKED';
 END IF;
END
$probe$;
RESET ROLE;
-- Adding the 1001st record to this owner must block the snapshot.
INSERT INTO public.runs(user_id, activity_date, distance_km, started_at)
VALUES ('00000000-0000-4000-8000-000000000001'::uuid,
        DATE '2026-11-17', 7.0, TIMESTAMPTZ '2026-11-17 00:00:00+00');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
 '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
DO $probe$
DECLARE payload jsonb;
BEGIN
 SELECT public.rings_now_snapshot_candidate_v01() INTO payload;
 IF payload->>'status' IS DISTINCT FROM 'blocked'
    OR payload->>'reason' IS DISTINCT FROM 'too_many_rows' THEN
   RAISE EXCEPTION 'P2_BOUNDARY_1001_NOT_BLOCKED';
 END IF;
END
$probe$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $probe$
DECLARE denied boolean := false;
BEGIN
 BEGIN
  PERFORM public.rings_now_snapshot_candidate_v01();
 EXCEPTION WHEN insufficient_privilege THEN
  denied := true;
 END;
 IF NOT denied THEN
  RAISE EXCEPTION 'P2_ANON_RPC_EXECUTE_NOT_DENIED';
 END IF;
END
$probe$;
RESET ROLE;
ROLLBACK;
