# C4 Supabase role-fidelity audit evidence — 2026-11-09

**Status: candidate evidence for independent Muse review; NOT live Supabase integration proof.**

## Read-only production catalog inspection
No production DDL, DML, role changes, test users, or private rows were used.

Observed in live project `fhwvntpzwyenendhcgbw`:
- `anon`: `rolbypassrls=false`, `rolsuper=false`, `rolcanlogin=false`.
- `authenticated`: `rolbypassrls=false`, `rolsuper=false`, `rolcanlogin=false`.
- `service_role`: `rolbypassrls=true`, `rolsuper=false`, `rolcanlogin=false`.
- `postgres`: `rolbypassrls=true`, `rolsuper=false`, `rolcanlogin=true`.
- Existing `runs`, `garmin_api_connections`, `garmin_activity_inbox`: owned by `postgres`, RLS enabled, no FORCE RLS.
- `authenticated` has no SELECT/INSERT/DELETE grant on private connection and inbox tables; `service_role` has INSERT on these.
- `authenticated` has SELECT, INSERT, DELETE grants on runs, whose RLS policy provides the ownership restriction; do not claim grants alone are read/write access.

## CI fixture / evidence
Run: https://github.com/atsuoebara/tree-age-map/actions/runs/42567319037

- Disposable `garmin_role_ci` PostgreSQL 16; `PGHOST=127.0.0.1`, strict CI database guard.
- Applies actual *review-only* schema and 4-arg commit RPC files from PR #67 unchanged.
- Creates synthetic `auth.uid()` and representative runs owner SELECT/UPDATE policies (these **are mocks of the existing project policies**, not Supabase Auth itself).
- Creates distinct `anon`, `authenticated`, `service_role BYPASSRLS` PostgreSQL roles and grants representative of catalog observations; tests via actual `SET ROLE`, not superuser-only execution.
- Authenticated owner A can SELECT exactly own analysis; can't INSERT/DELETE analysis, SELECT private Garmin connections, or EXECUTE 4-arg commit.
- Anon can't SELECT analysis or EXECUTE 4-arg commit.
- Service role can read across owners (BYPASSRLS) and execute real 4-arg commit to create canonical Garmin run.
- Authenticated owner A can soft-delete own run, triggering SECURITY DEFINER analysis purge while B analysis remains untouched.
- CI job `success`.

## Remaining restrictions
**This is a high-fidelity isolated role simulation, not an execution on the real hosted Supabase roles.** It does not test real HTTP/PostgREST JWT claims, live grants to the *not-yet-created* `run_race_analysis` table, or real Supabase auth/storage. No migration was applied to production. Treat C4 as **provisionally met by isolated role fidelity evidence**, awaiting Muse opinion on whether the criterion explicitly requires a fully ephemeral Supabase instance (or local Supabase stack) rather than a PostgreSQL role replica. Do not declare all production authorization validated.
