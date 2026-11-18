# Rings Now P2 — SQL-level RLS probe directly wired into existing real runner

Developer classification: **本道**, but **not** an executed database proof, signed-JWT HTTP proof, G3 proof, or G4 final audit.

## New actual connection
The already merged #210 runner now invokes `driver.probeSqlRlsBoundary(runId)` immediately after successful exact fixture, authenticator role, and snapshot RPC candidate creation, **before** GoTrue/PostgREST are created. Existing failure paths block downstream containers and clean run-owned resources; a failed SQL assertion cannot be promoted to PASS.

The existing Docker CLI adapter adds a method that:
- Uses the actual byte contents of `tests/fixtures/rings-now-p2-sql-rls-assertions-CANDIDATE.sql` only if Git blob SHA equals `b0f323d8c5b17a50f23b41e199f456bbc8caa8aa`;
- Validates the run identifier and exact Docker owner label before `docker cp`, then again before `docker exec ... psql -v ON_ERROR_STOP=1 -f`;
- Targets only the disposable `rings_now_p2` database in the run-owned PostgreSQL container. Does not touch production or connected Supabase.

The new SQL probe is **a single BEGIN/ROLLBACK transaction**, synthetic UUIDs only, no real user records or production credentials. It seeds 1000 own records and one foreign record; switches to `authenticated` SQL role and sets the two JWT-related GUC values to test: 1000 own rows, zero foreign rows, disagreeing JWT subject GUCs fail closed; seeds the 1001st own row and asserts `too_many_rows`; switches to `anon` and asserts EXECUTE is denied. `ROLLBACK` discards seed data. A SQL error causes psql nonzero and the runner fail-close path. No signed JWT or HTTP traffic is generated.

**Developer scope test:** GitHub source syntax and mocked command/runner tests only; native Node independent Muse review requested. Future actual RLS/ACL behavior must be validated by executing this script inside an approved isolated database, which has not happened.

## Not solved
- The SQL probe uses psql with `SET LOCAL ROLE` and manually set claim GUCs. It **does not exercise PostgREST's JWT signature, expiration, claim-to-role mapping, HTTP status, or GoTrue real token issuance**. PR #215 has connected Docker-internal HTTP without published ports. It remains intact in this integration but is not yet proven by an actual Docker run; a synthetic JWT/zero-row HTTP smoke is not signed-JWT rejection, GoTrue issuance, cross-user RLS, or 1000/1001 HTTP proof.
- No real Postgres/GoTrue/PostgREST images were booted. Bootstrap migrations or `DO` permissions may fail. The isolated SQL proof can be accepted only after independent real execution and correct result collection.
- Daemon independent existence/termination, late-creates, timeout recovery, costs, image provenance and signed-JWT HTTP/1000/1001 remain unmet for G1/G2/G3/G4/G5/H6.
- Original candidate SQL `docs/rings-now-single-statement-snapshot-CANDIDATE.sql`, current schema fixture, auth.uid fixture, workflow, active manifest remain unchanged. No separate owner SQL execution approval has been granted, so this code must **not** be run.

## Requested Muse review
Review exact HEAD; run native `node --test tests/rings-now-p2-real-docker-runner.test.cjs tests/rings-now-p2-g3-docker-cli-adapter.test.cjs tests/rings-now-p2-ephemeral-service-runtime.test.cjs`. Probe run/owner spoof, 1-byte SQL fixture tampering (reject before Docker CLI command), SQL RLS assertion failure, cleanup after SQL failure, 1000/1001 boundary/foreign user/anon denial and no evidence inflation. Look for SQL role inheritance, `ROLLBACK` correctness, and invalid results on server errors. Classify 本道 vs 横道 first.

**Safety invariant:** workflow still hard disabled `if: ${{ false }}`, active manifest `BLOCKED_NOT_RUN`, digest all null, billing `NOT_VERIFIED`, approval false, production OFF and start null; PR #109 HOLD; PR #201 HOLD. No merge/Actions/Docker/P2/SQL approval.

## Integration on current main (2026-11-18)

Preserves #215 internal HTTP and #217 offline JWT negative contracts; imports #213 SQL probe and tests without overwriting newer main files. Requires independent native Node regression tests and re-audit of this integration HEAD prior to merge. No approval for P2, real Docker, SQL, Actions, production or feature activation; G1-G5/H6 remain unproven.
