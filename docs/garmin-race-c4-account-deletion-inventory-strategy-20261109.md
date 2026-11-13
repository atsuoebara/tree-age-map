# C4 — Account deletion inventory and proposed strategy (2026-11-09)

**Status: review-only, NOT authorized to deploy.** Existing user deletion entrypoint has NOT been established in repository searches (queries: `deleteUser`, `auth.admin.deleteUser`, `delete_account`, `delete-account`, `退会`, `アカウント削除` all yielded no matching implementation). This is evidence of an unknown entrypoint, **not proof that no deletion entrypoint exists**.

## Live schema read-only catalog evidence
Inspected `pg_constraint`, `pg_class`, `pg_attribute` with read-only queries. No user account data returned or modified.

- `public.runs.user_id -> auth.users(id)` **NO ACTION** (no ON DELETE CASCADE), therefore auth-first hard deletion may fail for users owning runs.
- `public.garmin_api_connections`, `public.garmin_activity_inbox`, `public.strava_connections`, `public.garmin_connections`, `public.intervals_connections`, `public.coros_connections`, their OAuth state and processing tables, photo metadata, consent, rankings and some region tables: user FK **ON DELETE CASCADE**.
- `public.ranking_explore_verified`, `public.territory_run_region_distance`, `public.territory_run_municipality_distance`, `public.rings_today_run_region_distance`: FK to `public.runs(id)` **ON DELETE CASCADE**.
- **Orphan candidates:** `public.runs_duplicate_backup_20260828.user_id` has **no user FK** and contains a copy of a route JSON field. `public.rings_today_run_region_distance.user_id` has no auth FK but has run FK, so deleting runs normally clears associated rows. Do not mistake the latter as an independent account-level cascade.
- `storage.objects` contains `owner`, `owner_id`, `bucket_id`, object names and metadata; not covered by an auth-user cascade in the inspected FK graph. **Physical storage objects need API-mediated ownership/path audit and deletion**, not blind SQL DELETE of storage metadata.
- Other user-linked artifacts outside this FK graph, storage, backups, public Journal/Rings People, and authorization/audit append-only records may need separate retention/legal decisions and consent verification; this inventory is not exhaustive.

## Decision proposal, not implemented

1. **Freeze ingestion / disable connections first**, revoke remote Garmin access as required; do not perform auth hard-delete while active integrations can still ingest. Verify pending worker/drain races and that account deletion cannot be undone by a delayed callback.
2. Identify all directly user-owned rows **and backup copies** plus storage objects, with a robust preflight and immutable registry of tables to clean (avoid dynamic SQL built from user input). Decide whether published content or audit ledger rows need separate controlled anonymization/retention.
3. In a carefully permissioned service operation, erase *owned runs and derived analysis* and clear non-FK owner-linked backups/other residual rows. Hard deletion of a run removes its Garmin ID deduplication tombstone: only do this as part of an account deletion flow after intake is stopped. Keep cross-user rows untouched.
4. Delete authentication user **last**, once dependent rows are absent; rely on existing CASCADE FKs only for their verified dependencies, not as a substitute for erasing non-FK data.
5. Verify zero residual personal data in all scopes and stop retries. Delete any storage files using the supported storage API (not direct DB table edits). Use a documented compensating process for multi-service failures (cannot promise one atomic transaction across Auth, DB, Storage and Garmin).

**Blocking:** Need explicit product-level account deletion behavior choice, full table/storage inventory, authorization model, audited transaction/retries and production-role verification. This proposal is not an account deletion endpoint. No production SQL or delete actions permitted.

## Isolated proof
`supabase/tests/garmin_race_account_deletion_cases.sql` loads synthetic auth/users/runs/backup/analysis and tests: auth-first FK rejection; cleanup without backup leaves an orphan; cleanup with backup erasure clears analysis and preserves another account. GitHub Actions runs in disposable Postgres and ends with `ROLLBACK`. **It does not prove live account deletion or storage deletion.**
