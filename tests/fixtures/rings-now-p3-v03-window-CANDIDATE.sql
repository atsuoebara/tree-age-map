-- DISPOSABLE POSTGRES ONLY. Run after existing G5 schema fixture and exact v03 SQL.
-- Synthetic claims exercise SQL, not signed JWT/HTTP authentication.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='10s';
SET LOCAL lock_timeout='2s';
DO $guard$ BEGIN
 IF current_database() <> 'rings_now_v03_isolated' THEN RAISE EXCEPTION 'isolated database required'; END IF;
 IF EXISTS(SELECT 1 FROM public.runs) THEN RAISE EXCEPTION 'empty fixture required'; END IF;
END $guard$;
INSERT INTO public.runs(user_id,activity_date,distance_km,started_at)
SELECT '00000000-0000-4000-8000-000000000001',CURRENT_DATE,5,now()-interval '9 days' FROM generate_series(1,1001);
INSERT INTO public.runs(user_id,activity_date,distance_km,started_at)
VALUES ('00000000-0000-4000-8000-000000000001',NULL,NULL,NULL),
 ('00000000-0000-4000-8000-000000000001',NULL,NULL,now()-interval '9 days'),
 ('00000000-0000-4000-8000-000000000001',CURRENT_DATE,5,now()+interval '1 day'),
 ('00000000-0000-4000-8000-000000000002',CURRENT_DATE,6,now()-interval '1 hour');
INSERT INTO public.runs(user_id,activity_date,distance_km,started_at,deleted_at)
VALUES ('00000000-0000-4000-8000-000000000001',CURRENT_DATE,5,now()-interval '1 hour',now());
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-4000-8000-000000000001','role','authenticated','exp',extract(epoch FROM clock_timestamp())+600)::text,true);
DO $check$ BEGIN
 IF public.rings_now_snapshot_candidate_v03() IS DISTINCT FROM '{"status":"candidate_snapshot","rows":[]}'::jsonb THEN RAISE EXCEPTION 'V03_ZERO'; END IF;
END $check$;
RESET ROLE;
INSERT INTO public.runs(user_id,activity_date,distance_km,started_at)
SELECT '00000000-0000-4000-8000-000000000001',CURRENT_DATE,5,now()-interval '1 hour' FROM generate_series(1,1000);
SET LOCAL ROLE authenticated;
DO $check$ DECLARE p jsonb; BEGIN
 p:=public.rings_now_snapshot_candidate_v03();
 IF p->>'status' IS DISTINCT FROM 'candidate_snapshot' OR jsonb_array_length(p->'rows') IS DISTINCT FROM 1000 OR EXISTS(
 SELECT 1 FROM jsonb_array_elements(p->'rows') r WHERE r->>'user_id' IS DISTINCT FROM '00000000-0000-4000-8000-000000000001'
 OR r->'deleted_at' IS DISTINCT FROM 'null'::jsonb OR NOT(r ?& ARRAY['id','user_id','activity_date','distance_km','started_at','deleted_at'])
 OR (SELECT count(*) FROM jsonb_object_keys(r))<>6 OR (r->>'started_at')::timestamptz IS DISTINCT FROM now()-interval '1 hour'
 ) THEN RAISE EXCEPTION 'V03_1000_OWNER_WINDOW_FIELDS'; END IF;
END $check$;
RESET ROLE;
INSERT INTO public.runs(user_id,activity_date,distance_km,started_at)
VALUES ('00000000-0000-4000-8000-000000000001',CURRENT_DATE,5,now()-interval '1 hour');
SET LOCAL ROLE authenticated;
DO $check$ BEGIN
 IF public.rings_now_snapshot_candidate_v03() IS DISTINCT FROM '{"status":"blocked","reason":"too_many_rows"}'::jsonb THEN RAISE EXCEPTION 'V03_1001'; END IF;
END $check$;
RESET ROLE;
DELETE FROM public.runs WHERE user_id='00000000-0000-4000-8000-000000000001' AND started_at=now()-interval '1 hour' AND deleted_at IS NULL;
INSERT INTO public.runs(user_id,activity_date,distance_km,started_at)
VALUES ('00000000-0000-4000-8000-000000000001',CURRENT_DATE,5,now()-interval '2 hours');
SET LOCAL ROLE authenticated;
DO $check$ DECLARE p jsonb; BEGIN
 p:=public.rings_now_snapshot_candidate_v03();
 IF p->>'status' IS DISTINCT FROM 'candidate_snapshot' OR jsonb_array_length(p->'rows') IS DISTINCT FROM 1 OR p->'rows'->0->>'user_id' IS DISTINCT FROM '00000000-0000-4000-8000-000000000001' THEN RAISE EXCEPTION 'V03_LONG_HISTORY_ONE'; END IF;
END $check$;
RESET ROLE;
INSERT INTO public.runs(user_id,activity_date,distance_km,started_at)
VALUES ('00000000-0000-4000-8000-000000000001',NULL,5,now()-interval '1 hour');
SET LOCAL ROLE authenticated;
DO $check$ BEGIN
 IF public.rings_now_snapshot_candidate_v03() IS DISTINCT FROM '{"status":"blocked","reason":"missing_required_fields"}'::jsonb THEN RAISE EXCEPTION 'V03_NULL_DATE'; END IF;
END $check$;
RESET ROLE;
DELETE FROM public.runs WHERE user_id='00000000-0000-4000-8000-000000000001' AND activity_date IS NULL AND started_at=now()-interval '1 hour';
INSERT INTO public.runs(user_id,activity_date,distance_km,started_at)
VALUES ('00000000-0000-4000-8000-000000000001',CURRENT_DATE,NULL,now()-interval '1 hour');
SET LOCAL ROLE authenticated;
DO $check$ BEGIN
 IF public.rings_now_snapshot_candidate_v03() IS DISTINCT FROM '{"status":"blocked","reason":"missing_required_fields"}'::jsonb THEN RAISE EXCEPTION 'V03_NULL_DISTANCE'; END IF;
END $check$;
DO $check$ DECLARE claims jsonb; denied boolean; BEGIN
 FOREACH claims IN ARRAY ARRAY[
 '{"sub":"00000000-0000-4000-8000-000000000001"}'::jsonb,
 '{"sub":"00000000-0000-4000-8000-000000000001","exp":"9999999999"}'::jsonb,
 jsonb_build_object('sub','00000000-0000-4000-8000-000000000001','exp',extract(epoch FROM clock_timestamp())-1)
 ] LOOP
 PERFORM set_config('request.jwt.claims',claims::text,true);
 denied:=false;
 BEGIN PERFORM public.rings_now_snapshot_candidate_v03(); EXCEPTION WHEN SQLSTATE 'PT401' THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'V03_EXP'; END IF;
 END LOOP;
END $check$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $check$ DECLARE denied boolean:=false; BEGIN
 BEGIN PERFORM public.rings_now_snapshot_candidate_v03(); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'V03_ANON'; END IF;
END $check$;
RESET ROLE;
-- Deterministic comparator check, not a claim of exact live-clock equality.
DO $check$ DECLARE t timestamptz:='2026-11-01 00:00:00.123+00'; lo timestamptz; BEGIN
 lo:=t-interval '691200 seconds';
 IF NOT(lo>=t-interval '691200 seconds' AND lo<=t)
 OR (lo-interval '1 microsecond'>=t-interval '691200 seconds')
 OR NOT(t>=lo AND t<=t) OR (t+interval '1 microsecond'<=t)
 THEN RAISE EXCEPTION 'V03_BOUNDARY'; END IF;
END $check$;
ROLLBACK;
\echo V03_SQL_FIXTURE_PASS
