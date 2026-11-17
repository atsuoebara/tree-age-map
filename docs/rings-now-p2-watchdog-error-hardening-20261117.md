# Rings Now P2 — watchdog abnormal child lifecycle hardening (NOT P2 RUN)

2026-11-17. Addresses Muse addendum 103 observation: PR #185 finalized only on Node ChildProcess `close`, and an abnormal `error` without `close` could strand the Promise. The auditor considered the missing-close case unreachable for the current `process.execPath`/Node spawn implementation, but asked for hardening before a real runner.

## Exact changes
- **Modified** existing audited `tests/rings-now-p2-process-watchdog.cjs`. Adds an error-triggered finite fallback after the validated `graceMs`. It attempts a child-process-group SIGKILL if a PID exists, then settles FAIL even if `close` never occurs. Also lets the existing deadline→TERM→KILL path settle FAIL when `close` is absent. `childClosed` now reflects the actual `close` event instead of unconditionally claiming true.
- **New** `tests/rings-now-p2-process-watchdog-error.test.cjs`. Uses injected synthetic EventEmitter children to test error/no-close, error+close, timeout/no-close, late close after fallback, and spawn settings. No P2, containers or external PIDs are started.
- **New** this document. The prior PR #185 7 tests remain unchanged; do **not** claim all tests pass until `node --test` actually runs.

## Limits and gates

- An optional `spawnImpl` parameter exists exclusively for isolated testing. It does not add an external executable or PID argument in the production default: normal behavior always calls Node `spawn(process.execPath, ...)`, `shell:false`, `detached:true`, and env defaults to empty. A future caller must prohibit overriding `spawnImpl` in the audited runner.
- Fallback indicates **only a bounded Promise result**, not proof of process kill, group-empty state, container cleanup or safe resource reclamation. `groupTerminationVerified` remains permanently false. If a child lacks `close`, `childClosed=false`. SIGKILL attempts can fail; no PASS may be inferred from them.
- Error can be reported before a deadline and still settle after its grace period; deadlines remain bounded in the normal process execution path. Callback and OS scheduling delays can still occur, and synchronous event-loop blocking cannot be preempted by timers.
- In the deadline/no-close branch, the Promise settles after escalation even though the child may remain alive. The actual runner must separately verify process group extinction and cleanup, and cannot treat a returned FAIL as proof that resources are gone.
- A fully isolated P2 runner, including cleanup/verification stage timeout within a shared 10-minute job budget, is NOT implemented. Existing workflow `if: ${{ false }}`, manifest `BLOCKED_NOT_RUN`, G1–G5, production OFF, featureStartedAtMs null and PR #109 HOLD all remain unchanged.

## Muse audit requested
Review the existing-file modification as well as both new files (3-file diff). Re-run original PR #185 7 tests plus 5 abnormal-event tests under real Node, and attempt extra mutations/races, including missing close after timeout. Confirm no real P2 services or GitHub Actions were invoked. Merge and P2 run both require separately explicit approval.
