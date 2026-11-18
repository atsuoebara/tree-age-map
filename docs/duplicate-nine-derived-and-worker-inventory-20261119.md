# Duplicate-nine dependency closure investigation — PR #263 follow-up
Date: 2026-11-19 JST. **READ ONLY / DESIGN REVIEW / HOLD.** This is an evidence-backed *expanded inventory*, **not** proof all writers have been paused, that a refresh worker is identified, or that the execution package is ready. References: PR #263 (partial inventory audit PASS), PR #262 (conditional hard-delete proposal PASS).

## (1) All four derived tables — triggers and second-level FKs

Queried live `pg_trigger` (non-internal) and `pg_constraint` (FKs whose referenced table is one of the four). Outcome:

| Derived table | Non-internal table triggers | FK(s) pointing **into** the derived table |
|---|---|---|
| `rings_today_run_region_distance` | **1**: `b1_region_source_invalidate`, AFTER INSERT/UPDATE/DELETE **FOR EACH STATEMENT**, invokes `rr_private.invalidate_region_rings_cache()` | **0** in catalog query |
| `territory_run_region_distance` | **0** | **0** in catalog query |
| `territory_run_municipality_distance` | **0** | **0** in catalog query |
| `ranking_explore_verified` | **0** | **0** in catalog query |

Each of the four also has an `ON DELETE CASCADE` foreign key **from the derived table to `public.runs`**, as validated in PR #263. During an approved parent DELETE, FK cascade can delete Today child rows and the **Today child-level invalidation trigger may dirty regional cache state**. The exact trigger firing and dirty-state write must be tested by an isolated transactional dry run — do not infer every runtime side effect just from DDL.

`rr_private.invalidate_region_rings_cache()` is known to UPDATE `rr_private.region_rings_refresh_state` (is_dirty flag/reason/timestamp). It is invoked both from `runs` and Today child. **Include this state row in backup, transaction side-effect assertions and post-run checks.**

## (2) Disposition matrix for the 18 named functions

The table reports **textual presence of `deleted_at`**, not a promise that every reference uses it correctly. 'Reader' means SQL returns information; 'writer' includes side effects. 'Actual route' identifies demonstrated source trigger, deployed application use if known, or a callable RPC requiring a final invocation audit. **Unknown invocation is not 'unused'.**

| Function | Kind | Mentions deleted_at | Evidenced / suspected live route and audit treatment |
|---|---|---|---|
| `enqueue_rings_today_live_sync` | **HTTP writer** | No | **Confirmed** from DB trigger `trg_rings_today_live_sync` on `runs` INSERT/selected UPDATE. `net.http_post` sends live Edge request; must drain before freeze; DELETE does not fire this trigger |
| `garmin_commit_activity` | **writes runs and inbox** | Yes | Garmin API inbox consumer path; inserts into `runs` on accepted record, updates inbox status. **DB cron Garmin retry active**. Need operator-side ingress/queue stop evidence |
| `get_import_share_origin_page` | Reader | Yes | Run origin paging RPC; consumer invocation not independently proven, check export/public origin exposure and caches |
| `get_my_region_rings` | Reader | Yes | Owner-specific Today-based region aggregation; requires surviving-run and private-row consistency check |
| `get_my_ring_regions` | Reader | Yes | Owner-specific Today region summary; verify no duplicate-region distances |
| `get_public_run_origins` | Reader | Yes | Public run origins RPC; audit whether any public read/cache consumes it after change |
| `get_rings_today` | Reader | Yes | Today regional RPC with municipality fallback; joins parent runs, filters deleted; check current day and backdated date |
| `my_today_regions` | Reader | Yes | Owner-specific region listing from Today; check surviving Strava path |
| `ranking_distance` | Reader | Yes | Annual DISTANCE RPC; owner's expected annual sum delta **−66.36km** |
| `ranking_distance_month_places` | Reader | Yes | Month rank/score RPC; November expected **−66.36km** change (display 244.6→178.2, baseline dependent) |
| `ranking_distance_monthly` | Reader | Yes | Legacy/monthly RPC, consumer route to confirm; verify privacy semantics |
| `ranking_explore_month_places` | Reader | Yes | Monthly EXPLORE reads verified-child joined to parent; check first region dates |
| `ranking_explore_monthly` | Reader | Yes | Other monthly EXPLORE RPC; check calculated regions and invocation route |
| `ranking_nations` | Reader | Yes | Annual country totals; preserve consent/privacy gates; expected raw owner contribution delta −66.36km if included |
| `ranking_nations_monthly` | Reader | Yes | Monthly NATIONS **UI HOLD**; do not enable or change grants |
| `ranking_years` | Reader | **No** | Year-list RPC reads runs without deleted filter; nine Strava survivors mean 2026 remains, but verify year-list after treatment |
| `runner_badge_codes` | Reader | Yes | Badge generation on runs; verify badges not unexpectedly removed |
| `rr_private.region_bucket_eligible` | Reader | Yes | Private minimum-participants bucket eligibility; preserve B-1 confidentiality |

Search boundary: 18 functions were identified in `public` and `rr_private` by SQL text matching named run references. A dedicated check classified all 18 and confirmed `deleted_at` textual presence in **16/18**, absent from `enqueue_rings_today_live_sync` and `ranking_years`. This does not prove complete reference coverage for dynamic SQL, other schemas, C extensions, client code, or external integration calls. The annual `ranking_explore` and Territory ranking RPCs are already separately characterized in PR #262; they were not in the original text-search list of 18 because they read derived tables without parent `runs` references. These **must remain in the overall consumer inventory**.

## (3) Region cache refresh worker identity and schedule

**Verified:**
- `runs` statement-level trigger and Today child statement-level trigger call `rr_private.invalidate_region_rings_cache()`.
- Function marks `rr_private.region_rings_refresh_state` dirty. It does not run a refresh/rebuild itself.
- Repository search of `region_rings_refresh_state` returned documentation, SQL fixtures and roadmap material; not a uniquely identified deployed refresh worker.
- Live `pg_proc` functions in `public`/`rr_private` whose definition references `region_rings_refresh_state` or `region_rings_public_candidate`: **only `rr_private.invalidate_region_rings_cache`** in the filtered scan.
- Live `cron.job` shows only one active job, `garmin-activity-retry`, **every 2 minutes**. No region refresh cron job was present.

**Result: refresh/rebuild worker is NOT identified. BLOCK.** Do not invent a schedule or claim the cache is refreshed automatically. A plausible alternative is a deliberately fail-closed unused/candidate cache, but this is **not proved**. Next check the actual consumer and publication gates, other schemas/Edge functions/external operations and whether region refresh is intentionally disabled. Until resolved, the private execution package must define exactly how the dirty flag is handled without publishing private candidate data.

## (4) DB schedule and deployed Edge inventory

- Live `cron.job` **one active scheduled job**: `garmin-activity-retry` at `*/2 * * * *`. Job command was not included in this public document (avoid secrets); inspect private execution path and owner-specific in-flight retry gate before any freeze.
- Supabase Edge list returned **25 functions total**, and the following relevant ACTIVE functions/versions (snapshot; re-check right before maintenance):
  - `rings-today-live-sync` **v17**
  - `strava-sync` **v46**, `strava-webhook` **v27**
  - `intervals-sync` **v18**
  - `coros-sync` **v29**
  - `garmin-ingest` **v16**, `garmin-activity-push` **v10**
  - `rings-now-control` **v1**
- GitHub Actions schedules previously established in PR #260: Today current every 5 min and history every 15 min; EXPLORE twice daily; Japan Territory twice daily; World Territory manual. GitHub cron may be delayed and manually dispatched. **Edge function versions are confirmed by deployment metadata, but that does not alone establish what each request is doing right now.** Every active writer needs stop/in-flight/resume proof.

## (5) Device cache and UI evidence: mandatory POST-EXECUTION

User-visible display/cache is **not** a criterion for changing the underlying DB during transaction. After an independently approved repair, require:
1. Server-side monthly/annual personal totals and public opt-in/ranking RPC consistency, Today/Territory/EXPLORE derived aggregates correct, NATIONS monthly still hidden.
2. Client refresh/new session on iPhone; stale cache invalidation/reload and display **month 178.2km and place 2 only if no subsequent activity changes the baseline**.
3. Compare server RPC and client UI values, no duplicate reappearance after reconnect, no corrupted original Strava route; note service worker / local persistent cache, avoid declaring success from backend alone.
4. Record only private-safe counts/deltas, no user/run identifiers or GPS in public audit logs.

## Decision and pending items

**Partial closure only**: derived trigger and secondary FK scan performed, function dispositions documented, cron and selected live Edge versions confirmed, client cache acceptance defined. **Refresh worker identity remains unresolved**, and full write/read invocation inventory still requires proof in the actual deployed execution paths. Additional final-package HOLD:
- confirm actual legacy/country/public region-cache consumers and whether refresh is intentionally disabled;
- full private backup of 18 source rows plus 4 dependent tables & cache control, isolated full restore proof;
- operator-tested stop/resume for every writer and pg_net queue+worker+Edge quiet time;
- exact physical-delete private SQL with row-level locks, 9:9/gps23,726 max 2m, all dependencies & effects assertions, single-transaction rollback and failure injection;
- confirmed low-conflict maintenance window; むせ full-package audit; Atsuo separate explicit production approval.

No production write, schedule stop, queue deletion, data export, merge or deploy in this audit.
