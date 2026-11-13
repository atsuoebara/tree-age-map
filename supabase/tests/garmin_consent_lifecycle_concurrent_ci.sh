#!/usr/bin/env bash
set -euo pipefail
[[ "${PGHOST:-}" == "127.0.0.1" && "${PGDATABASE:-}" == "garmin_probe_ci" ]] || { echo 'Refusing non-isolated database' >&2; exit 1; }
export PGOPTIONS="-c statement_timeout=12000 -c lock_timeout=9000"
P=(psql -X -qAt -v ON_ERROR_STOP=1)
q(){ "${P[@]}" -c "$1"; }
A=00000000-0000-0000-0000-0000000000a1
B=00000000-0000-0000-0000-0000000000b2
OLD=10000000-0000-0000-0000-000000000001
NEW=10000000-0000-0000-0000-000000000002
NEWER=10000000-0000-0000-0000-000000000003
cleanup(){ q 'drop schema if exists consent_ci cascade;' >/dev/null || :; rm -f /tmp/rr_consent_lock_first /tmp/rr_consent_second; }
trap cleanup EXIT
"${P[@]}" -f supabase/tests/garmin_consent_lifecycle_concurrent_setup.sql >/dev/null
reset(){
 q "update consent_ci.lifecycle set generation='$OLD',state='connected',can_import=true,pending_generation=NULL where owner_id='$A';" >/dev/null
}
check_pending(){
 q "select state='revoke_inflight' and not can_import and generation='$OLD' and pending_generation='$NEW' from consent_ci.lifecycle where owner_id='$A';" | grep -qx t
 q "select state='connected' and can_import from consent_ci.lifecycle where owner_id='$B';" | grep -qx t
}
# Case 1: revoke-start transaction takes owner lock; new callback waits and is queued.
reset
q "select consent_ci.apply('$A','$OLD','disconnect');" | grep -qx t
("${P[@]}" -c "begin; select consent_ci.apply('$A','$OLD','begin_revoke'); select pg_sleep(0.8); commit;" > /tmp/rr_consent_lock_first) &
first=$!
sleep 0.2
("${P[@]}" -c "select consent_ci.apply('$A','$OLD','reauthorize','$NEW');" > /tmp/rr_consent_second) &
second=$!
wait "$first";wait "$second"
grep -qx t <(sed -n '1p' /tmp/rr_consent_lock_first)
grep -qx t /tmp/rr_consent_second
check_pending
# Case 2: callback queues a new grant first; begin_revoke waits and retains the queue.
reset
q "select consent_ci.apply('$A','$OLD','disconnect');" | grep -qx t
("${P[@]}" -c "begin; select consent_ci.apply('$A','$OLD','reauthorize','$NEW'); select pg_sleep(0.8); commit;" > /tmp/rr_consent_lock_first) &
first=$!
sleep 0.2
("${P[@]}" -c "select consent_ci.apply('$A','$OLD','begin_revoke');" > /tmp/rr_consent_second) &
second=$!
wait "$first";wait "$second"
grep -qx t <(sed -n '1p' /tmp/rr_consent_lock_first)
grep -qx t /tmp/rr_consent_second
check_pending
# Case 3: remote timeout is UNKNOWN, a subsequent authenticated grant must not enable import.
q "select consent_ci.apply('$A','$OLD','revoke_timeout');" | grep -qx t
q "select consent_ci.apply('$A','$OLD','reauthorize','$NEWER');" | grep -qx t
q "select state='revoke_unknown' and not can_import and pending_generation='$NEWER' from consent_ci.lifecycle where owner_id='$A';" | grep -qx t
q "select consent_ci.apply('$A','$NEWER','revoke_confirmed');" | grep -qx f
q "select consent_ci.apply('$A','$OLD','retry_revoke');" | grep -qx t
q "select consent_ci.apply('$A','$OLD','revoke_confirmed');" | grep -qx t
q "select state='disconnected' and not can_import and pending_generation is null from consent_ci.lifecycle where owner_id='$A';" | grep -qx t
q "select consent_ci.apply('$A','$OLD','reauthorize','$NEWER');" | grep -qx t
q "select state='connected' and generation='$NEWER' and can_import from consent_ci.lifecycle where owner_id='$A';" | grep -qx t
q "select consent_ci.apply('$A','$OLD','disconnect');" | grep -qx f
# Case 4: simulated worker crash prior to COMMIT rolls back state and retains safety.
reset
q "select consent_ci.apply('$A','$OLD','disconnect');" | grep -qx t
("${P[@]}" -c "begin; select consent_ci.apply('$A','$OLD','begin_revoke'); select pg_sleep(0.8); rollback;" > /tmp/rr_consent_lock_first) &
first=$!
sleep 0.2
("${P[@]}" -c "select consent_ci.apply('$A','$OLD','reauthorize','$NEW');" > /tmp/rr_consent_second) &
second=$!
wait "$first";wait "$second"
grep -qx t /tmp/rr_consent_second
q "select state='disconnect_requested' and not can_import and generation='$OLD' and pending_generation='$NEW' from consent_ci.lifecycle where owner_id='$A';" | grep -qx t
q "select consent_ci.apply('$A','$OLD','begin_revoke');" | grep -qx t
check_pending
echo 'Garmin isolated PostgreSQL consent lifecycle concurrent ordering/timeout/rollback PASS'
