#!/usr/bin/env bash
set -euo pipefail
[[ "${PGHOST:-}" == 127.0.0.1 && "${PGDATABASE:-}" == garmin_probe_ci ]] || {
 echo 'Refusing non-isolated database' >&2; exit 1;
}
export PGOPTIONS="-c statement_timeout=12000 -c lock_timeout=9000"
P=(psql -X -qAt -v ON_ERROR_STOP=1)
q(){ "${P[@]}" -c "$1"; }
A=00000000-0000-0000-0000-0000000000a1
B=00000000-0000-0000-0000-0000000000b2
OLD=10000000-0000-0000-0000-000000000001
NEW=10000000-0000-0000-0000-000000000002
LEASE1=30000000-0000-0000-0000-000000000001
LEASE2=30000000-0000-0000-0000-000000000002
ATTEMPT1=40000000-0000-0000-0000-000000000001
ATTEMPT2=40000000-0000-0000-0000-000000000002
temp=$(mktemp -d)
cleanup(){ rm -rf "$temp"; q 'drop schema if exists consent_lease_ci cascade;' >/dev/null || :; }
trap cleanup EXIT
"${P[@]}" -f supabase/tests/garmin_consent_lease_recovery_setup.sql >/dev/null
reset(){
 q "update consent_lease_ci.owner_state set generation='$OLD',phase='connected',import_enabled=true,pending_generation=NULL,lease_token=NULL,attempt_id=NULL,lease_deadline=NULL where owner_id='$A';" >/dev/null
}
deadline="clock_timestamp()+interval '2 minutes'"
check_b(){
 q "select phase='connected' and import_enabled from consent_lease_ci.owner_state where owner_id='$B';" | grep -qx t
}
# Case A: crash before claim COMMIT. The claim must rollback; next worker can claim.
q "select consent_lease_ci.disconnect('$A','$OLD');" | grep -qx t
("${P[@]}" -c "begin; select consent_lease_ci.claim('$A','$OLD','$LEASE1','$ATTEMPT1',$deadline); select pg_sleep(0.7); rollback;" > "$temp/crash") &
crashed=$!
sleep 0.15
("${P[@]}" -c "select consent_lease_ci.claim('$A','$OLD','$LEASE2','$ATTEMPT2',$deadline);" > "$temp/restart") &
restart=$!
wait "$crashed";wait "$restart"
grep -qx t <(sed -n '1p' "$temp/crash")
grep -qx t "$temp/restart"
q "select lease_token='$LEASE2' and attempt_id='$ATTEMPT2' and phase='revoke_inflight' from consent_lease_ci.owner_state where owner_id='$A';" | grep -qx t
# Old claimant cannot complete new attempt.
q "select consent_lease_ci.complete('$A','$OLD','$LEASE1','$ATTEMPT1');" | grep -qx f
q "select consent_lease_ci.complete('$A','$OLD','$LEASE2','$ATTEMPT1');" | grep -qx f
q "select consent_lease_ci.complete('$A','$OLD','$LEASE2','$ATTEMPT2');" | grep -qx t
q "select phase='disconnected' and not import_enabled from consent_lease_ci.owner_state where owner_id='$A';" | grep -qx t
# Case B: claim COMMITTED then worker crashes before recording provider outcome.
# Even when lease expires, the remote DELETE may already have reached Garmin.
reset
q "select consent_lease_ci.disconnect('$A','$OLD');" | grep -qx t
q "select consent_lease_ci.claim('$A','$OLD','$LEASE1','$ATTEMPT1',$deadline);" | grep -qx t
# A callback during inflight registers only pending consent.
q "select consent_lease_ci.reauthorize('$A','$NEW');" | grep -qx t
q "select consent_lease_ci.expire('$A','$OLD','$LEASE1','$ATTEMPT1',clock_timestamp());" | grep -qx f
q "select consent_lease_ci.expire('$A','$OLD','$LEASE1','$ATTEMPT1',clock_timestamp()+interval '3 minutes');" | grep -qx t
q "select phase='revoke_unknown' and not import_enabled and pending_generation='$NEW' and lease_token is null from consent_lease_ci.owner_state where owner_id='$A';" | grep -qx t
# No silent reissue, no stale completion, and no stale generation promotion.
q "select consent_lease_ci.claim('$A','$OLD','$LEASE2','$ATTEMPT2',$deadline);" | grep -qx f
q "select consent_lease_ci.complete('$A','$OLD','$LEASE1','$ATTEMPT1');" | grep -qx f
q "select consent_lease_ci.reauthorize('$A','$NEW');" | grep -qx t
q "select phase='revoke_unknown' and not import_enabled and generation='$OLD' from consent_lease_ci.owner_state where owner_id='$A';" | grep -qx t
check_b
# Case C: two workers contend for single claim.
reset
q "select consent_lease_ci.disconnect('$A','$OLD');" | grep -qx t
("${P[@]}" -c "begin; select consent_lease_ci.claim('$A','$OLD','$LEASE1','$ATTEMPT1',$deadline); select pg_sleep(0.7); commit;" > "$temp/first") &
first=$!
sleep 0.15
("${P[@]}" -c "select consent_lease_ci.claim('$A','$OLD','$LEASE2','$ATTEMPT2',$deadline);" > "$temp/second") &
second=$!
wait "$first";wait "$second"
grep -qx t <(sed -n '1p' "$temp/first")
grep -qx f "$temp/second"
q "select lease_token='$LEASE1' and attempt_id='$ATTEMPT1' from consent_lease_ci.owner_state where owner_id='$A';" | grep -qx t
# Case D: owner with fresh generation cannot be affected by stale old claim.
reset
q "select consent_lease_ci.reauthorize('$A','$NEW');" | grep -qx t
q "select consent_lease_ci.disconnect('$A','$OLD');" | grep -qx f
q "select consent_lease_ci.claim('$A','$OLD','$LEASE1','$ATTEMPT1',$deadline);" | grep -qx f
q "select generation='$NEW' and import_enabled and phase='connected' from consent_lease_ci.owner_state where owner_id='$A';" | grep -qx t
check_b
echo 'Garmin isolated owner lease: claim crash rollback, expiry UNKNOWN, stale completion, two-worker contention, new consent PASS'
