#!/usr/bin/env bash
# Disposable GitHub Actions PostgreSQL only. No production credentials.
set -euo pipefail
# Never permit accidental execution against a production connection.
[[ "${PGDATABASE:-}" == "b1_bench" && "${PGUSER:-}" == "bench" && "${PGHOST:-}" == "localhost" ]] || {
  echo "ERROR: isolated runner connection required (localhost/bench/b1_bench)"
  exit 1
}
psql -v ON_ERROR_STOP=1 -f docs/b1-public-gate-isolated.sql
scalar() { psql -v ON_ERROR_STOP=1 -Atc "$1"; }
assert_empty() {
  local got
  got="$(scalar "SELECT COALESCE(b1_gate_test.read_value('JP',2026)::text,'NULL')")"
  [[ "$got" == NULL ]] || { echo "FAIL: stale value: $got"; exit 1; }
}
echo "TEST1: withdrawal transaction holds state lock, concurrent reader must wait then return NULL"
# Writer locks the state row, signals when held, then commits after delay.
writerlog="$(mktemp)"; readerlog="$(mktemp)"
psql -v ON_ERROR_STOP=1 -At >"$writerlog" <<'SQL' &
BEGIN;
SET LOCAL application_name='b1_gate_writer';
SELECT b1_gate_test.withdraw();
SELECT pg_sleep(1);
COMMIT;
SQL
writer_pid=$!
# Wait for writer's row lock to be visible, not a guessed sleep.
ready=0
for _ in $(seq 1 100); do
  count="$(scalar "SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND application_name='b1_gate_writer' AND state='active'")"
  if [[ "$count" -ge 1 ]]; then ready=1; break; fi
  sleep 0.02
done
[[ "$ready" -eq 1 ]] || { echo "FAIL: writer not ready"; wait "$writer_pid" || true; exit 1; }
psql -v ON_ERROR_STOP=1 -Atc "SELECT COALESCE(b1_gate_test.read_value('JP',2026)::text,'NULL')" >"$readerlog" &
reader_pid=$!
# Prove the reader actually encountered a PostgreSQL lock, not just a late request.
reader_blocked=0
for _ in $(seq 1 50); do
  blocked="$(scalar "SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%b1_gate_test.read_value%'")"
  if [[ "$blocked" -ge 1 ]]; then reader_blocked=1; break; fi
  sleep 0.02
done
wait "$writer_pid"
wait "$reader_pid"
[[ "$reader_blocked" -eq 1 ]] || { echo "FAIL: concurrent reader lock wait not observed"; exit 1; }
echo "EVIDENCE: reader waited on PostgreSQL Lock during withdrawal"
[[ "$(tail -1 "$readerlog")" == NULL ]] || { echo "FAIL: concurrent reader saw stale value"; cat "$readerlog"; exit 1; }
assert_empty
echo "PASS: concurrent read blocked until revocation commit and returned NULL"

echo "TEST2: reader holds shared lock, writer must wait until reader releases"
scalar "UPDATE b1_gate_test.state SET enabled=true,dirty=false,generation=1,policy_version='v1'" >/dev/null
# Existing approved snapshot generation 1 again.
holdlog="$(mktemp)"; withdrawlog="$(mktemp)"
psql -v ON_ERROR_STOP=1 -At >"$holdlog" <<'SQL' &
BEGIN;
SET LOCAL application_name='b1_gate_reader';
SELECT b1_gate_test.read_value('JP',2026);
SELECT pg_sleep(1);
COMMIT;
SQL
hold_pid=$!
ready=0
for _ in $(seq 1 100); do
  count="$(scalar "SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND application_name='b1_gate_reader' AND state='active'")"
  if [[ "$count" -ge 1 ]]; then ready=1; break; fi
  sleep 0.02
done
[[ "$ready" -eq 1 ]] || { echo "FAIL: reader not ready"; wait "$hold_pid" || true; exit 1; }
psql -v ON_ERROR_STOP=1 -Atc "SELECT b1_gate_test.withdraw()" > "$withdrawlog" &
withdraw_pid=$!
writer_blocked=0
for _ in $(seq 1 50); do
  blocked="$(scalar "SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%b1_gate_test.withdraw%'")"
  if [[ "$blocked" -ge 1 ]]; then writer_blocked=1; break; fi
  sleep 0.02
done
wait "$hold_pid"
wait "$withdraw_pid"
[[ "$writer_blocked" -eq 1 ]] || { echo "FAIL: concurrent writer lock wait not observed"; exit 1; }
echo "EVIDENCE: writer waited on PostgreSQL Lock during ongoing read"
grep -qx '1200' "$holdlog" || { echo "FAIL: prerevocation reader did not see approved value"; cat "$holdlog"; exit 1; }
assert_empty
echo "PASS: pre-revocation reader completed before withdrawal; no old value after withdrawal"

echo "TEST3: old generation and repeated withdrawals remain unavailable"
scalar "UPDATE b1_gate_test.state SET enabled=true,dirty=false" >/dev/null
assert_empty
first_generation="$(scalar "SELECT generation FROM b1_gate_test.state WHERE singleton")"
second_generation="$(scalar "SELECT b1_gate_test.withdraw()")"
third_generation="$(scalar "SELECT b1_gate_test.withdraw()")"
[[ "$second_generation" -eq "$((first_generation + 1))" && "$second_generation" == "$third_generation" ]] || {
  echo "FAIL: repeated withdrawal changed generation ($first_generation/$second_generation/$third_generation)"
  exit 1
}
assert_empty
echo "PASS: stale generation and repeated withdrawal are idempotent and fail closed"
echo "TEST4: simultaneous withdrawals only advance one generation"
scalar "UPDATE b1_gate_test.state SET enabled=true,dirty=false,generation=1,policy_version='v1'" >/dev/null
w1="$(mktemp)"; w2="$(mktemp)"
psql -v ON_ERROR_STOP=1 -Atc "SELECT b1_gate_test.withdraw()" > "$w1" &
pid1=$!
psql -v ON_ERROR_STOP=1 -Atc "SELECT b1_gate_test.withdraw()" > "$w2" &
pid2=$!
wait "$pid1"
wait "$pid2"
[[ "$(tail -1 "$w1")" == "2" && "$(tail -1 "$w2")" == "2" ]] || {
  echo "FAIL: concurrent withdrawal generation mismatch"
  cat "$w1" "$w2"
  exit 1
}
assert_empty
echo "PASS: two simultaneous withdrawals advanced generation exactly once"

echo "TEST5: reapproval with stale generation must lose to withdrawal"
scalar "UPDATE b1_gate_test.state SET enabled=true,dirty=false,generation=1,policy_version='v1'" >/dev/null
revoke5="$(mktemp)"; approve5="$(mktemp)"
psql -v ON_ERROR_STOP=1 -At > "$revoke5" <<'SQL' &
BEGIN;
SET LOCAL application_name='b1_gate_revoke5';
SELECT b1_gate_test.withdraw();
SELECT pg_sleep(1);
COMMIT;
SQL
pid_rev5=$!
ready=0
for _ in $(seq 1 100); do
  count="$(scalar "SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND application_name='b1_gate_revoke5' AND state='active'")"
  if [[ "$count" -ge 1 ]]; then ready=1; break; fi
  sleep 0.02
done
[[ "$ready" -eq 1 ]] || { echo "FAIL: revocation session not ready"; wait "$pid_rev5" || true; exit 1; }
psql -v ON_ERROR_STOP=1 -Atc "SELECT b1_gate_test.try_reapprove(1)" > "$approve5" &
pid_ap5=$!
wait "$pid_rev5"
wait "$pid_ap5"
[[ "$(tail -1 "$approve5")" == f ]] || { echo "FAIL: reapproval succeeded after revoke"; cat "$approve5"; exit 1; }
assert_empty
echo "PASS: revoke wins against stale-generation reapproval"

echo "TEST6: dirty state concurrent with read must return NULL"
scalar "UPDATE b1_gate_test.state SET enabled=true,dirty=false,generation=1,policy_version='v1'" >/dev/null
dirty6="$(mktemp)"
psql -v ON_ERROR_STOP=1 -At > "$dirty6" <<'SQL' &
BEGIN;
SET LOCAL application_name='b1_gate_dirty6';
UPDATE b1_gate_test.state SET dirty=true WHERE singleton;
SELECT pg_sleep(1);
COMMIT;
SQL
pid_dirty6=$!
ready=0
for _ in $(seq 1 100); do
  count="$(scalar "SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND application_name='b1_gate_dirty6' AND state='active'")"
  if [[ "$count" -ge 1 ]]; then ready=1; break; fi
  sleep 0.02
done
[[ "$ready" -eq 1 ]] || { echo "FAIL: dirty session not ready"; wait "$pid_dirty6" || true; exit 1; }
assert_empty
wait "$pid_dirty6"
assert_empty
echo "PASS: concurrent dirty state prevents read"

echo "TEST7: policy-version change concurrent with read must return NULL"
scalar "UPDATE b1_gate_test.state SET enabled=true,dirty=false,generation=1,policy_version='v1'" >/dev/null
policy7="$(mktemp)"
psql -v ON_ERROR_STOP=1 -At > "$policy7" <<'SQL' &
BEGIN;
SET LOCAL application_name='b1_gate_policy7';
SELECT b1_gate_test.change_policy('v2');
SELECT pg_sleep(1);
COMMIT;
SQL
pid_pol7=$!
ready=0
for _ in $(seq 1 100); do
  count="$(scalar "SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND application_name='b1_gate_policy7' AND state='active'")"
  if [[ "$count" -ge 1 ]]; then ready=1; break; fi
  sleep 0.02
done
[[ "$ready" -eq 1 ]] || { echo "FAIL: policy session not ready"; wait "$pid_pol7" || true; exit 1; }
assert_empty
wait "$pid_pol7"
assert_empty
[[ "$(scalar "SELECT policy_version FROM b1_gate_test.state WHERE singleton")" == v2 ]] || {
  echo "FAIL: policy change not committed"; exit 1;
}
echo "PASS: concurrent policy change invalidates public reads"

psql -v ON_ERROR_STOP=1 -c "DROP SCHEMA b1_gate_test CASCADE" >/dev/null
rm -f "$writerlog" "$readerlog" "$holdlog" "$withdrawlog" "$w1" "$w2" "$revoke5" "$approve5" "$dirty6" "$policy7"
echo "B1_GATE_POSTGRES_CONCURRENCY_COMPLETE"
