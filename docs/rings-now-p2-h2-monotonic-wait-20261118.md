# Rings Now G4 H2 — bounded monotonic clock waiting (DORMANT)

Independent from PR #235, based on merged #236. This PR adds a pure, injected-clock WAIT CONTRACT. No actual system time, network, Docker, filesystem, psql or timer is invoked by this helper. Offline unit tests inject fake clocks and fake sleep only.

It calculates the strict expiration threshold exp+1 seconds using the untouched original GoTrue H1 JWT receipt, and refuses waiting when the required time exceeds either 540 seconds or the remaining execute budget after keeping cleanup/verification reserves. It rejects pre-expired observations, regressions, missing reserves, incomplete sleep, insufficient monotonic elapsed, wall clocks that have not passed exp, and attempts to expose an expired token early. Requests are split into chunks of at most 30s and at most 20 steps.

**Limitations:** callers can inject fake clocks and callbacks. Therefore this code alone is NOT cryptographic, real-clock or G4 evidence; realElapsedTimeVerified remains false. Actual runner wiring must use fixed performance.now + trusted wall-time (not user-controlled), verify a GoTrue token was issued in the isolated environment, enforce the shared 10-minute execution/cleanup deadline, and make PostgREST reject the original token. No real wait is performed by this PR.

Potential TTL issue: standard GoTrue access tokens can exceed the allowed wait window. Future approved isolated GoTrue configuration needs exact TTL and test evidence, rather than changing current production auth. Never accelerate wall clocks or modify JWT exp. If validity exceeds remaining budget, BLOCK rather than fake an expired token. Reauth A/B after wait may be required to keep positive tests valid.

Existing code, runtime, manifest, workflow and production stay unchanged. BLOCKED_NOT_RUN / explicitExecutionApproval:false / productionAccess:false / workflow if:false / #109 #201 HOLD. No merge without separate owner authorization.

Offline audit: node --check tests/rings-now-p2-h2-gotrue-monotonic-wait.cjs and node --test tests/rings-now-p2-h2-gotrue-monotonic-wait.test.cjs tests/rings-now-p2-h2-gotrue-expiry-receipt.test.cjs. Review synthetic clock failure tests and race/budget edges; no actual G4 claim.
