# P2 authentication negative contracts — offline-only (2026-11-17)

**Classification: 本道の安全テスト追加。ただし G4 実証ではない。**

## Scope

- Adds only `tests/rings-now-p2-auth-negative-offline.test.cjs` and this document.
- No modifications to runners, Docker adapter, production UI, SQL, runtime, manifests, Actions or deployments.
- A locally generated per-run synthetic owner/other-user JWT can be prepared with existing code. This is **not** GoTrue issuance, signature verification by PostgREST or a live HTTP request.
- Simulated HTTP 401/403 responses have their bodies discarded, and the existing snapshot validator refuses their promotion to success.
- A foreign user row and mismatched counts are refused by the existing result validator.
- A 0600 synthetic request is removed by runtime dispose; this checks host-file lifecycle only, **not** Docker daemon secrets.
- A current manifest test enforces `BLOCKED_NOT_RUN`, null image references/digests, denied approval and no production access.

## Run without Docker

`node --test tests/rings-now-p2-auth-negative-offline.test.cjs`

This command is an offline native Node test. It does not start Docker, access Supabase or use network IO. This PR's tests have not been executed by the authoring agent; independent reviewer should run them at exact HEAD.

## G4 still open

- Real PostgREST rejection of expired or bad-signature JWT, anonymous/unauthorized requests and true user-to-user RLS isolation
- Real GoTrue-issued token path
- Real Docker image compatibility, service startup, PostgreSQL/SQL and HTTP 1000/1001 behavior
- Independent teardown and daemon-side secret residue verification

**Do not equate mock status codes, local JWT preparation or shape validation with G4.**

## Stop conditions

Keep main and deployment unchanged until independent review and explicit merge approval. No execution of actual Docker, SQL, Actions or P2; no production connection. PR #109/#201 HOLD, feature OFF, feature start timestamp null, extra cost not verified. The separate PR #213 must not be silently imported.
