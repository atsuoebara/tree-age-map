# P2 isolated stack — static safety gates (NOT RUN)

2026-11-17. This change adds **offline-only** configuration inspectors and unit-test definitions. It does not activate GoTrue, PostgREST, PostgreSQL, Docker or Actions, does not apply the candidate SQL and does not claim an A1–A6 result.

- `tests/rings-now-p2-stack-static-gate.cjs` verifies immutable image references and their matching digests, checkout commit pinning, billing/auth/audit/owner approval flags, explicit production-access denial and absence of forbidden production environment variables. It also checks manual-only workflow text and the hard stop.
- `tests/rings-now-p2-stack-static-gate.test.cjs` contains offline negative cases against the checked-in BLOCKED manifest and disabled workflow. **Tests have not been run by this change.**
- No manifest values were upgraded to PASS; no digest, compatibility, pricing or audit evidence has been fabricated.

**Important:** A static `pass` is only a syntactic gate, not proof that an image is official, the digest matches a registry, JWTs really validate, billing is zero or isolation works. The `PROVEN_BY_ISOLATED_HTTP` and `VERIFIED_FOR_THIS_RUN` strings are future evidence placeholders, *not* permissions to run anything. Runtime execution remains blocked by the unchanged `if: ${{ false }}` and requires a separately audited change and Atsuo's explicit approval. No code in this PR is wired into that workflow.

Review focus: no network/process effects on import, immutable references required, fail-closed defaults, absence of production access, and no alteration to PR #109 HOLD, production OFF, or started_at null.

## Two separate evidence stages (2026-11-17)

1. **Static preflight:** `inspectP2Preflight()` checks the declared image pins, checkout SHA, billing/audit/owner approval markers, no production credentials, and manual-only stopped workflow. It deliberately does **not** require real HTTP/JWT proof from services that have not yet been started. Current manifest remains BLOCKED.
2. **Postflight declaration check:** `inspectP2Postflight()` additionally requires `authJwtCompatibility: PROVEN_BY_ISOLATED_HTTP`. That text value alone is **not evidence**. Independent reviewers must examine redacted original HTTP/JWT logs, timestamps and provenance before assigning A1–A6 PASS.

Neither function is connected to Actions; neither is authority to remove `if: ${{ false }}`, dispatch a run, or change SQL/DB. A static PASS only establishes syntactic declarations. Actual billing evidence and owner approval are external, separately recorded gates; placeholders may not be self-certified. P2 run approval remains NO.
