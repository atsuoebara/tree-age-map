#!/usr/bin/env bash
# Disposable GitHub Actions PostgreSQL only. No production credentials.
set -euo pipefail
command -v pgbench >/dev/null || { echo "ERROR: pgbench not installed on runner"; exit 1; }
psql -v ON_ERROR_STOP=1 -f docs/b1-concurrency-setup.sql
printf 'INSERT INTO b1_bench.runs(distance_km) VALUES(5);\n' > /tmp/b1-concurrent.pgbench
for trial in 1 2 3 4 5 6; do
  if ((trial % 2 == 1)); then modes=(off on); else modes=(on off); fi
  for mode in "${modes[@]}"; do
    if [[ "$mode" == on ]]; then psql -v ON_ERROR_STOP=1 -c 'ALTER TABLE b1_bench.runs ENABLE TRIGGER b1_invalidate' >/dev/null
    else psql -v ON_ERROR_STOP=1 -c 'ALTER TABLE b1_bench.runs DISABLE TRIGGER b1_invalidate' >/dev/null; fi
    psql -v ON_ERROR_STOP=1 -c 'TRUNCATE b1_bench.today_events, b1_bench.runs RESTART IDENTITY' >/dev/null
    echo "=== B1_CONCURRENCY trial=$trial mode=$mode clients=2 tx_per_client=500 ==="
    # Record per-trial TPS/average latency and sample concurrent lock waiters.
    runlog="$(mktemp)"
    locklog="$(mktemp)"
    stopfile="$(mktemp)"
    rm -f "$stopfile"
    (
      while [[ ! -e "$stopfile" ]]; do
        psql -v ON_ERROR_STOP=1 -Atc "SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'" >> "$locklog" || exit 1
        sleep 0.02
      done
    ) &
    monitor_pid=$!
    if ! pgbench -n -c 2 -j 2 -t 500 -f /tmp/b1-concurrent.pgbench "$PGDATABASE" > "$runlog" 2>&1; then
      touch "$stopfile"
      wait "$monitor_pid" || true
      cat "$runlog"
      exit 1
    fi
    touch "$stopfile"
    wait "$monitor_pid"
    cat "$runlog"
    # pgbench 16 output: "latency average = 0.523 ms", "tps = 3827... (...)".
    # Avoid sed basic-regex escaping errors. Require numeric values.
    latency="$(awk '/^latency average = / {print $4}' "$runlog" | tail -1)"
    tps="$(awk '/^tps = / {print $3}' "$runlog" | tail -1)"
    [[ "$latency" =~ ^[0-9]+([.][0-9]+)?$ && "$tps" =~ ^[0-9]+([.][0-9]+)?$ ]] || { echo "ERROR: pgbench metrics missing/invalid"; exit 1; }
    maxlocks="$(sort -nr "$locklog" | head -1)"
    maxlocks="${maxlocks:-0}"
    echo "B1_METRICS trial=$trial mode=$mode avg_latency_ms=$latency tps=$tps max_sampled_lock_waiters=$maxlocks lock_samples=$(wc -l < "$locklog")"
    rm -f "$runlog" "$locklog" "$stopfile"
    # Count Today events using numeric SQL only; shell prints the label.
    count="$(psql -v ON_ERROR_STOP=1 -Atc 'SELECT count(*) FROM b1_bench.today_events')"
    echo "today_events=$count"
    # Validate every inserted row generated exactly one Today-stub event.
    [[ "$count" == "1000" ]] || { echo "ERROR: expected 1000 events, got $count"; exit 1; }
  done
done
psql -v ON_ERROR_STOP=1 -c 'DROP SCHEMA b1_bench CASCADE; DROP SCHEMA rr_private CASCADE' >/dev/null
echo "B1_CONCURRENCY_COMPLETE: 12 trials; no HTTP/pg_net; local stubs only"
