# Garmin Stage A — Rollback Candidate / Isolated Test Evidence (2026-11-09)

**Status: draft candidate, independent Muse review required. No production DDL/DML authorized or performed.**
PR #68 remains Draft. This SQL is deliberately not placed under `supabase/migrations` and has NOT run against production.

## Candidate

`supabase/garmin-race-analysis-stage-a-rollback-candidate.sql`:
- Requires one explicit `BEGIN; ... COMMIT;` with `SET LOCAL lock_timeout='3s'` and `statement_timeout='30s'`; must run as a single session and stop on error (`psql -X -v ON_ERROR_STOP=1 -f ...`) only after a separate explicit apply/rollback decision.
- Guard checks for Stage A analysis table, composite index, both purge trigger functions and triggers.
- Guard checks a precise column-name set so later schema extensions cannot silently disappear.
- **Refuses rollback if any analysis row exists**, including test rows. It locks analysis table before checking; a concurrent insert cannot race past the empty check. Do not delete users' analysis just to make rollback pass.
- **Refuses Stage A-only rollback when 4-argument Stage B `garmin_commit_activity` RPC exists**. No automatic cascading destruction.
- Explicit `RESTRICT` prevents removing unexpected dependent objects. Drops only two Stage A triggers, two Stage A functions, Stage A analysis table (with its owned indexes/identity/constraints), and Stage A `runs(id,user_id)` unique index.
- Does **not** delete/alter `public.runs` records, `public.garmin_api_connections`, inbox rows, existing 3-arg RPC, existing Today/Territory triggers. The `runs` index removal itself may take locks, hence the timeout and planned release window.

## CI evidence

PostgreSQL 16 disposable local-only runner, no real Supabase credentials or live user data:
https://github.com/atsuoebara/tree-age-map/actions/runs/42573902680

- Applies original **unchanged** `supabase/garmin-race-analysis-stage-a-apply-candidate.sql` against synthetic tables/roles.
- Inserts one synthetic Garmin run and one synthetic analysis row.
- Attempts rollback: expected failure `STOP: analysis table contains data`; verifies row and original run survive.
- Removes synthetic analysis row, creates synthetic 4-argument Stage B RPC, attempts rollback: expected failure `STOP: Stage B four-argument RPC exists`; verifies Stage A table remains.
- Removes synthetic Stage B function, runs rollback on empty Stage A: success; verifies table/index/purge functions gone, original synthetic run and Garmin connection table survive.
- CI job: **Success**.

This confirms behavior in the disposable PostgreSQL16 simulation, NOT live Supabase17 DDL safety or concurrent production workload behavior. Note that the Stage A SQL body itself remains unchanged: `eb20b8390955bcad86424198ddca9e212add1be8`.

## Stage A recovery gate still HOLD

1. **Manual backup and successful isolated restore rehearsal** remain unperformed on real production backup material. Supabase organization is Free, so do not assume managed daily backup or PITR.
2. **This rollback is conditional**, not universal: if Stage B started, analysis rows exist, object definitions changed, locks time out, or the hosted database differs, it deliberately stops. Do not represent rollback success on the synthetic empty DB as proof of complete disaster recovery.
3. Rollback candidate itself requires Muse independent security/dependency/order audit, plus a separate named operator, timing, and explicit Atsuo approval before any real execution.
4. Follow-up role/access probes with two consenting test accounts remain after the future **separately authorized** Stage A application, and before Garmin optional analysis intake is enabled.

**Recommendation to Muse:** Audit the rollback guards, dependency order, no CASCADE, data-preservation behavior, tight transaction limits and whether additional explicit checks are needed for later-stage dependencies. No merge, deploy or SQL execution on production now.
