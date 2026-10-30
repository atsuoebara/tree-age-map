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
    pgbench -n -c 2 -j 2 -t 500 -f /tmp/b1-concurrent.pgbench "$PGDATABASE"
    psql -v ON_ERROR_STOP=1 -Atc 'SELECT ''today_events='' || count(*) FROM b1_bench.today_events'
    # Validate every inserted row generated exactly one Today-stub event.
    count="$(psql -v ON_ERROR_STOP=1 -Atc 'SELECT count(*) FROM b1_bench.today_events')"
    [[ "$count" == "1000" ]] || { echo "ERROR: expected 1000 events, got $count"; exit 1; }
  done
done
psql -v ON_ERROR_STOP=1 -c 'DROP SCHEMA b1_bench CASCADE' >/dev/null
echo "B1_CONCURRENCY_COMPLETE: 12 trials; no HTTP/pg_net; local stubs only"
