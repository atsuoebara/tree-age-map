# runs owner CRUD — production-safe validation (2026-11-06)

Scope: production database role-simulation via SQL. No persistent user data modification, no policy changes. Full UI/API end-to-end acceptance remains open.

## Safety observations
- `public.runs` has AFTER INSERT/UPDATE trigger `trg_rings_today_live_sync` that can enqueue HTTP jobs, plus statement-level AFTER INSERT/DELETE/UPDATE `b1_runs_invalidate` trigger.
- The live-sync trigger is defined as UPDATE OF `route, distance_km, activity_date, deleted_at`; therefore testing an UPDATE of **name only** avoids this external network trigger.
- `runs` has four referencing child tables with ON DELETE CASCADE. Avoid destructive tests on actual runner rows without dedicated fixtures.
- A DB `ROLLBACK` alone is not a full guarantee that external HTTP effects never happen.

## SQL verification performed
1. Role simulation: `SET LOCAL ROLE authenticated`, transaction-scoped `request.jwt.claim.sub` matching existing runs owner.
2. `EXPLAIN` (without ANALYZE) for owner-scoped INSERT, UPDATE, DELETE: accepted by SQL planner; **does not prove real write succeeded**.
3. **Actual UPDATE**, `SET name=name` on exactly one existing owner-scoped row, only the `name` column, followed by `ROLLBACK`: **success** (`RETURNING` showed owner_match=true). No lasting row change. No live-sync route/distance/date/deleted_at update trigger invoked.
4. DELETE on preselected unreferenced target attempted. First attempt was blocked by permissions to query private child tables under `authenticated`; a revised attempt found no eligible row for the selected test owner, therefore produced an empty target and was abandoned. **No DELETE success claimed, no persistent deletion**.
5. INSERT not executed: production INSERT fires external live-sync and can have non-transactional side effects.

## Remaining final acceptance
- Actual owner INSERT and DELETE in a controlled staging or disposable test fixture; end-to-end API/browser.
- Actual Strava sync and file import; no duplicates or unnecessary writes to production.
- UI screenshots/functional confirmation for ranking, Territory, regional rings, public stats (iPhone/desktop).
- Follow-up independent Muse audit and final acceptance.

## Security validation already complete
- Anon SELECT/INSERT prohibited; cross-user INSERT rejected.
- Owner-only SELECT RLS row isolation confirmed.
- Owner-only UPDATE in safe transaction now confirmed.
- Public RPC read-only tests independently accepted by Muse.
