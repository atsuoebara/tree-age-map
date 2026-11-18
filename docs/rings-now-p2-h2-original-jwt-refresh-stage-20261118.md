# リングスナウ（Rings Now）— G4/H2 original JWT → fresh owners stage

Base main: 9a0d1fb88958aee12c2ed13b788d877d4652d5e4 (PR #235 merged).

## This offline-only increment

New pure callback-driven `prepareOriginalJwtH2` module performs ordered checks:

1. Require disposable GoTrue TTL=300 and execution budget **already net of cleanup/verify**. Reserve additional execution time for relogin, database seed and seven HTTP cases before starting any expiry wait. Fail closed on insufficient budget.
2. Capture unchanged H1 token for owner A, validate observed claims and exp−iat=300. Neither parsing nor H1 HTTP response proves signature authenticity.
3. Invoke separately supplied expiry-wait callback. Require strict exp+1 wall-clock boundary, exact original token bytes and non-promoted proof status. A callback is **not** by itself authentic real elapsed-time evidence.
4. Only after token expiration, invoke separately supplied refresh callback; require refreshed owners A/B to match original UUIDs and have current live tokens. Refuse regression, expired or mismatched identities.
5. Return only non-secret status fields; H1 refreshed private object and expired JWT are nonenumerable. No real service, SQL, Docker, HTTP, timers or Actions in this PR.

## Missing end-to-end work, intentionally not claimed

- Bind wait callback **only** to #238 real-clock bridge with actual execute deadline and original #236 receipt; confirm deadline remaining immediately before waiting and before/after re-signin.
- Bind refresh callback to two password-grant GoTrue signin requests on already-owned private network, without repeating signup or bad-password H1 cases.
- Supply the unchanged expired JWT to the H2 seven-case collector while live A/B JWTs are revalidated immediately before each request. Keep dedicated no-RPC synthetic negative-role token clearly separate from the original expired token.
- Ensure seed + seven HTTP requests fit remaining execution time; on any failure, retain parent cleanup/verify. Reconcile the guard: **do not remove** `h2_original_gotrue_expiry_not_wired` until a new independent audit of the exact runnable HEAD.
- Verify real GoTrue token provenance, actual PostgREST denial and Docker isolation only after a **separate explicit execution approval**.

## Audit scope

Offline Node:
```
node --check tests/rings-now-p2-h2-original-jwt-stage.cjs
node --check tests/rings-now-p2-h2-original-jwt-stage.test.cjs
node --test tests/rings-now-p2-h2-original-jwt-stage.test.cjs tests/rings-now-p2-h2-refresh-handoff.test.cjs tests/rings-now-p2-h2-gotrue-expiry-receipt.test.cjs tests/rings-now-p2-h2-isolated-gotrue-ttl.test.cjs
```

Stage tests use fake JWTs and callbacks and **do not** prove an actual 300-second wait. Developer has not executed these Node commands in this commit.

Invariant: `BLOCKED_NOT_RUN`, `explicitExecutionApproval:false`, `productionAccess:false`, `checkoutCommit:null`, Actions `if:false`, holds #109/#201 and production OFF remain. No merge or execution is authorized by this Draft.
