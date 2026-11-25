-- G5 disposable fixture only; no production access. Synthetic claims, not JWT proof.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO public.runs(user_id,activity_date,distance_km,started_at)
SELECT '00000000-0000-4000-8000-000000000001'::uuid,DATE '2026-11-17',5,
 TIMESTAMPTZ '2026-11-17 00:00:00+00' FROM generate_series(1,1000);
INSERT INTO public.runs(user_id,activity_date,distance_km,started_at)
VALUES ('00000000-0000-4000-8000-000000000002',DATE '2026-11-17',6,now());
INSERT INTO public.runs(user_id,activity_date,distance_km,started_at,deleted_at)
VALUES ('00000000-0000-4000-8000-000000000001',NULL,NULL,NULL,now());
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-4000-8000-000000000001','role','authenticated','exp',extract(epoch FROM clock_timestamp())+600)::text,true);
DO $check$
DECLARE p jsonb;
BEGIN
 p:=public.rings_now_snapshot_candidate_v02();
 IF p->>'status' IS DISTINCT FROM 'candidate_snapshot' OR jsonb_array_length(p->'rows') IS DISTINCT FROM 1000 OR EXISTS(
 SELECT 1 FROM jsonb_array_elements(p->'rows') r
 WHERE r->>'user_id' IS DISTINCT FROM '00000000-0000-4000-8000-000000000001'
 OR r->'deleted_at' IS DISTINCT FROM 'null'::jsonb
 OR NOT (r ?& ARRAY['id','user_id','activity_date','distance_km','started_at','deleted_at'])
 OR (SELECT count(*) FROM jsonb_object_keys(r))<>6
 ) THEN RAISE EXCEPTION 'G5_1000_OWNER_FIELDS_FAILED'; END IF;
END $check$;
RESET ROLE;
INSERT INTO public.runs(user_id,activity_date,distance_km,started_at)
VALUES ('00000000-0000-4000-8000-000000000001',DATE '2026-11-17',7,now());
SET LOCAL ROLE authenticated;
DO $check$
BEGIN
 IF public.rings_now_snapshot_candidate_v02() IS DISTINCT FROM '{"status":"blocked","reason":"too_many_rows"}'::jsonb THEN RAISE EXCEPTION 'G5_1001_FAILED'; END IF;
END $check$;
RESET ROLE;
DELETE FROM public.runs WHERE user_id='00000000-0000-4000-8000-000000000001' AND deleted_at IS NULL;
SET LOCAL ROLE authenticated;
DO $check$
BEGIN
 IF public.rings_now_snapshot_candidate_v02() IS DISTINCT FROM '{"status":"candidate_snapshot","rows":[]}'::jsonb THEN RAISE EXCEPTION 'G5_ZERO_FAILED'; END IF;
END $check$;
RESET ROLE;
INSERT INTO public.runs(user_id,activity_date,distance_km,started_at)
VALUES ('00000000-0000-4000-8000-000000000001',DATE '2026-11-17',5,NULL);
SET LOCAL ROLE authenticated;
DO $check$
BEGIN
 IF public.rings_now_snapshot_candidate_v02() IS DISTINCT FROM '{"status":"blocked","reason":"missing_required_fields"}'::jsonb THEN RAISE EXCEPTION 'G5_NULL_FAILED'; END IF;
END $check$;
DO $check$
DECLARE claims jsonb; denied boolean;
BEGIN
 FOREACH claims IN ARRAY ARRAY[
 '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}'::jsonb,
 '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","exp":"9999999999"}'::jsonb,
 jsonb_build_object('sub','00000000-0000-4000-8000-000000000001','role','authenticated','exp',extract(epoch FROM clock_timestamp()))
 ] LOOP
 PERFORM set_config('request.jwt.claims',claims::text,true);
 denied:=false;
 BEGIN
 PERFORM public.rings_now_snapshot_candidate_v02();
 EXCEPTION WHEN SQLSTATE 'PT401' THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'G5_EXP_FAILED'; END IF;
 END LOOP;
END $check$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $check$
DECLARE denied boolean:=false;
BEGIN
 BEGIN PERFORM public.rings_now_snapshot_candidate_v02();
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'G5_ANON_FAILED'; END IF;
END $check$;
RESET ROLE;
ROLLBACK;
