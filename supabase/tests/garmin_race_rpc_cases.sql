-- Real four-argument RPC execution against isolated CI PostgreSQL.
-- All fixture records are synthetic, no Garmin credentials or actual runner rows.
BEGIN;
DO $tests$
DECLARE
 uid uuid := '00000000-0000-4000-8000-000000000001';
 cversion uuid := '00000000-0000-4000-8000-000000000002';
 candidate jsonb;
 invalid jsonb;
 record jsonb;
 rid bigint;
 outcome text;
 n integer;
 run_count integer;
 analysis_count integer;
 sample_case text;
BEGIN
 candidate := jsonb_build_object(
   'analysis_version','garmin-activity-details-v1',
   'distance_basis','device_cumulative_m',
   'time_basis','clock_elapsed_seconds',
   'accepted_samples',2,
   'total_distance_m',1000,
   'total_clock_elapsed_s',300,
   'quality_flags','[]'::jsonb,
   'segments',jsonb_build_array(jsonb_build_object(
     'segment_index',1,'start_m',0,'end_m',1000,
     'distance_m',1000,'clock_elapsed_s',300,'quality_flags','[]'::jsonb,
     'metrics',jsonb_build_object(
       'heart_rate',jsonb_build_object(
         'source_field','heartRate','raw_unit','bpm','aggregation_method','distance_weighted_linear',
         'covered_distance_m',1000,'coverage_fraction',1,'mean_raw_value',150),
       'cadence',jsonb_build_object(
         'source_field','stepsPerMinute','raw_unit','steps/minute as provided',
         'aggregation_method','distance_weighted_linear','covered_distance_m',0,
         'coverage_fraction',0,'mean_raw_value',null),
       'power',jsonb_build_object(
         'source_field','powerInWatts','raw_unit','W',
         'aggregation_method','distance_weighted_linear','covered_distance_m',0,
         'coverage_fraction',0,'mean_raw_value',null)
     )
   ))
 );
 -- Core F1 regression: missing quality_flags must reject OPTIONAL analysis,
 -- never reject the canonical Garmin run. Other cases pin null/type boundaries.
 FOREACH sample_case IN ARRAY ARRAY[
   'valid','missing_segment_flags','null_segment_flags','missing_top_flags',
   'missing_metric_coverage','missing_metric_mean_key'
 ] LOOP
   CASE sample_case
     WHEN 'missing_segment_flags' THEN
       invalid := candidate #- '{segments,0,quality_flags}';
     WHEN 'null_segment_flags' THEN
       invalid := jsonb_set(candidate,'{segments,0,quality_flags}','null'::jsonb);
     WHEN 'missing_top_flags' THEN
       invalid := candidate - 'quality_flags';
     WHEN 'missing_metric_coverage' THEN
       invalid := candidate #- '{segments,0,metrics,heart_rate,coverage_fraction}';
     WHEN 'missing_metric_mean_key' THEN
       invalid := candidate #- '{segments,0,metrics,heart_rate,mean_raw_value}';
     ELSE invalid := candidate;
   END CASE;
   record:=jsonb_build_object(
     'source_external_id','garmin-api:test-'||sample_case,
     'started_at','2026-11-09T00:00:00Z',
     'activity_date','2026-11-09',
     'distance_km',1,
     'name','synthetic '||sample_case,
     'indoor',false,
     'route','[[36.4,139.1],[36.41,139.11]]'::jsonb
   );
   INSERT INTO public.garmin_activity_inbox(user_id,garmin_user_id,connection_version,state,attempts,payload)
     VALUES(uid,'ci-garmin',cversion,'processing',1,'{}'::jsonb) RETURNING id INTO rid;
   SELECT public.garmin_commit_activity(rid,1,record,invalid) INTO outcome;
   IF outcome IS DISTINCT FROM 'saved' THEN RAISE EXCEPTION 'case % expected saved got %',sample_case,outcome; END IF;
   SELECT count(*) INTO n FROM public.runs WHERE source_external_id=record->>'source_external_id';
   IF n<>1 THEN RAISE EXCEPTION 'case % run missing',sample_case; END IF;
   SELECT count(*) INTO n FROM public.run_race_analysis a
       JOIN public.runs r ON r.id=a.run_id WHERE r.source_external_id=record->>'source_external_id';
   IF (sample_case='valid' AND n<>1) OR (sample_case<>'valid' AND n<>0) THEN
     RAISE EXCEPTION 'case % analysis count % mismatch',sample_case,n;
   END IF;
   IF EXISTS (SELECT 1 FROM public.garmin_activity_inbox WHERE id=rid AND (state<>'saved' OR payload <> '{}'::jsonb)) THEN
     RAISE EXCEPTION 'case % receipt failed to finalize',sample_case;
   END IF;
   RAISE NOTICE 'PASS F1 case=% outcome=saved optional_analysis_count=%',sample_case,n;
 END LOOP;

 -- Same-Garmin duplicate: cannot attach a candidate to a second receipt.
 INSERT INTO public.garmin_activity_inbox(user_id,garmin_user_id,connection_version,state,attempts,payload)
   VALUES(uid,'ci-garmin',cversion,'processing',1,'{}'::jsonb) RETURNING id INTO rid;
 SELECT public.garmin_commit_activity(rid,1,record,candidate) INTO outcome;
 IF outcome IS DISTINCT FROM 'duplicate' THEN RAISE EXCEPTION 'duplicate returned %',outcome; END IF;
 SELECT count(*) INTO n FROM public.run_race_analysis;
 IF n<>1 THEN RAISE EXCEPTION 'duplicate created extra analysis'; END IF;
 RAISE NOTICE 'PASS duplicate no new analysis';

 -- Stale attempt cannot write a run or analysis, even when owner has export.
 INSERT INTO public.garmin_activity_inbox(user_id,garmin_user_id,connection_version,state,attempts,payload)
   VALUES(uid,'ci-garmin',cversion,'processing',2,'{}'::jsonb) RETURNING id INTO rid;
 record:=jsonb_set(record,'{source_external_id}','"garmin-api:stale-attempt"'::jsonb);
 SELECT public.garmin_commit_activity(rid,1,record,candidate) INTO outcome;
 IF outcome IS DISTINCT FROM 'stale' THEN RAISE EXCEPTION 'stale attempt returned %',outcome; END IF;
 IF EXISTS(SELECT 1 FROM public.runs WHERE source_external_id='garmin-api:stale-attempt') THEN
   RAISE EXCEPTION 'stale attempt inserted run';
 END IF;
 IF EXISTS(SELECT 1 FROM public.garmin_activity_inbox WHERE id=rid AND state<>'processing') THEN
   RAISE EXCEPTION 'stale attempt mutated receipt';
 END IF;
 SELECT count(*) INTO n FROM public.run_race_analysis;
 IF n<>1 THEN RAISE EXCEPTION 'stale attempt inserted analysis'; END IF;
 RAISE NOTICE 'PASS stale attempt rejected without modifying receipt or run';

 -- Permission loss: ignored without inserting the run or candidate.
 UPDATE public.garmin_api_connections SET permissions='[]'::jsonb WHERE user_id=uid;
 INSERT INTO public.garmin_activity_inbox(user_id,garmin_user_id,connection_version,state,attempts,payload)
   VALUES(uid,'ci-garmin',cversion,'processing',1,'{}'::jsonb) RETURNING id INTO rid;
 record:=jsonb_set(record,'{source_external_id}','"garmin-api:revoked"'::jsonb);
 SELECT public.garmin_commit_activity(rid,1,record,candidate) INTO outcome;
 IF outcome IS DISTINCT FROM 'ignored' THEN RAISE EXCEPTION 'revoked returned %',outcome; END IF;
 IF EXISTS(SELECT 1 FROM public.runs WHERE source_external_id='garmin-api:revoked') THEN
   RAISE EXCEPTION 'revoked imported run';
 END IF;
 RAISE NOTICE 'PASS permission revoked ignored';
 SELECT count(*) INTO run_count FROM public.runs;
 SELECT count(*) INTO analysis_count FROM public.run_race_analysis;
 IF run_count<>6 OR analysis_count<>1 THEN
   RAISE EXCEPTION 'unexpected final run %, analysis %',run_count,analysis_count;
 END IF;
 RAISE NOTICE 'ALL 9 integration cases passed, 6 canonical runs and 1 analysis';
END $tests$;
ROLLBACK;
