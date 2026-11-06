# runs RLS post-fix RPC read-only checks — 2026-11-06

**Scope:** database-only, non-mutating checks after migration `restrict_runs_rls_to_owner_only_20261106`. No production writes or policy changes in these checks.

## Result summary

| Check | Database outcome | Interpretation |
|---|---|---|
| anon `ranking_distance(2026)` | 26 rows | SQL function executes |
| anon `ranking_distance_monthly(2026,11)` | 26 rows | SQL function executes |
| anon `ranking_nations(2026)` | 2 rows | SQL function executes |
| anon `ranking_explore(2026,'JPN')` | 0 rows | Function executes; expected row count NOT established |
| anon `territory_leaders(2026)` | 34 rows | SQL function executes |
| anon `territory_my_lead_count(2026,'JPN','MUNICIPALITY')` | permission denied (42501) | Intended private function not executable by anon |
| anon `get_my_region_rings('JPN','1001',2026)` | permission denied (42501) | Intended private function not executable by anon |
| authenticated with JWT sub matching an existing owner; `territory_my_lead_count(2026,'JPN','MUNICIPALITY')` | 15 | Function executes in role simulation |
| authenticated with JWT sub matching same owner; `get_my_region_rings('JPN','1001',2026)` | 0 rows | Function executes; region code is a placeholder, so no positive data assertion |

**Important boundaries:** Results were gathered via production SQL session using `SET LOCAL ROLE` and a transaction-scoped `request.jwt.claim.sub` to simulate roles, with `ROLLBACK`. These are not end-to-end browser/API tests. Report counts only, not athlete details. Do not treat 0 rows as a failure or success of data correctness without expected fixtures.

## Prior verified security checks
- Broad `runs` SELECT/INSERT `PUBLIC` RLS policies dropped.
- Four owner-only CRUD RLS policies remain.
- Anonymous SELECT returned 0; Muse independently verified that public API returns zero.
- Anonymous INSERT and cross-user INSERT denied in rollback-isolated DB tests.
- Owner-scoped SELECT returned 1822 runs for one simulated owner, no other owners.

## Outstanding final-acceptance items
1. Authenticated owner INSERT, UPDATE, DELETE end-to-end behavior. Production `runs` writes have `trg_rings_today_live_sync` which initiates an external HTTP call; a rollback may not cancel all external effects. Prefer controlled existing workflow/test fixture or staging.
2. Ranking, Territory, region rings, public statistics in iPhone/PC UI, including EXPLORE and data correctness.
3. Strava synchronization and one file import, verified without duplicating production activity.
4. Independent audit of outcome before closing the incident.

## Journal auditor follow-up
Plan already saved in `docs/journal-auditor-readonly-rollout-20261106.md`. Do not deploy the auditor account or policy until the acceptance process authorizes it.
