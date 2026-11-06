# Journal auditor RLS preflight — 2026-11-06

Status: **Preflight checks passed. Auditor account NOT created; auditor-specific policy NOT applied.**

## Database policy inventory
Six authenticated-readable public tables were identified; all have RLS enabled:
- `journal_posts`: five owner-specific/public-published policies
- `ranking_settings`: three owner-specific policies
- `region_rings_consent`: three owner-specific policies
- `runs`: four owner-specific policies following removal of two broad-access policies
- `strava_connections`: one owner-specific ALL policy
- `strava_oauth_states`: one owner-specific ALL policy

All the above private-data access predicates use `auth.uid()=user_id`, or the fixed journal owner UID. No all-user `USING(true)` or `WITH CHECK(true)` policies were found in these tables.

## Controlled production role simulation (read-only)
Executed a transaction with `SET LOCAL ROLE authenticated` and a non-owner dummy request JWT subject (`00000000-0000-0000-0000-000000000001`). Results:
- `runs`: 0 rows
- `ranking_settings`: 0 rows
- `region_rings_consent`: 0 rows
- `strava_connections`: 0 rows
- `strava_oauth_states`: 0 rows
- unpublished `journal_posts`: 0 rows
- published `journal_posts`: 50 rows

Transaction ended in ROLLBACK. No content was exposed or modified; only counts are recorded. This is a SQL-level authorization simulation, not a real Supabase Auth login/REST API check.

## Next step
1. Create one **real** auditor account via Supabase Auth; register the exact verified UID. Do not send password or bearer token through chat.
2. Run the UID-specific SELECT-only RLS migration in `docs/journal-auditor-readonly-rollout-20261106.md` (after independent review).
3. With real auditor login, verify draft SELECT succeeds; access to private non-Journal tables and UPDATE/DELETE/INSERT does not succeed.
4. Revoke access by dropping the single auditor SELECT policy and disabling account if necessary.

**Do not treat a dummy UID simulation as the actual auditor login acceptance test.**
