# Cross-source nine-run remediation — execution-package preflight v0.1
Date: 2026-11-19 JST
Status: **DESIGN / HOLD — NO DATABASE CHANGES OR EXECUTION AUTHORIZED**
Predecessors: PR #255 prevention shipped; PR #258 design-only approved. Neither approval authorizes historical cleanup.

## 1. Independently inspected effective code and data paths

The following table distinguishes **whether the concrete consumer checks the parent's `runs.deleted_at`**, and **whether a scheduled sync is demonstrably capable of repairing pre-existing stale derived rows after deleting the parent**. "Upsert" is not automatically "repair".

| Path | Consumer/producer evidence (live RPC / main script) | Parent `deleted_at` check | Automatically removes obsolete derived rows? | Required consequence |
|---|---|---|---|---|
| Rings Today `rings_today_run_region_distance` | `scripts/sync-rings-today.mjs` selects only undeleted `runs` and tracks `last_run_id`; deletes/upserts per *processed* run | Producer **yes**; derived-row readers **not yet exhaustively verified** | **No guarantee**. High-water incremental cursor won't revisit an earlier deleted ID | Existing derived rows must be reconciled together with source rows; verify each consumer and yearly aggregation |
| Territory `territory_run_region_distance` | `scripts/sync-rings-territory-world.mjs` selects undeleted runs, deletes/upserts processed runs; live `territory_region_ranking` sums derived table without parent join | Producer **yes**, ranking RPC **no** | **No guarantee** for removed parents, even on rescan | Reconcile derived rows explicitly |
| Territory `territory_run_municipality_distance` | `scripts/sync-rings-territory.mjs` deletes/upserts processed runs; live `territory_municipality_ranking` sums derived table without parent join | Producer selection **to be reverified for current deployed sync**; ranking RPC **no** | **No guarantee** | Reconcile derived rows explicitly |
| EXPLORE `ranking_explore_verified` | `scripts/sync-ranking-explore.mjs` selects undeleted runs; upserts matches, no stale-row pruning. Live annual `ranking_explore` reads derived rows directly | Producer **yes**; **annual RPC no**; monthly `ranking_explore_month_places` **yes** via join to `runs` | **No** | Annual can remain distorted by stale rows after soft delete; explicit reconciliation essential |
| DISTANCE monthly + annual | Live `ranking_distance_month_places`, `ranking_distance` sum `public.runs` and filter `r.deleted_at IS NULL` | **yes** | Direct live sum; no separate stored run-summary table in these RPCs | Excluding exactly nine rows changes 2026-11 total; verify rounding, rank, and client caches |
| NATIONS annual | Live `ranking_nations` sums runs, filters `deleted_at IS NULL` | **yes** | Direct live sum, but consent/privacy semantics require independent audit | Preserve existing privacy rules; do not broaden audience or modify RPC |
| NATIONS monthly | UI has privacy hold; legacy `ranking_nations_monthly` exists in DB and checks deleted but is not authorization to enable monthly | **yes** in legacy RPC | N/A (monthly public use forbidden) | Keep monthly NATIONS private/unavailable; verify grants separately before ever changing behavior |

**Unverified points are BLOCK, not PASS.** In particular, effective deployed sync invocation schedules, every Today consumer and country/public aggregate, municipality producer source filter, and any background race must be re-audited before cleanup.

## 2. Verified numerical reference — SELECT-only, non-sensitive

- 9 one-to-one Strava/Intervals pairs (unique IDs on both sides), 1 owner, exact `started_at`; duplicate Intervals sum **66.36 km** in November 2026.
- Full 23,726 paired GPS points inspected by read-only SQL; maximum approximate positional gap **1.367 m**, no sampled point exceeding 2.0 m.
- 2026 November personal DISTANCE displayed one-decimal before/after simulation: **244.6 km → 178.2 km**; place remains **2** under the read-only snapshot.
- 2026 personal annual distance raw sum as of current SELECT: **2131.07 km → 2064.71 km**, delta **−66.36 km**. This annual baseline is a snapshot and must be recomputed on execution day; unrelated new runs can change both totals, so acceptance focuses on the exactly −66.36 km target delta.
- Derivative rows have **drifted** over successive read-only checks (Rings Today, Territory municipality, EXPLORE). Counts are *not* stable fixed targets; the candidate-dependent row counts must be captured in a transaction-consistent manifest just before the approved operation.

## 3. Numeric BLOCK gates (proposal; independent review required)

1. Candidate count must equal **9**, unique Intervals IDs **9**, unique Strava survivor IDs **9**, owner count **1**; each pair must have exact non-null start time, be undeleted at entry, match November 2026 window, and have distance difference <= `greatest(0.5 km, 8% of shorter distance)`. Any deviation => **BLOCK**.
2. All 9 routes must be nonempty equal-length GPS arrays, combined paired point count **23,726** if records have not legitimately changed since the evidence snapshot. Recheck every coordinate; every point must be finite and physically valid; max approximate gap **<=2.0 m**; any point >2.0 m, length mismatch or changed point-count manifest => **BLOCK** until fresh audit.
3. For each dependent table, the counts and private row hashes captured during freeze/backup must equal those immediately before the approved DML, with **exact equality, 0 unexpected rows or hash mismatches**. Any drift, including background sync, => **BLOCK** and repeat freeze/backup/restore proof. Do **not** assume historical 3, 9, 0 counts still hold.
4. Private backup proof must cover **18 original source rows** (9 retain+9 remove candidates), their complete routes, and *all* corresponding rows in each of four run FK dependent tables plus other discovered references. Verified restored rows must be **18/18**, linked rows counts equal 100%, summed source distances match to defined precision, total route-point counts match exactly and row content hash equality 100%. Any absent table, count, checksum, ownership or precision mismatch => **BLOCK**. Backups/restores **not performed as part of this PR**.
5. Within the scoped transaction, assert **exactly 9 approved target rows** change and **0 survivor or other-owner run rows** change; dependency reconciliation expected-vs-actual exact matching; any assertion failure => **ROLLBACK/NO COMMIT**. Define how to handle concurrent imports/syncs; a normal transaction alone does not freeze external writers.
6. Final audit: monthly personal sum delta **−66.36 km**, annual personal sum delta **−66.36 km**, month display **178.2 km** and rank **2** only if baseline remains current; any additional running activity after the baseline requires rebaselining rather than false failure. NATIONS monthly stays blocked; privacy preferences unchanged.

## 4. Candidate treatment comparison — NOT a selection

**Soft deletion:** reversible at source (`deleted_at`) but derived tables do not cascade, annual EXPLORE/Territory read derived rows without a parent deleted filter, and historical sync does not guarantee pruning. Would require independently audited same-transaction dependent-table DML plus re-run/reconcile process. Risk of future re-population and every consumer has to be ruled out.

**Physical deletion:** four inspected FK tables reference `runs` with `ON DELETE CASCADE`; a single transaction could clean these dependent tables with the nine source records, avoiding ghost derived counts. However it is irreversible unless the **privately encrypted full restore is proved** (incl. sequence, FK, downstream caches), all other dependencies/triggers and background schedules are verified, and execution boundaries are reviewed. **Not approved or selected.**

## 5. Private execution plan outline — intentionally no runnable production DML

A. Determine an owner-specific low-activity maintenance window **after inspecting actual sync schedules**; propose 02:00–03:00 JST as a *candidate window only*, **not confirmed safe**. Explicitly pause/coordinate both import writers and all derived sync processes or obtain transaction-level exclusion proven with the real deployed behavior. No global-user outage without separate approval.

B. Capture candidate pair manifest and immutable private backup at a consistent snapshot; do not expose run IDs, UIDs, routes, tokens or privileged SQL to GitHub Actions, public PR, or logs. Produce sanitized evidence only (per-source row count, numeric distance sums, total GPS point count, dependent counts, hash-pass percentage). Restore into a disposable isolated DB and demonstrate owner/FK/route fidelity. Do not proceed on a backup file merely existing.

C. Obtain separate review of *the exact private SQL*, transaction isolation, lock ordering, predicate guards, validation assertions, affected-row count assertions, dependency handling and rollback. A single transaction must not COMMIT unless each assertion including concurrent-write protection passes. **The final SQL text is not prepared yet, and no DML will be issued without its own independent audit.**

D. Directly before execution, replay all the candidate/route/derived gate checks against the frozen snapshot; verify unchanged row versions, source data and constraints. Execute one approved transaction with rollback-on-error, log only aggregated counts; release competing syncs after verification.

E. Verify correction in ranking monthly/annual, Today/Territory/EXPLORE, NATIONS monthly privacy, unmodified Strava survivors, owner & unrelated-user isolation, and iPhone refreshed UI. Investigate stale clients/cache and document results before declaring closure.

## 6. Completion gates

- [x] Effective SQL/RPC and main sync scripts reviewed at the stated scope.
- [x] Full 23,726-point comparison and annual delta snapshot done read-only.
- [x] Draft numeric STOP gates, evidence format, soft/hard comparison, and single-transaction plan documented.
- [ ] All consumer and schedule definitions independently enumerated.
- [ ] Soft vs hard **approved choice**.
- [ ] Encrypted private full backup obtained and exact restored snapshot verified.
- [ ] Private final DML / locking / rollback protocol drafted, tested, independently audited.
- [ ] むせ execution-package audit passed.
- [ ] Atsuo approved a separate precisely-scoped production operation.
- [ ] Actual 9-row repair executed/verified.

This document is a **preflight proposal**, not evidence of having backed up or restored the private data, and grants no DB, deployment or merge permission.
