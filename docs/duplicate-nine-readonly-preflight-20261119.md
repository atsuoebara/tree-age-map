# Target-specific read-only live preflight (NOT backup or freeze)
Date 2026-11-19 JST. Prerequisites: PR #269 synthetic float8 isolation PASS (Actions run #44413551898). This is a **read-only SQL executable artifact**, not an execution DML.

## Why this helps the critical path
The only remaining proof that matters is from real private backup + isolated full restore, scoped stop/resume dry-run, and audited final DML. This script provides a non-identifying preflight that an authorized private operator can repeat before beginning those operations. It never selects or prints private run IDs, UUIDs, GPS, individual distances, row hashes, secrets or provider payload.

## Exact observed read-only result (as first executed 2026-11-19)
- candidate pairs **9**, distinct Intervals targets **9**, distinct Strava survivors **9**, unique owner **1**
- target sum **66.361996 km**, survivor sum **65.102340 km** (different values are expected)
- owner Garmin inbox **0** nonterminal, based on tentative terminal set `saved/duplicate/ignored`
- regional cache state **one row** and no unsafe state (OFF + dirty true), public candidate cache **0 rows**
- Earlier full derived data counts: Today **18**, municipality Territory **18**, world Territory **0**, EXPLORE **18** (recheck with the script; this is not a frozen manifest)

This screening query does NOT check per-run GPS point correspondence. Even if the final column says `PRELIMINARY_READONLY_OK_NOT_FREEZE`, this does not imply a safe maintenance window or a completed backup.

## Blockers not checked by SQL
- Exactly 9 private ID pairs and every corresponding **23,726** GPS point validated again <=2m with same owner and no ambiguous pairs
- Prove actual owner-specific Garmin inbound embargo, zero in-flight cron+Edge, validated terminal state set; 0 nonterminal snapshot alone is insufficient
- Actions current/history, Territory/EXPLORE and pg_net/Edge worker drain, quiet interval and non-retry evidence
- Region cache two-table check again during actual freeze; unchanged management-state side-effect assertions
- **Encrypted private acquisition** of 18 full source rows, all four FK children, cache-control row, with a timestamped manifest matching the same frozen snapshot
- **Isolated real-data restore at 100%** using PG17.6 full-row hashes and float8 bit equality; test failure injection / rollback and verify no other owner changes
- Final private transaction, exact lock/assert, maintenance time, independent auditor full-package signoff and separate Atsuo operation approval

## Safety
This PR does not contain a production URI, connection string, credential, private owner/run ID or raw route. `BEGIN TRANSACTION ... READ ONLY` plus `SELECT` and `COMMIT` only. Do not attach SQL output with private data. **No runtime production freeze, writes, backup, restore, cancellation or merge occurred in this PR.**
