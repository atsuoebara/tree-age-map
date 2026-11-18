# Rings Now G4 — dormant runner H1 GoTrue wiring (2026-11-18)

This is **code-only staging**, not H1 or G4 proof and not permission to execute.

## Scope
- The run-scoped ephemeral runtime generates two distinct, random `example.invalid` identities, with 64-hex passwords. H1 credentials are non-enumerable so accidental `JSON.stringify(runtime)` does not reveal them.
- Only the **disposable** `gotrue.env` changes to `GOTRUE_EXTERNAL_EMAIL_ENABLED=true`, `GOTRUE_MAILER_AUTOCONFIRM=true`, and `GOTRUE_DISABLE_SIGNUP=false`. The network remains Docker `--internal`, no host port, no SMTP configuration, no public signup or production Auth change. Confirm real GoTrue version's behavior in the future isolated run; configuration alone is not proof.
- After all three run-owned containers start and GoTrue migration is invoked, the dormant runner calls `collectH1OverTransport` with `driver.probeInternalGoTrue` for the five fixed H1 signup/signin/bad-password cases. The adapter (PR #229) checks exact Host/path, request format, private temp files and owner label.
- H1 JWTs exist only in short-lived in-memory return objects, never in the runner result, progress strings or observations. H1 evidence and the collector deliberately keep `h1Verified=false`; the runner records only the non-secret note that the five cases were *CLI reported*.
- Any H1 status mismatch, missing adapter, mismatched account or HTTP failure throws into the existing fail-closed execute stage; owned-resource cleanup and verification remain mandatory.
- The existing synthetic-JWT PostgREST 0-row smoke is **unchanged**, and remains clearly separate from GoTrue issuance and H2 authentication proof.
- The previous offline fake runtime fixtures that don't expose H1 credentials preserve legacy CLI lifecycle tests; new synthetic tests cover runner call order and cleanup on H1 failure.

## Unchanged hard gates
- `.github/workflows/rings-now-p2-isolated-manual.yml` still has `if: false`.
- `tests/rings-now-p2-isolated-manifest.json` remains `BLOCKED_NOT_RUN` with `explicitExecutionApproval=false`, `checkoutCommit=null`, `productionAccess=false`.
- No Docker invocation, SQL application, Actions dispatch, production enable, database operation, spending authorization, or PR merge is part of this PR.

## Independent review instructions
1. `node --check` both modified CommonJS files and both tests.
2. Run `node --test tests/rings-now-p2-ephemeral-service-runtime.test.cjs tests/rings-now-p2-real-docker-runner.test.cjs tests/rings-now-p2-h1-gotrue-http.test.cjs tests/rings-now-p2-g3-docker-cli-adapter.test.cjs`.
3. Verify H1 is called only after GoTrue migration and container creation; negative HTTP/ownership failures do not leak user data or produce PASS; cleanup always runs.
4. Verify `GOTRUE_MAILER_AUTOCONFIRM` and email/signup config against the exact pinned GoTrue image, and that no actual email or internet exit is introduced by this code.
5. Perform static manifest/workflow and diff check; never run real Docker without separate final approval.

Open: real GoTrue HTTP evidence, full H2 owner-isolation/boundary tests, external secret-safe evidence provenance, A/B immutable commit transition, independent full G4 audit, final bounded G5 consent.
