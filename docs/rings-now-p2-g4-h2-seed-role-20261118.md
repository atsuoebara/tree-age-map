# Rings Now G4-H2 — isolated seed and NO-RPC role (DORMANT)

This PR is **SQL preparation only**. The generated SQL must NEVER be run against Supabase, production data or existing user identities. No SQL is executed in this PR.

**Inputs:** two distinct, validated H1 GoTrue-issued UUIDs, passed in memory after successful isolated signin. This module cannot prove their provenance; the future runner must enforce that precondition.

**Preconditions:** an empty, run-owned disposable PostgreSQL database with the existing audited candidate schema and snapshot RPC installed; FORCE RLS remains on. A preflight aborts on non-empty runs, missing table/RPC/RLS, preexisting denied role or anon EXECUTE. It uses one BEGIN/COMMIT and ON_ERROR_STOP.

**Fixture:** one row for A and one for B, different distances and timestamps. The future H2 runner must check that B's row exists with its own token yet A cannot read it. The existing separate 1000/1001 PostgreSQL probe does ROLLBACK and cannot substitute for this durable isolated fixture.

**Denied role:** role p2_h2_no_rpc NOLOGIN NOINHERIT; authenticator granted membership (so role switching is possible); PUBLIC schema USAGE for role only, **no RPC EXECUTE**. Static SQL rechecks has_function_privilege and rejects login/rls-bypass role attributes. An H2 signed token with the special role is NOT provisioned by this PR and needs future signing/transport design with independent review; never pass service-role credentials.

**No action:** does not wire SQL into the adapter/runner, execute psql/Docker/Actions, alter canonical candidate SQL, enable G4, or change public UI. Manifest BLOCKED_NOT_RUN, explicitExecutionApproval=false, productionAccess=false, workflow if:false, hold #109/#201 remain.

Review: node --check both new CommonJS files; node --test tests/rings-now-p2-h2-isolated-seed-sql.test.cjs; inspect injection rejection and privilege checks. Actual PostgreSQL semantics and effective role/RLS privileges remain UNVERIFIED until a separately authorized run.
