# リングスナウ（Rings Now） G4/H2 — dormant runner wiring (2026-11-18)

Base: main e6e1176eb88f22ce884ed5c4ed6ca81edf82e691 (#240 merged).

## Changes
- Adds a dormant bridge to original H1 token receipt/TTL gate (#236/#239), real-clock expiry helper (#238), refreshed A/B GoTrue password-grant signins (no repeated signup), identity-preserving handoff (#235/#240), and seven H2 PostgREST cases.
- Reads **only** disposable GOTRUE_JWT_EXP/GOTRUE_JWT_AUD from the 0600 per-run env file. Avoids exposing secrets in outputs.
- Keeps the expiring JWT exactly from the first GoTrue H1 login. After exp+1 verification, signs in users A/B again and validates unchanged UUIDs and live JWTs. Uses a separately labeled **synthetic** role-denied token; it is NOT evidence of GoTrue issuance.
- Fixes an execute deadline at the **start** of execute stage. Cleanup/verify time is already reserved by the shared parent; an additional 60-second execute reserve is required for refresh/seed/HTTP and not spent on waiting. Insufficient budget fails closed and parent cleanup/verify remains active.
- Adds optional per-case wall clock checks to the H2 sequence. Canonical bridge uses them before every request to reject expiring live tokens or an invalid/regressed wall clock. Older fake-driver tests keep their original fixed-time behavior.

## Critical safety boundary
The canonical real Docker command factory STILL returns `BLOCKED_NOT_RUN` with `h2_original_gotrue_expiry_not_wired` **before** creating commands, adapters, runtimes, Docker containers or any timers. The new conditional runner branch is deliberately unreachable until a separate, reviewed change to that guard. This PR does **not** prove actual GoTrue JWT expiry, SQL isolation, seven real HTTP responses, daemon cleanup or a final G4 success. The proof flags remain false.

Next gate (separate owner approval and new independent audit): first execute all offline Node tests, review exact runner HEAD and budget constraints; then decide whether the real safety guard can be changed. Docker, SQL, Actions, G4 and production are NOT approved by this PR.

## Offline audit commands (not executed by developer)
```sh
node --check tests/rings-now-p2-h2-runner-bridge.cjs
node --check tests/rings-now-p2-h2-runner-bridge.test.cjs
node --check tests/rings-now-p2-h2-sequence.cjs
node --check tests/rings-now-p2-real-docker-runner.cjs
node --test tests/rings-now-p2-h2-runner-bridge.test.cjs tests/rings-now-p2-h2-sequence.test.cjs tests/rings-now-p2-real-docker-runner.test.cjs tests/rings-now-p2-h2-original-jwt-stage.test.cjs tests/rings-now-p2-h2-refresh-handoff.test.cjs tests/rings-now-p2-h2-real-clock-expiry-bridge.test.cjs
```

Reviewer must check: execute stage deadline is not reset after service startup; 300+1 seconds plus 60 seconds reserve can be budgeted; failure path still cleans only run-owned resources; GoTrue password-grant never signs up/rekeys users; no hidden JWT in JSON/argv; per-case expiry checks; misleading synthetic success labels; and confirm `BLOCKED_NOT_RUN`, `explicitExecutionApproval:false`, `productionAccess:false`, `checkoutCommit:null`, Actions `if:false` and #109/#201 HOLD unchanged.

This is a Draft only. No merge or execution without separate Atsuo approval.
