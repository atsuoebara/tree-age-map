# Rings Now P2: real DB initializer wired into existing runner (2026-11-17)

**Developer classification: 本道 (existing real runner execution flow), NOT G4 final evidence.** No Docker, SQL, HTTP, Actions or P2 was executed.

## Actual connection

1. Existing ephemeral runtime now creates **three per-run env files plus one private authenticator.sql** (0600). PostgREST URI is no longer a `postgres` superuser connection: it uses a separately randomized `authenticator` password. GoTrue retains a private admin connection solely for initial migrations. No production credentials are used.
2. Existing real Docker adapter has bounded owner-inspected `postgresReady`, `bootstrapPostgres`, `initializeGoTrue`. The bootstrap **reads the original existing** `tests/fixtures/rings-now-p2-isolated-schema-v2-CANDIDATE.sql` and `tests/rings-now-p2-auth-uid-guc-CANDIDATE.sql`, checks their Git blob SHA values against `25a2c3371767be832ec1358a6db39eaa5aac074e` and `7518222c475a2b5b7ef68b2d6776d5e0e6823ae5`, copies both unchanged into the owned disposable postgres container preserving the relative `\\ir` include, then runs `psql -v ON_ERROR_STOP=1 -f` against fixture, followed by private SQL for `CREATE ROLE authenticator LOGIN NOINHERIT` + GRANT anon/authenticated membership. The password is **not in Docker argv**; it resides temporarily in SQL and daemon/container metadata. All candidate SQL/fixture files in main remain unchanged.
3. Existing staged runner now creates PostgreSQL first, probes `pg_isready` (at most 8 attempts), initializes **candidate schema and dedicated authenticator before GoTrue/PostgREST are created**, then starts GoTrue and requests `gotrue migrate`, then creates and starts PostgREST. Any failure aborts subsequent service creation and follows existing run-scoped owned-resource cleanup (including #204 emergency exception path) and always deletes temporary host files using `finally`.

## Honest limits

- These are **wiring and attempted commands**, not boot/SQL/HTTP/JWT evidence. The official PostgreSQL image has not been booted, image digest provenance is not verified, and exact GoTrue binary/migration behavior on the pinned digest has not been exercised. `pg_isready` does not prove the candidate SQL, RLS or JWT. Migration may fail or create conflicting schema; **stop/fail closed** if it does.
- The `psql` command executes the original candidate fixture and a new private role SQL file **only in the disposable PostgreSQL container**, once a future exact-head and G1–G5 approval allows it. It is neither a production SQL migration nor permission to apply it to real Supabase.
- `authenticator` is non-superuser NOINHERIT, but there is no real proof yet that PostgREST SET ROLE maps authenticated JWTs to correct role, or that JWT subject GUC is compatible with `auth.uid()`, or that 1000/1001 rows, revoked ACL, RLS, snapshot RPC or actual GoTrue JWT token work. The **separate snapshot candidate SQL is not loaded by this PR**.
- GoTrue signup/email/SMS are intentionally disabled: no real token issuance. A synthetic-only isolated account/JWT strategy remains to be implemented and audited.
- Docker CLI 15-second timeout does not terminate daemon work. No independent daemon observer, cancellation of hung promises, late-create reconciliation, volume/image cleanup or cryptographic destroy proof. Sensitive container environment and private SQL may persist in daemon/container state after incomplete cleanup. **Do not consider G3 passed**.
- This is not a complete bootable stack or G4 completion. A real, zero-additional-cost, isolation-audited test run requires **separate** G1 provenance, G2 billing proof, G3 independent absence, G4 final audit, G5 Atsuo run approval. H6 remains blocked.

## Review and tests

Developer source V8 shim (not native Node): existing runner **17/17 PASS**, adapter subset **12/12 PASS**. New filesystem/bootstrap tests require Muse to run native Node:
`node --test tests/rings-now-p2-real-docker-runner.test.cjs tests/rings-now-p2-g3-docker-cli-adapter.test.cjs tests/rings-now-p2-ephemeral-service-runtime.test.cjs`

Review exact HEAD, only the 3 existing implementation files and 3 existing test files plus this document. Probe fixture-byte tampering / sha mismatch, role SQL path traversal/ownership, missing privilege grants, migration failure, readiness failure, cross-run spoofing, password in argv, cleanup/secure temporary file disposal. The code must never treat an exit-code zero as G3 or G4 proof. **Mark 本道/横道 first**.

## Safety invariants

Workflow `if: ${{ false }}`; active manifest `BLOCKED_NOT_RUN`, all digest/reference null, checkoutCommit null, additional cost `NOT_VERIFIED`, `explicitExecutionApproval=false`, no production access. Feature OFF / `featureStartedAtMs=null`. PR #109 HOLD. PR #201 HOLD. PR merge, Docker, Actions and P2 executions are NOT authorized.
