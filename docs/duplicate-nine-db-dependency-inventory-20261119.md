# 2026-11 duplicate-nine remediation — DB dependency/scope inventory v0.1

Date: 2026-11-19 JST
**READ-ONLY evidence, draft only. Not a claim of exhaustive cross-system inventory.**
Reference: PR #262 HEAD a15f3986 conditional physical-delete treatment proposal passed independent design audit. No final mode chosen, no backup/restoration proved, no production changes approved.

## 1. Actual Postgres catalog results

Direct FK relationships (from `pg_constraint` filtering references to `public.runs`) found **four**:
| Child table | Constraint | Deletion rule |
| --- | --- | --- |
| `public.rings_today_run_region_distance` | `rings_today_run_region_distance_run_id_fkey` | ON DELETE CASCADE |
| `public.territory_run_municipality_distance` | `territory_run_municipality_distance_run_id_fkey` | ON DELETE CASCADE |
| `public.territory_run_region_distance` | `territory_run_region_distance_run_id_fkey` | ON DELETE CASCADE |
| `public.ranking_explore_verified` | `ranking_explore_verified_run_id_fkey` | ON DELETE CASCADE |

Database-side non-internal triggers on `public.runs` found **two**:
- `b1_runs_invalidate`, **AFTER INSERT/UPDATE/DELETE FOR EACH STATEMENT** → `rr_private.invalidate_region_rings_cache()`; read-only function inspection confirmed it **UPDATES `rr_private.region_rings_refresh_state`**, sets `is_dirty=true`, `last_invalidated_at=now()`, and a reason string. So physical deletion also updates a cache-control row. This secondary write is an **expected side effect** of any approved delete, needs to be included in pre/post state and transaction audit, and is NOT authorization for other changes.
- `trg_rings_today_live_sync`, **AFTER INSERT or UPDATE OF route, distance_km, activity_date, deleted_at FOR EACH ROW** → `public.enqueue_rings_today_live_sync()` → async `net.http_post` to deployed Edge. **Not triggered on parent DELETE.** Existing queued/inflight requests still need complete quiescence before freeze.

DB routine definition search for explicit `public.runs` / `FROM runs` / `JOIN runs` / `run_id`, in `public` and `rr_private` found **18 functions** (search-dependent; not proof no dynamic SQL or other schemas). Names:
- `public.enqueue_rings_today_live_sync`
- `public.garmin_commit_activity`
- `public.get_import_share_origin_page`
- `public.get_my_region_rings`
- `public.get_my_ring_regions`
- `public.get_public_run_origins`
- `public.get_rings_today`
- `public.my_today_regions`
- `public.ranking_distance`
- `public.ranking_distance_month_places`
- `public.ranking_distance_monthly`
- `public.ranking_explore_month_places`
- `public.ranking_explore_monthly`
- `public.ranking_nations`
- `public.ranking_nations_monthly`
- `public.ranking_years`
- `public.runner_badge_codes`
- `rr_private.region_bucket_eligible`

**Important FK-less runtime/read dependencies identified:**
- `public.get_rings_today(target_date)` reads `rings_today_run_region_distance` joined to `runs`, plus **Territory municipality fallback** joined to `runs`. Both filter `runs.deleted_at IS NULL`; fallback uses `not exists` for the Today child. Physical removal of nine duplicated parents means neither child can persist through FK cascade; ensure Today distance / runner count are not doubled after maintenance, with fallback path tested.
- `public.get_my_region_rings`, `get_my_ring_regions`, `my_today_regions` consume Today-derived rows, with explicit `deleted_at` in the definitions (exact joins/behavior require final test).
- `rr_private.region_bucket_eligible` consumes the Today derived table and checks `deleted_at`; anonymized regional publication privacy gate must be reverified.
- `public.ranking_years()` reads `runs` but **does not filter `deleted_at`**; the approved scope concerns 2026 runs with surviving Strava entries, so no year disappearance is expected, but year list must still be validated.
- `public.runner_badge_codes`, `get_public_run_origins`, `get_import_share_origin_page`, `garmin_commit_activity` are other references to run data; inspect impact and actual execution paths during final package audit.
- `public.ranking_distance` and monthly, NATIONS, EXPLORE and Territory dependencies already detailed in PRs #259–#262. Do not infer no impact from only checking ranking totals.

A catalog scan of `public`/`rr_private` ordinary views and materialized views with `runs` in SQL definition returned **0**. This does **NOT** exclude dynamic SQL, external Edge functions, JS, other schemas, unqualified-name references or cache tables.

A column-name scan located a **legacy table `public.runs_duplicate_backup_20260828`** with fields resembling `runs`. It is NOT established to reference current candidate IDs, and must **not** be used as the private 2026-11 backup. Do not modify or publicly export it.

## 2. Physical deletion consequence matrix

| Category | Current evidence | Required before actual DML |
|---|---|---|
| 9 duplicate Intervals target rows | 9 strict same-owner pairs, 23,726 GPS points compared; 66.36km | New 9:9 unique/owner/time/distance/route exact preflight; zero changed survivors or other users |
| Four FK children | All ON DELETE CASCADE | Capture full dependent snapshot and counts/hashes under freeze; verify exact cascade counts and 0 ghost rows |
| `rr_private.region_rings_refresh_state` | `b1_runs_invalidate` writes dirty flag on DELETE | Include cache-control row before/after in approved transaction and post-rebuild checks; check related refresh worker |
| Today live pg_net hook | DELETE doesn't fire UPDATE-specific hook | Drain pending/inflight requests, prove Edge quiescence, re-check derivative hashes |
| Today/territory fallback consumers | `get_rings_today` joins both child tables and filters parent; other Today consumers listed above | Check Today and municipality outputs both before and after, under intended 2026 period; uphold privacy |
| NATIONS/year/month, badges and source-origin readers | Additional run-dependent functions | Verify no unintended public disclosure, 2026 annual personal delta −66.36km, monthly delta −66.36km, badges and origin aggregate boundaries |
| Async imports/schedulers | PR #261 runbook is candidate, not fully proven all-writer pause | Verify live jobs, queue, external provider webhook inflight and cron writers; BLOCK if unknown |
| Private backup/restore | Not attempted | Encrypted private 18 source rows+all child data+relevant cache state, isolated full restore proof with count/distance/point/checksum exact matches |
| Privileged SQL | No final DML written | Single isolated transaction, explicit locking and assertions, failure-injection rollback test, detailed review and user approval |

## 3. Actual remaining unknowns (BLOCK)
1. **Whole DB scan** across other accessible schemas, triggers on FK child tables (if any), foreign keys referencing tables which themselves cascade, all DB scheduled jobs/cron, dynamic SQL functions and unqualified `runs` references. This was a targeted search, not a mathematically complete dependency graph.
2. **Code outside DB**: connected live Edge versions for Strava/COROS/Intervals/Garmin and Today, browser pages, scheduled GitHub Actions, service job chains, potential connected provider retries and caches. A documented named owner-specific stop/restart and no-inflight proof is mandatory.
3. **Backup effects**: audit `rr_private.region_rings_refresh_state` and refresh worker's behavior; identify any other persistent regional snapshots and irreversible external effects.
4. **Maintenance dry-run**: no live writer suspension or test of whether the operator can pause and restart jobs; no verified scoped maintenance isolation.
5. **Final private execution package**: encrypted backup, restore count/distance/point/hash evidence, exact approved nine IDs stored privately, candidate row locks, 0 unexpected affected rows, 100% cascade verification, single transaction/failure-injection tests and revalidation immediately before execution.

## 4. Safety decision

The targeted catalog scan strengthened the conditional physical-delete proposal **and discovered a real statement-level cache-control UPDATE side effect**. This does NOT close the requested **full inventory**. An independent review should classify the remaining unknown edges, then schedule private backup+restore and owner-scoped dry run. Until proven, **BLOCK**. No DML, dump/export, trigger modification, job stop, DDL, PR merge or deploy was executed in this preparation.
