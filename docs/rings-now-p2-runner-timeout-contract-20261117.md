# Rings Now P2 — runner execution deadline contract (NOT RUN)

2026-11-17. This introduces a *pure, unconnected* JavaScript supervisor for a future isolated runner. No GitHub Actions dispatch, container startup, SQL, service, real Auth/HTTP, billing operation or production change.

### Why
Muse addendum 98 noted PR #180's `runWithVerifiedCleanup` cannot stop a hung `execute()`. PR #182 defined 10-minute *job* ceiling and 3s/5s HTTP deadlines, but these do not yet ensure every async stage has a timeout.

### Contract
- `runWithExecutionDeadline` accepts injected `execute({signal})`, `cleanup()`, `verifyCleanup()`, and a positive integer `deadlineMs <= 600000`. This is a **proposal cap** and is not the job's actual clock. A real runner must reserve substantial cleanup time before the 10-minute outer job limit, and use explicit shell/container/process kill plus a runner-level timeout, all separately audited.
- Uses an `AbortController` and a Promise deadline. After expiry it reports execution **FAIL**, calls cleanup and verification via the already-audited PR #180 contract, and never promotes a timeout to PASS.
- Critical limitation: `AbortController` is **advisory**. `Promise.race` does not terminate a process or a noncooperative asynchronous operation; it may still be running and may race cleanup. `operationTerminationProven=false` after timeout. Injected cleanup/verification can lie; no actual resource removal can be inferred.
- The deadline bounds only the execute stage. A hung `cleanup()` or `verifyCleanup()` still requires the outer runner/process timeout. Even GitHub job cancellation may prevent `finally` from running. The hard stop `if: ${{ false }}` must remain.
- Socket 3s / HTTP absolute 5s remain independent guarantees of the separate loopback transport only. This contract is not wired to it or to P2 A4 tests.

### Scope and evidence
Three **new** files: module, Node tests, documentation. Existing PR #180 cleanup module/test, workflow, manifest, legacy SQL, fixtures, frontend, P2 candidate SQL remain unchanged. Offline tests cover success, timeout, never-settling execute, callbacks failing and NOT_PROVEN classification; cannot claim process kill, database cleanup, G3 completion, H1–H6 proof, or safe P2 execution.

No P2 run or merge is authorized by this document. Maintain production OFF, start timestamp null, PR #109 HOLD, `BLOCKED_NOT_RUN` and explicit execution approval false.
