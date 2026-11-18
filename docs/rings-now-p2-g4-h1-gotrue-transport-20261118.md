# Rings Now — GoTrue H1 private HTTP collector, staging only

Adds a fixed-cases H1 request/response orchestrator. A caller must supply the actual isolated transport; no network, Docker or filesystem side effect exists on import. It is designed for the next runner integration with run-owned Docker's internal GoTrue service.

- POST to fixed internal `gotrue:9999/signup` and `/token?grant_type=password`, using two random `example.invalid` identities and 64-digit generated hex passwords; wrong-password negative test.
- Reads HTTP statuses and checks login JWT payload's subject, audience, role and lifetime against the returned user ID; not cryptographic verification.
- Passes **only** case/status/token shape to #227's non-secret evidence recorder; raw request, email, password, bearer JWT and response body never enter evidence.
- Tokens are returned in a clearly marked PRIVATE in-memory slot to feed future internal PostgREST H2. Never log/serialize it.
- Fixed case order and mandatory two distinct signer identities; failures throw rather than forge observations.
- Pure offline Node tests can use fake transport; such tests do **NOT** constitute GoTrue issuance proof.
- **Not yet wired to the actual Docker runner or adapter.** In particular the current GoTrue service has signup disabled; the next PR must change **isolated-only** auth environment, use a private request file, no external email/SMTP, and execute an internal HTTP transport without leaking any request or reply. That must pass independent audit prior to any run.

No manifest, workflow, checkout, billing, production setting, Docker, SQL, service configs or approvals changed. Real H1/H2/G4 remain NOT PROVEN.
