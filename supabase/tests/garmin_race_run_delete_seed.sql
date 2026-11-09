-- Synthetic fixture only. A committed Garmin run and valid analysis are
-- intentionally created before the competing duplicate commit and delete.
-- The real four-argument RPC is invoked by the competing session.
INSERT INTO public.runs
 (user_id,source,source_external_id,activity_date,started_at,distance_km,name,route)
VALUES
 ('00000000-0000-4000-8000-000000000001','garmin','garmin-api:race-soft',
  '2026-11-09','2026-11-09T00:00:00Z',1,'synthetic-soft','[[36.4,139.1],[36.41,139.11]]'::jsonb),
 ('00000000-0000-4000-8000-000000000001','garmin','garmin-api:race-hard',
  '2026-11-09','2026-11-09T00:00:00Z',1,'synthetic-hard','[[36.4,139.1],[36.41,139.11]]'::jsonb);

INSERT INTO public.run_race_analysis
 (user_id,run_id,analysis_version,source_kind,source_connection_version,
 distance_basis,time_basis,sample_count,total_distance_m,total_clock_elapsed_s,
 segments,overall_flags)
SELECT user_id,id,'garmin-activity-details-v1','garmin_activity_details',
 '00000000-0000-4000-8000-000000000002',
 'device_cumulative_m','clock_elapsed_seconds',2,1000,300,
 '[{"segment_index":1,"distance_m":1000}]'::jsonb,'[]'::jsonb
FROM public.runs WHERE source_external_id IN ('garmin-api:race-soft','garmin-api:race-hard');

-- The initial inbox row from reverse_setup is reserved for first case.
INSERT INTO public.garmin_activity_inbox
(user_id,garmin_user_id,connection_version,state,attempts,payload)
VALUES('00000000-0000-4000-8000-000000000001','ci-garmin',
 '00000000-0000-4000-8000-000000000002','processing',1,'{}'::jsonb);
