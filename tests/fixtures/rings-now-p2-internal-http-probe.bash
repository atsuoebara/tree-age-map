#!/usr/bin/env bash
# Only inside a run-owned disposable PostgreSQL container; no host ports.
set -euo pipefail
exec 3<>/dev/tcp/postgrest/3000
cat /tmp/rn-p2/http-probe.req >&3
cat <&3
