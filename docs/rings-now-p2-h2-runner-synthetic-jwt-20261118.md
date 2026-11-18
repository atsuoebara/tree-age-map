# Rings Now G4 H2 — combined dormant runner wiring, A/B SQL, signed synthetic negative JWT

Scope: H1 real GoTrue signin -> keep A/B tokens/IDs in memory -> run-owned A/B SQL seed via 0600 host file and owned postgres-only psql -> issue two **synthetic test** JWTs signed by the same random per-run isolated HMAC secret that both GoTrue and PostgREST use -> seven fixed H2 requests through audited no-published-port internal transport -> checked nonsecret results -> cleanup.

## Exact evidence boundary

- The H1 owner A/B tokens come from GoTrue HTTP, but the **expired JWT and restricted-role JWT are synthetic**, signed locally by the runtime. They are neither GoTrue-issued nor a proof that a once-valid GoTrue token later expired naturally. They do exercise signature-valid expired claims and a valid signed custom role against isolated PostgREST, if later actually executed with approval.
- This PR contains offline test code and adapter/runner code only. The active manifest still denies execution. No Docker, psql or network was run by this change. CI must not be interpreted as actual SQL or JWT authentication proof.
- The SQL string is accepted by the adapter only if it matches the exact audited generator on validated distinct UUIDs. Only run-owned postgres is inspected before copying it, with a 0700 private directory and 0600 temporary host SQL file. Secret-bearing H2 requests use the existing audited H2 adapter. Adapter execution errors fail the run and trigger owned cleanup.
- Fixed ownership rule: the 2-row fixture has A and B each one row; success cases verify exactly one row with the corresponding owner ID. The zero-row synthetic-only probe is intentionally **not** invoked after A/B seeding.
- Returned outcomes never contain JWT, passwords or SQL and always retain g3Verified=false, actualP2Proven=false, p2ExecutionAuthorized=false. Local synthetic JWT injection is not authorization and does not switch on production.
- Still outstanding for final G4: proof using real GoTrue-issued JWT genuinely aged past exp, independent isolation audit of the exact runnable head, authentic network and PostgreSQL observations, real container teardown and cost/permission confirmation. Any real execution requires separately explicit owner approval.

## Audit commands (offline only)

node --check tests/rings-now-p2-ephemeral-service-runtime.cjs
node --check tests/rings-now-p2-g3-docker-cli-adapter.cjs
node --check tests/rings-now-p2-real-docker-runner.cjs
node --test tests/rings-now-p2-real-docker-runner.test.cjs tests/rings-now-p2-h2-private-transport.test.cjs tests/rings-now-p2-h2-signed-runtime.test.cjs tests/rings-now-p2-h2-sequence.test.cjs tests/rings-now-p2-h2-postgrest-http.test.cjs tests/rings-now-p2-h2-isolated-seed-sql.test.cjs

Review synthetic signer provenance, preflight order and separate genuine expiration requirement, H1 response confidentiality, exact SQL and owner-label checks, 0600 file teardown, no H2 after failed seed, full 7-case checks, zero empty-owner probe after seeding, all cleanup paths and existing fake runtime backwards compatibility.

No workflow/manifest/SQL candidate/production HTML changes; BLOCKED_NOT_RUN, checkoutCommit:null, productionAccess:false, explicitExecutionApproval:false, workflow if:false and holds #109/#201 stay. No merge without Atsuo independent approval.
