#!/usr/bin/env bash
# Disposable GitHub Actions PostgreSQL only. No production credentials.
set -euo pipefail
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
wait "$writer_pid"
wait "$reader_pid"
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
wait "$hold_pid"
wait "$withdraw_pid"
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
psql -v ON_ERROR_STOP=1 -c "DROP SCHEMA b1_gate_test CASCADE" >/dev/null
rm -f "$writerlog" "$readerlog" "$holdlog" "$withdrawlog"
echo "B1_GATE_POSTGRES_CONCURRENCY_COMPLETE"
