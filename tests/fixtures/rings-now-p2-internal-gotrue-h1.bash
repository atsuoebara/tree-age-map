#!/usr/bin/env bash
# Run-owned PostgreSQL container ONLY. No host ports or dynamic URL.
set -euo pipefail
exec 3<>/dev/tcp/gotrue/9999
cat /tmp/rn-p2/gotrue-h1.req >&3
cat <&3
