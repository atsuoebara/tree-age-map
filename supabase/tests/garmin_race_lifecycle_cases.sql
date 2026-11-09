-- All operations run on an isolated disposable PostgreSQL CI container.
-- Each test family uses synthetic UUIDs, no real Garmin users.
BEGIN;
DO $test$
DECLARE
 a uuid := '00000000-0000-4000-8000-000000000001';
 b uuid := '00000000-0000-4000-8000-000000000003';
 v uuid := '00000000-0000-4000-8000-000000000002';
 run_a bigint;
 run_b bigint;
 n integer;
BEGIN
 INSERT INTO public.runs(user_id,source) VALUES(a,'garmin') RETURNING id INTO run_a;
 INSERT INTO public.runs(user_id,source) VALUES(b,'garmin') RETURNING id INTO run_b;
 INSERT INTO public.garmin_api_connections(user_id,garmin_user_id,connection_version,import_enabled,permissions)
 VALUES (a,'A-garmin',v,true,'["ACTIVITY_EXPORT"]'::jsonb),
        (b,'B-garmin',v,true,'["ACTIVITY_EXPORT"]'::jsonb);
 INSERT INTO public.run_race_analysis(
 user_id,run_id,analysis_version,source_kind,source_connection_version,
 distance_basis,time_basis,sample_count,total_distance_m,total_clock_elapsed_s,segments,overall_flags)
 SELECT user_id,id,'garmin-activity-details-v1','garmin_activity_details',v,
 'device_cumulative_m','clock_elapsed_seconds',2,1000,300,
 '[{"segment_index":1,"distance_m":1000}]'::jsonb,'[]'::jsonb
 FROM public.runs WHERE id in (run_a,run_b);
 -- RLS: auth owner A sees A and not B; anon lacks SELECT entirely.
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
 -- Use set role inside DO via execute; role grants must permit authenticated reading of child.
 EXECUTE 'SET LOCAL ROLE authenticated';
 SELECT count(*) INTO n FROM public.run_race_analysis;
 IF n<>1 THEN RAISE EXCEPTION 'RLS owner count expected 1, got %', n; END IF;
 EXECUTE 'RESET ROLE';
 RAISE NOTICE 'PASS owner A SELECT sees only 1 own row';
 -- Soft delete performed by authenticated owner, should trigger SECURITY DEFINER purge.
 EXECUTE 'SET LOCAL ROLE authenticated';
 UPDATE public.runs SET deleted_at=now() WHERE id=run_a;
 IF NOT FOUND THEN RAISE EXCEPTION 'owner soft delete did not update'; END IF;
 EXECUTE 'RESET ROLE';
 SELECT count(*) INTO n FROM public.run_race_analysis WHERE run_id=run_a;
 IF n<>0 THEN RAISE EXCEPTION 'soft delete failed to purge analysis'; END IF;
 RAISE NOTICE 'PASS authenticated soft delete immediately purged analysis';
 -- The other account remains intact.
 SELECT count(*) INTO n FROM public.run_race_analysis WHERE run_id=run_b;
 IF n<>1 THEN RAISE EXCEPTION 'cross-owner row unexpectedly deleted'; END IF;
 -- Physical DELETE cascades through composite FK.
 DELETE FROM public.runs WHERE id=run_b;
 SELECT count(*) INTO n FROM public.run_race_analysis WHERE run_id=run_b;
 IF n<>0 THEN RAISE EXCEPTION 'physical delete failed to cascade'; END IF;
 RAISE NOTICE 'PASS physical delete cascade and owner isolation';
END $test$;
ROLLBACK;

-- Isolated fixture for each connection terminal transition.
DO $test$
DECLARE
 a uuid := '00000000-0000-4000-8000-000000000001';
 v uuid := '00000000-0000-4000-8000-000000000002';
 idx integer;
 case_name text;
 r bigint;
 n integer;
BEGIN
 FOREACH case_name IN ARRAY ARRAY['disable','revoke','version_change','garmin_id_change','disconnect'] LOOP
  INSERT INTO public.runs(user_id,source) VALUES(a,'garmin') RETURNING id INTO r;
  INSERT INTO public.garmin_api_connections(user_id,garmin_user_id,connection_version,import_enabled,permissions)
   VALUES(a,'A-garmin',v,true,'["ACTIVITY_EXPORT"]'::jsonb);
  INSERT INTO public.run_race_analysis(user_id,run_id,analysis_version,source_kind,source_connection_version,
    distance_basis,time_basis,sample_count,total_distance_m,total_clock_elapsed_s,segments,overall_flags)
   VALUES(a,r,'garmin-activity-details-v1','garmin_activity_details',v,
     'device_cumulative_m','clock_elapsed_seconds',2,1000,300,
     '[{"segment_index":1,"distance_m":1000}]'::jsonb,'[]'::jsonb);
  CASE case_name
   WHEN 'disable' THEN UPDATE public.garmin_api_connections SET import_enabled=false WHERE user_id=a;
   WHEN 'revoke' THEN UPDATE public.garmin_api_connections SET permissions='[]'::jsonb WHERE user_id=a;
   WHEN 'version_change' THEN UPDATE public.garmin_api_connections
      SET connection_version='00000000-0000-4000-8000-000000000004' WHERE user_id=a;
   WHEN 'garmin_id_change' THEN UPDATE public.garmin_api_connections SET garmin_user_id='other' WHERE user_id=a;
   WHEN 'disconnect' THEN DELETE FROM public.garmin_api_connections WHERE user_id=a;
  END CASE;
  SELECT count(*) INTO n FROM public.run_race_analysis WHERE run_id=r;
  IF n<>0 THEN RAISE EXCEPTION 'case % failed analysis purge',case_name; END IF;
  SELECT count(*) INTO n FROM public.runs WHERE id=r;
  IF n<>1 THEN RAISE EXCEPTION 'case % wrongly deleted canonical run',case_name; END IF;
  DELETE FROM public.garmin_api_connections WHERE user_id=a;
  DELETE FROM public.runs WHERE id=r;
  RAISE NOTICE 'PASS connection case % analysis purged, run preserved',case_name;
 END LOOP;
END $test$;
