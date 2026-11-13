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
other=20000000-0000-0000-0000-000000000001
tmp=$(mktemp -d)
cleanup(){ rm -rf "$tmp"; q 'drop schema if exists consent_ci cascade;' >/dev/null || :; }
trap cleanup EXIT
"${P[@]}" -f supabase/tests/garmin_consent_lifecycle_concurrent_setup.sql >/dev/null
reset(){
 q "update consent_ci.lifecycle set generation='$OLD',state='connected',pending_generation=NULL,can_import=true where owner_id='$A';" >/dev/null
}
check(){
 q "select (generation='$OLD' and state='revoke_inflight' and pending_generation='$NEW' and not can_import) from consent_ci.lifecycle where owner_id='$A';" | grep -qx t
 q "select (generation='$other' and state='connected' and can_import) from consent_ci.lifecycle where owner_id='$B';" | grep -qx t
}
# Three independent backends: manual disconnect, callback, and Push worker.
# Case A: manual disconnect obtains owner lock first, callback queues grant,
# worker sees disconnected-requested state and starts remote revoke.
reset
("${P[@]}" -c "begin; select consent_ci.apply('$A','$OLD','disconnect'); select pg_sleep(0.65); commit;" > "$tmp/manual") &
m=$!
sleep 0.15
("${P[@]}" -c "select consent_ci.apply('$A','$OLD','reauthorize','$NEW');" > "$tmp/callback") &
c=$!
sleep 0.15
("${P[@]}" -c "select consent_ci.apply('$A','$OLD','begin_revoke');" > "$tmp/worker") &
w=$!
wait "$m";wait "$c";wait "$w"
grep -qx t <(sed -n '1p' "$tmp/manual")
grep -qx t "$tmp/callback"
grep -qx t "$tmp/worker"
check
# Simulate stale worker's grant/cleanup after remote HTTP response. It must
# not promote pending consent; only a later explicit reauth can connect.
q "select consent_ci.apply('$A','$OLD','revoke_confirmed');" | grep -qx t
q "select (state='disconnected' and pending_generation is null and not can_import) from consent_ci.lifecycle where owner_id='$A';" | grep -qx t
q "select consent_ci.apply('$A','$OLD','reauthorize','$NEW');" | grep -qx t
q "select (state='connected' and generation='$NEW' and can_import) from consent_ci.lifecycle where owner_id='$A';" | grep -qx t
q "select consent_ci.apply('$A','$OLD','revoke_confirmed');" | grep -qx f
# Case B: callback commits new generation BEFORE manual disconnect acquires
# the lock. A generation-fenced old manual operation and old worker both fail.
reset
("${P[@]}" -c "begin; select consent_ci.apply('$A','$OLD','reauthorize','$NEW'); select pg_sleep(0.65); commit;" > "$tmp/callback") &
c=$!
sleep 0.15
("${P[@]}" -c "select consent_ci.apply('$A','$OLD','disconnect');" > "$tmp/manual") &
m=$!
sleep 0.15
("${P[@]}" -c "select consent_ci.apply('$A','$OLD','begin_revoke');" > "$tmp/worker") &
w=$!
wait "$c";wait "$m";wait "$w"
grep -qx t <(sed -n '1p' "$tmp/callback")
grep -qx f "$tmp/manual"
grep -qx f "$tmp/worker"
q "select (state='connected' and generation='$NEW' and can_import) from consent_ci.lifecycle where owner_id='$A';" | grep -qx t
# Case C: remote outcome unknown. Callback must not publish a new connection;
# worker retry is permitted for old generation only.
reset
q "select consent_ci.apply('$A','$OLD','disconnect');" | grep -qx t
q "select consent_ci.apply('$A','$OLD','begin_revoke');" | grep -qx t
q "select consent_ci.apply('$A','$OLD','revoke_timeout');" | grep -qx t
("${P[@]}" -c "begin; select consent_ci.apply('$A','$OLD','reauthorize','$NEW'); select pg_sleep(0.65); commit;" > "$tmp/callback") &
c=$!
sleep 0.15
("${P[@]}" -c "select consent_ci.apply('$A','$OLD','retry_revoke');" > "$tmp/worker") &
w=$!
wait "$c";wait "$w"
grep -qx t <(sed -n '1p' "$tmp/callback")
grep -qx t "$tmp/worker"
check
q "select consent_ci.apply('$A','$NEW','revoke_confirmed');" | grep -qx f
q "select consent_ci.apply('$A','$OLD','revoke_confirmed');" | grep -qx t
q "select (state='disconnected' and not can_import and pending_generation is null) from consent_ci.lifecycle where owner_id='$A';" | grep -qx t
echo 'Three-actor isolated Garmin consent race PASS: manual/callback/worker and unknown-revoke paths'
