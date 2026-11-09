#!/usr/bin/env bash
# Two-session run deletion vs duplicate Garmin commit; isolated PostgreSQL ONLY.
set -euo pipefail
if [[ "${PGDATABASE:-}" != "garmin_run_delete_ci" || "${PGHOST:-}" != "127.0.0.1" ]]; then
 echo "Refusing any non-CI PostgreSQL target" >&2; exit 2
fi
psql -X -v ON_ERROR_STOP=1 -f supabase/tests/garmin_race_lifecycle_setup.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/tests/garmin_race_reverse_setup.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/garmin-race-analysis-schema-review.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/garmin-race-analysis-commit-rpc-review.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/tests/garmin_race_run_delete_seed.sql
for kind in soft hard; do
  receipt=1
  if [[ "$kind" == hard ]]; then receipt=2; fi
  # Session A exercises the actual RPC duplicate path, then holds its transaction
  # and connection row lock. The duplicate path does NOT lock canonical run rows.
  psql -X -v ON_ERROR_STOP=1 -v kind="$kind" -v receipt="$receipt" <<'SQL' > "/tmp/garmin-run-${kind}-commit.log" 2>&1 &
BEGIN;
SELECT set_config('application_name','garmin-ci-duplicate-:kind',true);
DO $test$
DECLARE result text;
BEGIN
 SELECT public.garmin_commit_activity(
    :receipt,1,
    jsonb_build_object(
      'source_external_id','garmin-api::kind',
      'started_at','2026-11-09T00:00:00Z',
      'activity_date','2026-11-09','distance_km',1,
      'name','synthetic','indoor',false,
      'route','[[36.4,139.1],[36.41,139.11]]'::jsonb
    ),null::jsonb
  ) INTO result;
 IF result IS DISTINCT FROM 'duplicate' THEN
    RAISE EXCEPTION 'expected duplicate, got %',result;
 END IF;
 RAISE NOTICE 'PASS :kind duplicate RPC completed before delete';
END $test$;
SELECT pg_sleep(5);
COMMIT;
SQL
  saver=$!
  barrier=0
  for i in $(seq 1 100); do
    if [[ "$(psql -XAt -c "SELECT count(*) FROM pg_stat_activity WHERE application_name='garmin-ci-duplicate-$kind' AND state='active' AND query LIKE '%pg_sleep(5)%'")" == 1 ]]; then
      barrier=1; break
    fi
    if ! kill -0 "$saver" 2>/dev/null; then cat "/tmp/garmin-run-${kind}-commit.log"; exit 1; fi
    sleep 0.1
  done
  if [[ "$barrier" != 1 ]]; then echo "RPC barrier missing for $kind" >&2; cat "/tmp/garmin-run-${kind}-commit.log"; exit 1; fi

  # Session B deletes the previously committed canonical run while A is open.
  # This path must remove analysis immediately without depending on A's
  # connection row lock. A has already finished duplicate detection.
  if [[ "$kind" == soft ]]; then
    psql -XAt -v ON_ERROR_STOP=1 -c "
      UPDATE public.runs SET deleted_at=clock_timestamp()
      WHERE source_external_id='garmin-api:race-soft' AND deleted_at IS NULL
      RETURNING id" > "/tmp/garmin-run-${kind}-deleted"
  else
    psql -XAt -v ON_ERROR_STOP=1 -c "
      DELETE FROM public.runs
      WHERE source_external_id='garmin-api:race-hard'
      RETURNING id" > "/tmp/garmin-run-${kind}-deleted"
  fi
  if [[ "$(wc -l < "/tmp/garmin-run-${kind}-deleted")" != 1 ]]; then
    echo "Expected exactly one $kind deleted run"; exit 1
  fi
  if ! kill -0 "$saver" 2>/dev/null; then
    echo "Saver already finished before delete: concurrency unproven"; exit 1
  fi
  # The two transactions overlapped; DELETE/soft-delete won before A committed.
  wait "$saver"
  rid=$(psql -XAt -c "SELECT state FROM public.garmin_activity_inbox WHERE id=$receipt")
  remain=$(psql -XAt -c "
    SELECT count(*) FROM public.run_race_analysis a
    JOIN public.runs r ON r.id=a.run_id
    WHERE r.source_external_id='garmin-api:race-$kind'")
  if [[ "$remain" != 0 || "$rid" != duplicate ]]; then
    echo "Unexpected after $kind: analysis=$remain receipt=$rid"; exit 1
  fi
  if [[ "$kind" == soft ]]; then
    kept=$(psql -XAt -c "SELECT count(*) FROM public.runs
      WHERE source_external_id='garmin-api:race-soft' AND deleted_at IS NOT NULL")
    [[ "$kept" == 1 ]] || { echo "Soft deleted run not retained"; exit 1; }
  else
    removed=$(psql -XAt -c "SELECT count(*) FROM public.runs
      WHERE source_external_id='garmin-api:race-hard'")
    [[ "$removed" == 0 ]] || { echo "Hard-deleted run remains"; exit 1; }
  fi
  echo "PASS $kind delete overlapped real duplicate RPC; no analysis resurrected"
done
# Soft deleted IDs retain a deduplication tombstone; hard deletion does not.
# Do not claim physical hard deletion prevents a later fresh redelivery.
echo "PASS two real overlapping duplicate-commit/delete test orderings"
