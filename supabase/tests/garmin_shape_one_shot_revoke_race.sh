#!/usr/bin/env bash
set -euo pipefail
: "${PGHOST:?}" "${PGDATABASE:?}"
[[ "$PGHOST" == "127.0.0.1" && "$PGDATABASE" == "garmin_probe_ci" ]] || { echo "Refusing non-isolated DB" >&2; exit 1; }
export PGOPTIONS="-c statement_timeout=10000 -c lock_timeout=8000"
PSQL=(psql -X -qAt -v ON_ERROR_STOP=1)
q() { "${PSQL[@]}" -c "$1"; }
q "select to_regclass('probe_ci.one_shot') is not null;" | grep -qx t
reset_claimed() {
 q "update probe_ci.one_shot set state='claimed', claim_token='00000000-0000-0000-0000-000000000001',connection_version='synthetic-v1',result_counts=null,activated_at=clock_timestamp()-interval '1 minute',expires_at=clock_timestamp()+interval '2 minutes' where id=1;" >/dev/null
}
check_revoked() {
 q "select (state='revoked' and result_counts is null and claim_token is null and connection_version='revoked-generation') from probe_ci.one_shot where id=1;" | grep -qx t
}
# Case A: finish obtains the row lock first; revoke must wait and erase its result.
reset_claimed
("${PSQL[@]}" -c "begin; select 1 from probe_ci.one_shot where id=1 for update; select probe_ci.finish('synthetic-owner','synthetic-v1','00000000-0000-0000-0000-000000000001','{\"activityCount\":1,\"sampleCount\":10}'::jsonb); select pg_sleep(1); commit;" > /tmp/probe_finish_first.txt) &
first=$!
sleep 0.25
("${PSQL[@]}" -c "select probe_ci.revoke('synthetic-owner','synthetic-v1');" > /tmp/probe_revoke_second.txt) &
second=$!
wait "$first"; wait "$second"
grep -qx t <(sed -n '2p' /tmp/probe_finish_first.txt)
grep -qx t /tmp/probe_revoke_second.txt
check_revoked
# Case B: revoke locks the row first; finish cannot succeed after revocation.
reset_claimed
("${PSQL[@]}" -c "begin; select 1 from probe_ci.one_shot where id=1 for update; select probe_ci.revoke('synthetic-owner','synthetic-v1'); select pg_sleep(1); commit;" > /tmp/probe_revoke_first.txt) &
first=$!
sleep 0.25
("${PSQL[@]}" -c "select probe_ci.finish('synthetic-owner','synthetic-v1','00000000-0000-0000-0000-000000000001','{\"activityCount\":1,\"sampleCount\":10}'::jsonb);" > /tmp/probe_finish_second.txt) &
second=$!
wait "$first"; wait "$second"
grep -qx t <(sed -n '2p' /tmp/probe_revoke_first.txt)
grep -qx f /tmp/probe_finish_second.txt
check_revoked
# Completed result must be deleted on revocation. Wrong generation cannot revoke a newer one.
reset_claimed
q "select probe_ci.finish('synthetic-owner','synthetic-v1','00000000-0000-0000-0000-000000000001','{\"activityCount\":1,\"sampleCount\":10}'::jsonb);" | grep -qx t
q "select probe_ci.revoke('synthetic-owner','wrong-generation');" | grep -qx f
q "select result_counts is not null from probe_ci.one_shot where id=1;" | grep -qx t
q "select probe_ci.revoke('synthetic-owner','synthetic-v1');" | grep -qx t
check_revoked
rm -f /tmp/probe_finish_first.txt /tmp/probe_revoke_second.txt /tmp/probe_revoke_first.txt /tmp/probe_finish_second.txt
echo "Isolated PostgreSQL finish/revoke two-order race and completed-result erasure PASS"
