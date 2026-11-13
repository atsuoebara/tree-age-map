#!/usr/bin/env bash
set -euo pipefail
: "${PGHOST:?Missing host}" "${PGDATABASE:?Missing database}"
[[ "$PGHOST" == "127.0.0.1" && "$PGDATABASE" == "garmin_probe_ci" ]] || { echo "Refusing non-isolated DB" >&2; exit 1; }
export PGOPTIONS="-c statement_timeout=5000"
PSQL=(psql -X -qAt -v ON_ERROR_STOP=1)
"${PSQL[@]}" -f supabase/tests/garmin_shape_one_shot_setup.sql >/dev/null
function q(){ "${PSQL[@]}" -c "$1"; }
# Use the same synthetic DB row, two independent psql sessions in parallel.
q "select probe_ci.claim('wrong-owner','synthetic-v1','00000000-0000-0000-0000-000000000001');" | grep -qx f
q "select probe_ci.claim('synthetic-owner','wrong-generation','00000000-0000-0000-0000-000000000001');" | grep -qx f
for n in $(seq 1 20); do
  ("${PSQL[@]}" -c "select probe_ci.claim('synthetic-owner','synthetic-v1','00000000-0000-0000-0000-000000000001');" >"/tmp/probe_claim_one_$n") &
done
wait
success=0
for n in $(seq 1 20); do
 [[ "$(cat "/tmp/probe_claim_one_$n")" == t ]] && success=$((success+1))
 rm -f "/tmp/probe_claim_one_$n"
done
[[ "$success" -eq 1 ]] || { echo "Expected one claim, got $success" >&2; exit 1; }
q "select state from probe_ci.one_shot where id=1;" | grep -qx claimed
q "select probe_ci.finish('synthetic-owner','synthetic-v1','00000000-0000-0000-0000-000000000002','{\"activityCount\":1,\"sampleCount\":10}'::jsonb);" | grep -qx f
q "select probe_ci.finish('synthetic-owner','synthetic-v1','00000000-0000-0000-0000-000000000001','{\"activityCount\":1,\"sampleCount\":10,\"userId\":\"secret\"}'::jsonb);" | grep -qx f
q "select probe_ci.finish('synthetic-owner','synthetic-v1','00000000-0000-0000-0000-000000000001','{\"activityCount\":1,\"sampleCount\":10}'::jsonb);" | grep -qx t
q "select probe_ci.finish('synthetic-owner','synthetic-v1','00000000-0000-0000-0000-000000000001','{\"activityCount\":1,\"sampleCount\":10}'::jsonb);" | grep -qx f
q "select state from probe_ci.one_shot where id=1;" | grep -qx finished
# Expired lease: claim and finish both refused. No clock spoof input.
q "update probe_ci.one_shot set state='eligible',claim_token=null,result_counts=null,expires_at=clock_timestamp()-interval '1 second',activated_at=clock_timestamp()-interval '1 minute';" >/dev/null
q "select probe_ci.claim('synthetic-owner','synthetic-v1','00000000-0000-0000-0000-000000000001');" | grep -qx f
q "update probe_ci.one_shot set state='claimed',claim_token='00000000-0000-0000-0000-000000000001';" >/dev/null
q "select probe_ci.finish('synthetic-owner','synthetic-v1','00000000-0000-0000-0000-000000000001','{\"activityCount\":1,\"sampleCount\":10}'::jsonb);" | grep -qx f
# Revocation beats completion; old generation cannot recover.
q "update probe_ci.one_shot set state='revoked',result_counts=null,expires_at=clock_timestamp()+interval '1 minute',connection_version='synthetic-v2';" >/dev/null
q "select probe_ci.finish('synthetic-owner','synthetic-v1','00000000-0000-0000-0000-000000000001','{\"activityCount\":1,\"sampleCount\":10}'::jsonb);" | grep -qx f
q "select result_counts is null from probe_ci.one_shot where id=1;" | grep -qx t
echo "Isolated PostgreSQL one-shot: 20 competing clients, expiry, revoke, token binding, aggregate-only result PASS"
