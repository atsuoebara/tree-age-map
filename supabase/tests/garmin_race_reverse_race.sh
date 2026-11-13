#!/usr/bin/env bash
# Reverse race: Garmin commit wins the connection lock; authoritative revoke follows.
# Strictly isolated PostgreSQL database, never production.
set -euo pipefail
if [[ "${PGDATABASE:-}" != "garmin_reverse_ci" || "${PGHOST:-}" != "127.0.0.1" ]]; then
 echo "Refusing non-CI database" >&2; exit 2
fi
psql -X -v ON_ERROR_STOP=1 -f supabase/tests/garmin_race_lifecycle_setup.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/tests/garmin_race_reverse_setup.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/garmin-race-analysis-schema-review.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/garmin-race-analysis-commit-rpc-review.sql
# SQL session A calls actual RPC (run + optional analysis), then holds transaction
# and connection row lock until it commits.
psql -X -v ON_ERROR_STOP=1 <<'SQL' > /tmp/garmin-reverse-save.log 2>&1 &
BEGIN;
SET LOCAL application_name='garmin-ci-save-locker';
DO $body$
DECLARE outcome text;
BEGIN
 SELECT public.garmin_commit_activity(
    (SELECT id FROM public.garmin_activity_inbox LIMIT 1),1,
    jsonb_build_object(
      'source_external_id','garmin-api:reverse-race',
      'started_at','2026-11-09T00:00:00Z','activity_date','2026-11-09',
      'distance_km',1,'name','synthetic-reverse','indoor',false,
      'route','[[36.4,139.1],[36.41,139.11]]'::jsonb),
    jsonb_build_object(
     'analysis_version','garmin-activity-details-v1',
     'distance_basis','device_cumulative_m','time_basis','clock_elapsed_seconds',
     'accepted_samples',2,'total_distance_m',1000,'total_clock_elapsed_s',300,
     'quality_flags','[]'::jsonb,
     'segments',jsonb_build_array(jsonb_build_object(
       'segment_index',1,'start_m',0,'end_m',1000,'distance_m',1000,
       'clock_elapsed_s',300,'quality_flags','[]'::jsonb,
       'metrics',jsonb_build_object(
         'heart_rate',jsonb_build_object('source_field','heartRate','raw_unit','bpm',
           'aggregation_method','distance_weighted_linear','covered_distance_m',1000,
           'coverage_fraction',1,'mean_raw_value',150),
         'cadence',jsonb_build_object('source_field','stepsPerMinute',
           'raw_unit','steps/minute as provided','aggregation_method','distance_weighted_linear',
           'covered_distance_m',0,'coverage_fraction',0,'mean_raw_value',null),
         'power',jsonb_build_object('source_field','powerInWatts','raw_unit','W',
           'aggregation_method','distance_weighted_linear','covered_distance_m',0,
           'coverage_fraction',0,'mean_raw_value',null)
       )
     ))
    )
 ) INTO outcome;
 IF outcome <> 'saved' THEN RAISE EXCEPTION 'expected saved, got %',outcome; END IF;
 IF (SELECT count(*) FROM public.run_race_analysis) <> 1 THEN
  RAISE EXCEPTION 'analysis not created before revocation';
 END IF;
 RAISE NOTICE 'PASS saved before revoke, analysis 1 inside transaction';
END $body$;
SELECT pg_sleep(5);
COMMIT;
SQL
saver=$!
# Real barrier: only proceed after saver reached sleep while holding connection lock.
barrier=0
for i in $(seq 1 100); do
 if [[ "$(psql -XAt -c "SELECT count(*) FROM pg_stat_activity WHERE application_name='garmin-ci-save-locker' AND state='active' AND query LIKE '%pg_sleep(5)%'")" == 1 ]]; then
  barrier=1; break
 fi
 if ! kill -0 "$saver" 2>/dev/null; then cat /tmp/garmin-reverse-save.log; exit 1; fi
 sleep 0.1
done
if [[ "$barrier" != 1 ]]; then echo "Saver barrier not reached" >&2; exit 1; fi
# Session B authoritatively revokes; trigger must purge the just-inserted analysis.
psql -X -v ON_ERROR_STOP=1 <<'SQL' > /tmp/garmin-reverse-revoke.log 2>&1 &
SET application_name='garmin-ci-revoke-waiter';
UPDATE public.garmin_api_connections SET permissions='[]'::jsonb
 WHERE user_id='00000000-0000-4000-8000-000000000001';
SQL
revoker=$!
waited=0
for i in $(seq 1 100); do
 if [[ "$(psql -XAt -c "SELECT count(*) FROM pg_stat_activity WHERE application_name='garmin-ci-revoke-waiter' AND wait_event_type='Lock'")" == 1 ]]; then
  waited=1; break
 fi
 if ! kill -0 "$revoker" 2>/dev/null; then echo "Revocation finished before lock wait" >&2; exit 1; fi
 sleep 0.1
done
if [[ "$waited" != 1 ]]; then echo "No lock wait evidence" >&2; exit 1; fi
echo "PASS observed revoker waiting on saver-held lock"
wait "$saver"; wait "$revoker"
cat /tmp/garmin-reverse-save.log | grep 'PASS saved before revoke'
nrun=$(psql -XAt -c "SELECT count(*) FROM public.runs WHERE source_external_id='garmin-api:reverse-race'")
nanalysis=$(psql -XAt -c "SELECT count(*) FROM public.run_race_analysis")
receipt=$(psql -XAt -c "SELECT state FROM public.garmin_activity_inbox LIMIT 1")
export=$(psql -XAt -c "SELECT public.garmin_has_export(permissions) FROM public.garmin_api_connections LIMIT 1")
if [[ "$nrun" != 1 || "$nanalysis" != 0 || "$receipt" != saved || "$export" != f ]]; then
 echo "FAILED final runs=$nrun analysis=$nanalysis receipt=$receipt export=$export" >&2; exit 1
fi
echo "PASS reverse race: run saved, receipt saved, revoked, analysis purged"
