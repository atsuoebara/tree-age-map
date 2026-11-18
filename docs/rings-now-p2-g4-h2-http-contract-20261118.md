# Rings Now — H2 PostgREST HTTP contract (NOT RUN)

This PR adds a pure non-I/O contract for seven fixed H2 cases, not runner wiring or actual H2/G4 proof.

Cases: anonymous, owner A, foreign row requested by A, owner B, bad signature, genuinely expired JWT, and dedicated no-RPC-grant role. Exact target is internal postgrest:3000 and the candidate snapshot RPC; arbitrary URLs are forbidden.

Expiry must occur on an authentic signature-intact GoTrue-issued token before request; editing the exp claim is not acceptable. The no-grant case requires separate isolated-role provisioning and ACL audit, not recycling authenticated or service_role. These are OPEN implementation tasks, not established results.

For owner/foreign cases the existing candidate RPC shape validator checks each returned row user_id and expected row count. The future runner MUST seed A and B fixtures independently and prove that B rows exist but are absent for A; an empty synthetic response does not prove isolation.

The reporter includes only case, service, HTTP status. JWT, email, password and response bodies are excluded. h2Verified/g4Verified remain false. Fake test tokens and caller-reported status are not independent proof.

No changes to H1 runner, SQL, Docker adapter, manifest, Actions, production access, or spending. Existing G4 execution remains BLOCKED_NOT_RUN and if:false. This PR is Draft until separate owner approval.

Review: node --check both H2 files; node --test tests/rings-now-p2-h2-postgrest-http.test.cjs tests/rings-now-p2-h1-h2-evidence.test.cjs; verify denial/foreign/expired/role negative tests and no code path claims G4 proof.
