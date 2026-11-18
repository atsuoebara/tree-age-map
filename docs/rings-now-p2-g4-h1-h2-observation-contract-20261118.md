# Rings Now G4 — H1/H2 non-secret evidence contract, phase 1

2026-11-18. **Draft only, not an executable HTTP/G5 change.**

## Why
Current isolated runner creates disposable GoTrue and PostgREST services, but HTTP evidence remains a locally signed synthetic JWT and an empty-owner smoke case. It cannot establish genuine GoTrue token issuance, PostgREST authenticated owner/foreign responses, or PostgREST claim/GUC compatibility. This PR defines the *non-secret observation boundary* to enable that wiring in the next phase.

## Scope
- New pure CommonJS module with a fixed 12-case allowlist: H1 two fictional signups, two logins, bad-password rejection; H2 anonymous, owner A/B, foreign A, invalid signature, expired token and RPC permission cases.
- Accepts observations only as strictly labeled service + HTTP status, with optional *shape-only* token inspection for GoTrue. Sanitizes away raw JWT, passwords, emails, response body and arbitrary caller fields. No raw payload forwarding or writes.
- Always returns `h1Verified=false`, `h2Verified=false`, `g4Verified=false`; even a complete fixture set cannot falsely satisfy the final evidence gate.
- Missing or duplicate cases, mismatched services, caller-forged positive audit and wrong token handling are negative tests.
- **Not yet wired to Docker**. Adding actual GoTrue signup/signin inside the isolated network, actual tokens, multi-case internal PostgREST calls, response status assertions, and independent evidence provenance remains required. The local HS256 synthetic token is not proof.

No changes to workflow, manifest, approvals, DB, production, image digests, checkoutCommit, or real execution. Node test: `node --test tests/rings-now-p2-h1-h2-evidence.test.cjs`. No network or paid services.
