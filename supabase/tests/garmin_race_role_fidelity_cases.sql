-- Synthetic Supabase-role replica. Run ONLY in disposable PostgreSQL CI database.
-- Schemas, tables and functions are actual PR proposed files, installed beforehand.
-- Role properties mirror read-only catalog audit of live Supabase:
-- anon & authenticated NO BYPASSRLS; service_role BYPASSRLS;
-- service_role may write private Garmin tables; authenticated cannot.
ALTER ROLE anon NOBYPASSRLS;
ALTER ROLE authenticated NOBYPASSRLS;
ALTER ROLE service_role BYPASSRLS;
REVOKE ALL ON public.garmin_api_connections, public.garmin_activity_inbox FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.garmin_api_connections, public.garmin_activity_inbox FROM service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.garmin_api_connections, public.garmin_activity_inbox TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.runs TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.runs_id_seq, public.garmin_activity_inbox_id_seq TO service_role;
GRANT EXECUTE ON FUNCTION public.garmin_has_export(jsonb) TO service_role;
ALTER TABLE public.garmin_api_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garmin_activity_inbox ENABLE ROW LEVEL SECURITY;
-- Select control is the proposed analysis policy, not a test mock.
-- Add another fully owned Garmin run for owner isolation checks.
INSERT INTO public.runs(user_id,source,source_external_id)
VALUES ('00000000-0000-4000-8000-000000000001','garmin','synthetic-role-A'),
       ('00000000-0000-4000-8000-000000000003','garmin','synthetic-role-B');
INSERT INTO public.run_race_analysis(
 user_id,run_id,analysis_version,source_kind,source_connection_version,
 distance_basis,time_basis,sample_count,total_distance_m,total_clock_elapsed_s,segments,overall_flags)
SELECT user_id,id,'garmin-activity-details-v1','garmin_activity_details',
 '00000000-0000-4000-8000-000000000002',
 'device_cumulative_m','clock_elapsed_seconds',2,1000,300,
 '[{"segment_index":1,"distance_m":1000}]'::jsonb,'[]'::jsonb
FROM public.runs WHERE source_external_id LIKE 'synthetic-role-%';

-- Authenticated cannot see private Garmin connection or inbox tables, or write analysis.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
DO $test$
DECLARE n integer; denied boolean;
BEGIN
 SELECT count(*) INTO n FROM public.run_race_analysis;
 IF n<>1 THEN RAISE EXCEPTION 'owner read expected 1, got %',n; END IF;
 RAISE NOTICE 'PASS authenticated A owner read exactly one';
 denied:=false;
 BEGIN
   DELETE FROM public.run_race_analysis WHERE user_id='00000000-0000-4000-8000-000000000001';
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'authenticated analysis DELETE unexpectedly allowed'; END IF;
 denied:=false;
 BEGIN
   INSERT INTO public.run_race_analysis(
    user_id,run_id,analysis_version,source_kind,source_connection_version,
    distance_basis,time_basis,sample_count,total_distance_m,total_clock_elapsed_s,segments,overall_flags)
   SELECT user_id,id,'garmin-activity-details-v1','garmin_activity_details',
    '00000000-0000-4000-8000-000000000002',
    'device_cumulative_m','clock_elapsed_seconds',2,1000,300,'[]'::jsonb,'[]'::jsonb
   FROM public.runs WHERE source_external_id='synthetic-role-A';
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'authenticated analysis INSERT unexpectedly allowed'; END IF;
 denied:=false;
 BEGIN
   SELECT count(*) INTO n FROM public.garmin_api_connections;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'authenticated private connection SELECT unexpectedly allowed'; END IF;
 denied:=false;
 BEGIN
   PERFORM public.garmin_commit_activity(1::bigint,1,'{}'::jsonb,null::jsonb);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'authenticated commit RPC EXECUTE unexpectedly allowed'; END IF;
 RAISE NOTICE 'PASS authenticated cannot INSERT/DELETE analysis, read connections or execute commit';
END $test$;
RESET ROLE;

SET ROLE anon;
DO $test$
DECLARE denied boolean:=false; n integer;
BEGIN
 BEGIN
  SELECT count(*) INTO n FROM public.run_race_analysis;
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'anon could SELECT analysis'; END IF;
 denied:=false;
 BEGIN
  PERFORM public.garmin_commit_activity(1::bigint,1,'{}'::jsonb,null::jsonb);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'anon could EXECUTE commit'; END IF;
 RAISE NOTICE 'PASS anon cannot read analysis or invoke commit RPC';
END $test$;
RESET ROLE;

-- Service-role bypasses RLS, may write analysis, and invokes the REAL RPC.
SET ROLE service_role;
DO $test$
DECLARE n integer; result text; receipt bigint;
BEGIN
 SELECT count(*) INTO n FROM public.run_race_analysis;
 IF n<>2 THEN RAISE EXCEPTION 'service role read expected 2, got %',n; END IF;
 INSERT INTO public.garmin_activity_inbox(
  user_id,garmin_user_id,connection_version,state,attempts,payload)
 VALUES ('00000000-0000-4000-8000-000000000001','ci-garmin',
  '00000000-0000-4000-8000-000000000002','processing',1,'{}'::jsonb)
 RETURNING id INTO receipt;
 SELECT public.garmin_commit_activity(receipt,1,
  jsonb_build_object(
   'source_external_id','garmin-api:role-rpc',
   'started_at','2026-11-09T00:00:00Z',
   'activity_date','2026-11-09','distance_km',1,
   'name','synthetic-role-rpc','indoor',false,
   'route','[[36.4,139.1],[36.41,139.11]]'::jsonb),
  null::jsonb
 ) INTO result;
 IF result IS DISTINCT FROM 'saved' THEN
  RAISE EXCEPTION 'service role commit expected saved, got %', result;
 END IF;
 SELECT count(*) INTO n FROM public.runs WHERE source_external_id='garmin-api:role-rpc';
 IF n<>1 THEN RAISE EXCEPTION 'service role failed canonical run save'; END IF;
 RAISE NOTICE 'PASS service_role BYPASSRLS actual RPC saved run';
END $test$;
RESET ROLE;

-- Authenticating owner A can soft-delete, and SECURITY DEFINER purges analysis.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
UPDATE public.runs SET deleted_at=clock_timestamp()
 WHERE source_external_id='synthetic-role-A' AND deleted_at IS NULL;
RESET ROLE;
DO $test$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.run_race_analysis a
  JOIN public.runs r ON r.id=a.run_id WHERE r.source_external_id='synthetic-role-A';
 IF n<>0 THEN RAISE EXCEPTION 'authenticated soft delete did not purge analysis'; END IF;
 SELECT count(*) INTO n FROM public.run_race_analysis a
  JOIN public.runs r ON r.id=a.run_id WHERE r.source_external_id='synthetic-role-B';
 IF n<>1 THEN RAISE EXCEPTION 'other owner analysis was altered'; END IF;
 RAISE NOTICE 'PASS authenticated owner soft-delete trigger purged only own analysis';
END $test$;
