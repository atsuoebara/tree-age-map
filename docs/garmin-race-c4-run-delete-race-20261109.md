# C4 run delete vs duplicate Garmin commit: isolated evidence (2026-11-09)

Draft PR #67. Disposable PostgreSQL 16 CI only, **never run against production**.

Evidence: https://github.com/atsuoebara/tree-age-map/actions/runs/42565076065

Test directly loads the current draft schema SQL, the draft four-argument commit RPC and synthetic run/analysis fixture. Session A calls actual `garmin_commit_activity` for an **already committed, same-external-ID run** and expects `duplicate`; it then holds its transaction open for 5 seconds. A `pg_stat_activity` barrier verifies A is sleeping. Concurrent session B either sets `deleted_at` on that existing run or physically deletes it, completing the deletion while A is still alive. Session A then commits. Final assertions check analysis=0 for the selected run, receipt=`duplicate`, and the corresponding expected soft-deleted/physically absent run status.

Observed:
- `PASS soft delete overlapped real duplicate RPC; no analysis resurrected`
- `PASS hard delete overlapped real duplicate RPC; no analysis resurrected`
- Job `success`.

## Important limit: not a complete physical-deletion deduplication guarantee

This only proves the **overlapping duplicate-RPC-first then delete** ordering. It does NOT prove a brand-new Garmin Push arriving *after* a physical DELETE remains suppressed. Existing deduplication relies on the `runs` row as an ID tombstone; physical deletion removes it. A later redelivery may be imported again. Current normal user-facing delete must continue using soft deletion for redelivery protection. A proposed account-wide physical erase needs separate deletion/consent rules and a persistence strategy (without retaining removed personal data).

Additional untested orders: deletion committed *before* a fresh RPC, and deleting a just-inserted uncommitted run (MVCC visibility semantics); stale-attempt collision across workers was tested without concurrency only. Do not mark full C4 complete. Must audit the precise claim, the test barrier, and separate actual production-role tests.

No merge, Supabase schema apply, deploy, or production data change.
