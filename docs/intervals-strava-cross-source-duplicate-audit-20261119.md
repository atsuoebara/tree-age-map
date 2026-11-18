# Strava × Intervals.icu duplicate-run incident — read-only audit (2026-11-19 JST)

## Scope and evidence
Incident reported through iPhone screens: Runner's Rings DISTANCE monthly ranking (2026-11) shows 244.6 km for the public name `atsuoebarun`; COROS monthly accumulation shows 178.24 km. **The latter is an external device/app display, not independent proof of every run in the database.**

Live Supabase **SELECT-only** audit as of 2026-11-19:
- Owner's undeleted November 2026 `public.runs` grouped by `source`: `strava` 20 rows, 178.24 km; `intervals` 9 rows, 66.36 km. Sum 244.60 km, consistent with the displayed 244.6 km.
- Each of the nine Intervals rows has a Strava row **with exactly the same user_id, started_at (second precision), and activity_date**. Each distance differs by 0.03–0.29 km; all fit the existing tolerance `max(0.5 km, 8% of shorter distance)`. Both sources have equal GPS route point counts per pair. Distinct physical-run identity is highly supported by the stored metadata; compare route content before any irreversible operation.
- Database-wide scan of undeleted Intervals rows matching undeleted Strava rows at the same non-null start and within the distance tolerance yielded exactly **9 candidate Intervals rows across 1 owner**, 66.36 km. This test does NOT establish that no other cross-source duplicates with shifted/missing start times or different providers exist.
- Matching candidate IDs have **3 dependent `rings_today_run_region_distance` rows**; `ranking_explore_verified`, `territory_run_region_distance`, and `territory_run_municipality_distance` show **0** candidate-associated rows at the audit time. The four listed tables hold FKs to `runs` with ON DELETE CASCADE. This does **not** mean soft-delete cleans derived rows.
- Read-only monthly ranking simulation, excluding only the identified nine candidate rows, yields 178.2 km (one-decimal database ranking rounding) and **2nd place**; the screenshot's position is unchanged. The 178.24 km double-precision raw sum is from Strava alone.

No `DELETE`, `UPDATE`, `INSERT`, migration, RPC modification, publication change, or cache invalidation was performed for this incident.

## Root cause / code path
`index.html` > `importFromIntervals()` used in-memory `activitySignatures`, `cloudRouteSignatures`, `cloudSignatures` and `findPossibleDuplicate()` before `saveActivityToCloud()`, but did **not** independently re-query the owner's saved cloud runs immediately before saving. If existing data was unavailable, lagging or mismatched by signature/route, it could add the activity under a different `source` even though the original Strava record existed.

Candidate patch adds a **read-only owner-scoped query** to `/runs` selecting non-deleted runs sharing the **exact started_at instant**, tests distance tolerance, and skips the Intervals save if a match exists. Network/auth/invalid-format errors fail closed (no accidental insert). The query uses only the current authenticated user; it does not use or expose service-role credentials. UI existing `duplicates` counter is used.

**Limitations:** no timestamp = no new guard; starts shifted by seconds = no new guard; other importer entrypoints are not covered; concurrent inserts can race between check and insert. A single atomic server-side deduplication strategy and carefully approved schema/ownership review would be needed for hard guarantees. No claim that this draft PR solves every cross-source duplicate.

## Before any cleanup / change to production data
1. Confirm original and candidate are the same physical run using owner-scoped ID, start time, distance **and actual GPS route similarity**, and inspect current IDs / `deleted_at` again just before acting. Avoid date-only deduplication; two sessions on one day are legitimate.
2. Capture a **private** backup of candidate run rows including routes and every dependent run-id row; do not commit user routes, UIDs, tokens or raw data to GitHub.
3. Decide retained source (likely Strava, subject to owner confirmation), whether to use soft delete or permanent deletion, and a reversible rollback/reconciliation path.
4. Treat `rings_today_run_region_distance` 3 rows specially: a `deleted_at` mark on parent runs does not cascade; repair derived rows and any aggregated public/private totals, cache, Territory, Rings Today, B-1 sharing and Ranking with an independently audited plan. `DELETE` of parent would cascade listed FKs but is irreversible without backup, and is **not** authorized.
5. Recompute and compare monthly/annual totals and rank; verify no changes to non-target users and to NATIONS monthly privacy protection; re-run test imports and report exact result.
6. **Separate explicit Atsuo approval** and むせ independent audit are prerequisites to every production run-row modification, DB schema change, merge or deployment. This PR is code-only and draft.

## Test and safety gates
Run `node scripts/test-intervals-cross-source-preflight.cjs` offline. Synthetic cases must pass for same-start match, distance tolerance, false positives, owner and deleted-run filters, missing start fallback, fail-closed on HTTP and malformed results. CI has no Supabase connection.

## Precise scope
No actual user run should be deleted or hidden by this PR. The existing 9 doubles are **still visible in production until a separately approved data-reconciliation operation completes**; changing only the import guard does not correct 244.6 km retroactively.
