#!/usr/bin/env bash
# Isolated PostgreSQL concurrency assertion; never call against production.
set -euo pipefail
: "${PGDATABASE:?PGDATABASE required}"
if [[ "$PGDATABASE" != garmin_concurrency_ci ]]; then
  echo "Refusing to run outside garmin_concurrency_ci" >&2; exit 2
fi
psql -X -v ON_ERROR_STOP=1 -f supabase/tests/garmin_race_rpc_setup.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/garmin-race-analysis-commit-rpc-review.sql
psql -X -v ON_ERROR_STOP=1 -f supabase/tests/garmin_race_concurrency_setup.sql
# Session A holds connection row, revokes permission and commits after sleep.
psql -X -v ON_ERROR_STOP=1 <<'SQL' > /tmp/garmin-concurrent-disconnect.log 2>&1 &
BEGIN;
SET LOCAL application_name='garmin-ci-revoke-locker';
UPDATE public.garmin_api_connections SET permissions='[]'::jsonb
 WHERE user_id='00000000-0000-4000-8000-000000000001';
SELECT pg_sleep(4);
COMMIT;
SQL
locker=$!
# Ensure the row is actually locked before starting commit.
for i in $(seq 1 80); do
  if psql -XAt -c "select count(*) from pg_stat_activity where application_name='garmin-ci-revoke-locker' and state='active' and query like '%pg_sleep%' " | grep -qx 1; then
    break
  fi
  sleep 0.1
done
start=$(date +%s)
result=$(psql -XAt -v ON_ERROR_STOP=1 -c "
  select public.garmin_commit_activity(
    (select id from public.garmin_activity_inbox limit 1),1,
    jsonb_build_object(
     'source_external_id','garmin-api:concurrent-test',
     'started_at','2026-11-09T00:00:00Z','activity_date','2026-11-09',
     'distance_km',1,'name','synthetic','indoor',false,
     'route','[[36.4,139.1],[36.41,139.11]]'::jsonb
    ),
    null::jsonb
  )"
)
wait "$locker"
elapsed=$(($(date +%s)-start))
echo "RPC returned: $result, elapsed seconds: $elapsed"
if [[ "$result" != ignored ]]; then echo "EXPECTED ignored got $result" >&2; exit 1; fi
# No run should be saved after authoritative revocation.
count=$(psql -XAt -c "select count(*) from public.runs where source_external_id='garmin-api:concurrent-test'")
state=$(psql -XAt -c "select state from public.garmin_activity_inbox limit 1")
if [[ "$count" != 0 || "$state" != ignored ]]; then
 echo "BAD after revocation: runs=$count state=$state" >&2; exit 1
fi
if (( elapsed < 1 )); then echo "Commit did not visibly wait for lock" >&2; exit 1; fi
echo "PASS: revoke/commit race: blocked on connection then ignored, no run"
