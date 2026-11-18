# 2026-11 Strava × Intervals duplicate remediation: full-route evidence and execution gate

Status: **READ-ONLY EVIDENCE ONLY — NO PRODUCTION CLEANUP AUTHORIZED.**
Source: live Supabase SELECT at 2026-11-19 JST, repository main with PR #255 duplicate prevention deployed. No personal routes/UIDs/run IDs/credentials are included in this public document.

## Confirmed evidence

- November 2026 `runs`: Strava 20 activities / 178.24 km; Intervals.icu 9 activities / 66.36 km; ranking shown 244.6 km.
- Strict pairing (`user_id`, exact non-null `started_at`, non-deleted rows, Strava vs Intervals, distance difference <= `greatest(0.5,least(a,b)*0.08)`) resolves to **9 pairs / 9 unique source rows on each side / 1 owner**.
- Point-count equal for all 9 routes; route JSON NOT bit-identical. **Every single corresponding GPS coordinate pair was independently compared in the DB: 23,726 / 23,726 points; worst approximate planar spherical distance 1.367 m, 0 points over 2 m**, 429–5,183 points per activity. The comparison is an approximation (equirectangular around each latitude), not a cryptographic proof of identical recordings; exact matching start timestamp and close spatial overlap make 9 duplicates extremely likely. This result exceeds earlier 3-point sampling evidence.
- Monthly DISTANCE simulated after excluding nine duplicates: **178.2 km at display precision / 2nd place**, compared with live 244.6 km / 2nd place. COROS's 178.24 km aligns with Strava's unrounded 20-row source total. Recompute before live execution.
- Derived rows have changed across read-only inspections due to active sync. Latest read-only snapshot before full-route comparison: duplicate Intervals side associated with `rings_today_run_region_distance` 9 rows, `territory_run_municipality_distance` 9 rows, `ranking_explore_verified` 9 rows, `territory_run_region_distance` 0 rows. This is **NOT a frozen count**, must be reread under execution lock.
- Existing relationships from four dependent tables to `public.runs` use `ON DELETE CASCADE`. **Soft delete of runs alone leaves rows** and may allow derived computations to continue seeing the duplicates, depending on how queries are written.

## Fastest safe completion path (not permission to perform)

1. **Freeze/capture:** agree a short maintenance window or otherwise protect against concurrent Strava/Intervals imports and derived synchronization, confirm the exact DB transaction/lock isolation strategy. Do not block random unrelated users. Capture the verified owner's privately scoped 18 source rows **with full GPS route**, all dependent derived rows and all associated references, also a manifest of current schema/constraints/trigger behavior and total counts.
2. **Secure and verify backup:** store encrypted/private outside GitHub, PRs, comments or public actions; verify every candidate source and dependent row can be restored, including IDs / foreign keys / arrays / timestamps. Prove a restore in an isolated disposable environment before any irreversible operation. No secret or user route in logs.
3. **Revalidate immediately before execution:** strict owner; nine 1:1 pairs; original and survivor non-deleted; same start; duration if known; similar distances; re-run every-point GPS comparison and ensure no sample exceeds the previously agreed 2 m guard without a new audit. Check duplicates haven't naturally disappeared or been replaced; abort if counts, ownership, routes, dependency counts or constraints drift. Avoid deleting other legitimate same-day sessions.
4. **Independently select treatment:** physical deletion of just the nine Intervals rows would cascade the four listed derived FK tables but is irreversible without a tested full restore; soft deletion needs an explicit independently audited plan to remove/invalidate/update every dependent and cached aggregate, because soft delete does NOT cascade. **Neither treatment is yet approved**. Audit cross-table aggregations, background jobs, and end-user permissions before executing.
5. **Atomic/consistent execution:** prepare a separate, thoroughly gated, fixed-ID/private-owner-bound transaction or controlled remediation workflow with changes limited to the approved nine, same-transaction dependent reconciliation, correct rollback when any assertion fails, and strict no-op verification for all unrelated users. Do NOT store privileged SQL scripts with hardcoded private owner IDs or route data in the public repository.
6. **Post-execution verification:** verify exactly nine source records are resolved, survivor Strava run and route unchanged, derived data and recounters agree, year/month rankings correct, NATIONS monthly remains blocked, iPhone cached ranking refreshes, no reinsertion by imports. Record non-sensitive metrics and approved closure.
7. **Independent むせ audit plus explicit Atsuo consent:** the exact mode (hard/soft), backup location and successful restoration test, transaction boundaries, final DDL/DML and rollback, impact analysis and candidate list require a dedicated review **and a separate explicit approval**. PR #255's code approval was not an approval to modify any runs.

## Distinct risks and known limits
- Per-point array-position similarity only supports these nine pairs, not every source/shifted-timestamp duplicate.
- The point comparison uses full arrays and approximate geographic distance; it did not validate route duration/sample timestamps individually, beyond `started_at` exact equality. Re-audit if inputs change.
- Cache TTL means a corrected DB can temporarily leave an outdated monthly ranking in viewers' browsers. Ensure cache invalidation/versioning or bounded refresh before declaring a user-visible fix.
- The pre-save guard shipped in PR #255 is **client-side**, not a DB-atomic uniqueness guarantee.

**No data deletion, UPDATE, INSERT, DB migration, merge, production flag change or user export was performed by this evidence document.**
