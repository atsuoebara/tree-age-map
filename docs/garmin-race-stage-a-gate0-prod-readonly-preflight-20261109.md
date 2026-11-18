# Garmin Stage A Gate 0 — Production READ-ONLY Preflight Report

**Date/time:** 2026-11-09 14:56 JST (database read-only query reported 2026-11-09 05:56 UTC).
**Scope of Atsuo approval:** Gate 0 inspection and stop-condition planning ONLY. **No permission was given to execute the candidate SQL.**
**Project:** `runners-rings` (ref `fhwvntpzwyenendhcgbw`), Supabase status ACTIVE_HEALTHY, Postgres 17.6 / Supabase reported 17.6.1.155. All database queries performed in this task were `SELECT` against system catalogs/stats; no DDL/DML, tests against real user rows, accounts, schema changes, migrations or deployments performed.
**Disposition:** **Read-only schema compatibility checks PASS. Full Gate 0 = HOLD / NOT AUTHORIZED TO APPLY** until all remaining operational preconditions are evidenced and Atsuo separately authorizes the precise production application. This report is not an application permit.

## 1. Immutable candidate checks — PASS

- PR #68 Stage A SQL: `supabase/garmin-race-analysis-stage-a-apply-candidate.sql`.
- PR #67 original: `supabase/garmin-race-analysis-schema-review.sql`.
- Github content blob hash **eb20b8390955bcad86424198ddca9e212add1be8** for BOTH; UTF-8 strings identical (5,957 chars).
- Stage A integrity CI #42569752098: **success**.
- Stage A file is NOT under `supabase/migrations`. Live migration list did not include any Garmin race-analysis migration. These facts prevent accidental standard migration execution as configured; they do not mean no manual executor exists.
- No candidate schema artifacts yet present in live `public`: table `run_race_analysis`, index `runs_id_user_id_race_analysis_uq`, trigger functions `purge_race_analysis_on_soft_delete` and `purge_race_analysis_on_garmin_change`. No naming collision detected.
- Existing `public.garmin_commit_activity(bigint,integer,jsonb)` remains installed, owned by `postgres`, SECURITY INVOKER (not definer), callable by `service_role`, NOT callable by `anon` / `authenticated`; new four-argument overload absent. Stage A must NOT add or call any new commit RPC.

## 2. Base schema / privileges — PASS, subject to test after eventual application

- `public.runs`, `public.garmin_api_connections`, `public.garmin_activity_inbox`: owned by `postgres`, RLS enabled, FORCE RLS false.
- `runs`: `id bigint` PK, `user_id uuid` (nullable), `source text`, `deleted_at timestamptz`. Existing `runs_user_id_fkey` to `auth.users` is NO ACTION. `id,user_id` are available for candidate unique index + owner composite FK.
- `garmin_api_connections`: `user_id uuid` PK, `garmin_user_id text`, `permissions jsonb`, `import_enabled boolean`, `connection_version uuid`, `permissions_checked_at timestamptz` all exist.
- `garmin_has_export(jsonb)` exists and checks `ACTIVITY_EXPORT` permission; SQL IMMUTABLE, schema-qualified usage compatible with candidate trigger.
- Roles: `authenticated` and `anon` do NOT BYPASSRLS, `service_role` and `postgres` DO. `authenticated` lacks any table privileges on private Garmin inbox and connection tables. `runs` has broad table grants including `anon` but RLS policies **only TO authenticated**, scoped to `auth.uid() = user_id` for select, insert, update, delete. Grants alone do not grant anon row visibility.
- Existing Garmin connection trigger: `garmin_cancel_queue` **BEFORE DELETE OR UPDATE** of `import_enabled,permissions,connection_version,garmin_user_id`, active. New candidate trigger will run AFTER these changes. Important to observe both on authoritative reconcile/disconnect/disable when eventually applied.
- Existing runs triggers: `b1_runs_invalidate` (statement-level AFTER INSERT/DELETE/UPDATE), `trg_rings_today_live_sync` (row-level AFTER INSERT or update of route/distance/date/deleted_at). Candidate new soft-delete trigger will also run on deleted_at updates; test existing Territory and Today behavior with it installed.
- Approximate `pg_stat_user_tables.n_live_tup`: `runs` **24,943**, `garmin_api_connections` **5**, `garmin_activity_inbox` **28** (these are stale statistical estimates, NOT exact counts). `runs` approx **18MB heap, 174MB including indexes/TOAST**. Adding `CREATE UNIQUE INDEX` on live runs takes locks: schedule carefully and monitor lock/statement timeout; current draft SQL uses regular INDEX creation, not CONCURRENTLY. Do not promise zero latency impact.
- No candidate table-specific live RLS policy/grants yet exist because table is not created. Existing `runs` policy is compatible, but actual owner-only access and denial cases must be probed after future application.

## 3. Unresolved operational blockers (STOP until evidenced)

1. **Restore/recovery proof not established.** The available Supabase project and migration introspection does not verify availability, current recovery point, restore permissions or a tested recovery method. Design an audited, permissioned reversal strategy; after COMMIT, plain `ROLLBACK` is insufficient. Do not blindly DROP a table potentially holding analysis. Determine whether provider backups/PITR are available for this project and confirm a feasible recovery plan without adding cost.
2. **Stage A live test accounts/probe evidence pending.** Need **two authorized synthetic test accounts**, service-only fixture path, verified cleanup, table-level RLS SELECT/INSERT/UPDATE/DELETE denial and approval; this is a post-application gate, NOT to be pretended as already satisfied. **RPC EXECUTE tests are Stage B**, per Muse audit. Do not enable receiver before role probes and cleanup pass.
3. **Production operator and release-window safeguards not yet verified.** Determine the narrowly authorized DB operator, deployment freeze, short `lock_timeout` / `statement_timeout` plan, how to detect a slow `runs` index build on ~25k rows, how to stop if existing runs imports are impacted, and a clear approved rollback/recovery owner. These must be established prior to any application.
4. **Explicit separate application authorization has not been granted.** User authorized only Gate 0 read-only inspection, not candidate SQL execution or PR merge. Ask for an explicit go/no-go only after operational blockers are addressed and independent review is complete.

## 4. Staged application safety checklist (not executed)

**Before:** recheck candidate hash + exact DB objects/grants/triggers immediately before execution; verify recovery; choose safe application window; lock/statement timeouts; authorized operator. Stage A is schema only and no receiver feature flag is enabled.

**After a separately authorized apply:** inspect object existence, SECURITY DEFINER owners, function EXECUTE grants, RLS and sequence privileges; run two-account owner/nonowner table probes with synthetic fixtures; test authenticated soft-delete analysis purge and service-role revoke/disable/disconnect purge; inspect effect of existing `garmin_cancel_queue`, `b1_runs_invalidate`, `trg_rings_today_live_sync`; clean fixtures; check existing run insert and Garmin intake. **Stop** and leave the optional-analysis receiver disabled if any result disagrees.

**Later:** four-argument RPC belongs to Stage B; display localization/coverage % belongs to Stage C; limited Edge observations belong to Stage D. Stage A must not connect any of them.

## 5. Go/no-go summary

| Check | Result |
|---|---|
| Exact candidate against approved PR #67 | PASS |
| Live project and baseline tables, RLS, roles, functions and triggers | PASS |
| No naming conflicts and no prior application | PASS |
| Existing trigger interactions documented | PASS as inventory, untested with candidate installed |
| Backup/after-commit recovery feasibility | **NOT VERIFIED — STOP** |
| Release operator, timeouts/window plan | **NOT VERIFIED — STOP** |
| Live two-account role probes | **AFTER-AUTHORIZED-APPLY condition** |
| Owner's explicit permission to apply Stage A | **NOT GRANTED — STOP** |

**Bottom line: Gate 0 technical READ-ONLY inventory succeeded, but readiness to apply is ON HOLD. Do not execute SQL, merge PR #68, enable receiving or create paid Supabase branches.**
