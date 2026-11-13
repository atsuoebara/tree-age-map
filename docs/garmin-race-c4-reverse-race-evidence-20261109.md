# C4 reverse save-then-revoke race — isolated verification, 2026-11-09

**Branch:** `feature/garmin-race-analysis-implementation-20261109`, PR #67 (Draft)
**CI:** https://github.com/atsuoebara/tree-age-map/actions/runs/42563589592

Test harness:
- `supabase/tests/garmin_race_lifecycle_setup.sql` + `garmin_race_reverse_setup.sql`
- Actual proposed `supabase/garmin-race-analysis-schema-review.sql` trigger code
- Actual proposed four-arg `supabase/garmin-race-analysis-commit-rpc-review.sql`
- `supabase/tests/garmin_race_reverse_race.sh`
- Disposable PostgreSQL 16 only; script refuses any DB except `garmin_reverse_ci` on `127.0.0.1`.

Mechanics: Session A begins a transaction, invokes the actual four-argument Garmin commit with a synthetically valid analysis candidate, asserts `saved` and one uncommitted analysis row, and holds the connection lock through `pg_sleep(5)`. A monitored `pg_stat_activity` barrier confirms Session A reached sleep. Session B executes authoritative `permissions='[]'` UPDATE and is observed **waiting on a PostgreSQL lock** (not just a timed sleep). Session A commits; Session B proceeds and the PR's trigger deletes analysis.

Verified output:
- `PASS observed revoker waiting on saver-held lock`
- `PASS saved before revoke, analysis 1 inside transaction`
- `PASS reverse race: run saved, receipt saved, revoked, analysis purged`

Final assertions: canonical Garmin run = 1, analysis = 0, inbox state `saved`, `garmin_has_export` false.

**Scope:** proves this single serialization ordering in isolated Postgres. Does NOT establish every race or full production Supabase grants/RLS. C4 remains open for run-delete vs commit concurrency, auth account deletion dependencies/strategy and real Supabase role fidelity. C6 production-like Deno load/ACK still open. No production deployment or DB write performed.
