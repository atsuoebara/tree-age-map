# Rings Now P2 — Shared monotonic time budget, OFFLINE ONLY (NOT RUN)

2026-11-17. This is a pure, dependency-injected **budget allocator and fail-closed verdict contract**. No child process, Docker, GoTrue, PostgREST, PostgreSQL, SQL, HTTP, billing operation, GitHub Actions dispatch, or real resource lifecycle is invoked.

## Motivation

- #184: a Promise/AbortSignal deadline only covers execute; cleanup may hang.
- #185/#186: a Linux child-process watchdog covers synthetic subprocess termination, but a caller could still give each stage its own large timeout and exceed the 10-minute workflow deadline.
- #182 A4-G5: actual future runner must reserve time for cleanup and verification inside the job-level 10-minute limit.

## New API and staged budget

`runWithSharedTimeBudget({runStage,nowMs,totalMs=600000,reserveMs=60000,verifyReserveMs=10000})`.

- All durations are **integer milliseconds**. `totalMs <= 600000` (existing workflow job cap, 10 minutes), `reserveMs < totalMs`; `verifyReserveMs < reserveMs`. Default execution reserves **at least 60 seconds** for cleanup/verification, but this is a proposal and not independently measured sufficient for any real service.
- Time is read from injected **monotonic** `nowMs()`; real implementation must supply a monotonic clock (e.g. `performance.now`), not civil/JST time. A timestamp going backwards throws, not PASS.
- Stages always follow **execute → cleanup → verify**, with budgets recalculated from the **same absolute deadline** before every stage; stage-specific permitted budget is at most **540000ms**. Execute budget is remaining time minus reserved cleanup/verify time; cleanup budget is remaining time minus the verification reserve. Verify receives remaining time. If no positive time remains, stage is marked **NOT_PROVEN / not attempted**, not successful.
- `runStage(name,{timeoutMs})` is an injected callback; successful status requires `{status:'PASS'}` from execute, `{status:'CLEAN'}` from cleanup, `{verified:true}` from verify, *all* within their allocated budgets. Any stage exceeding its passed-in `timeoutMs`, any thrown error, or finishing after global deadline makes overall status **FAIL**. Unrecognized callback results/omitted stages are **NOT_PROVEN**.
- Once an execution failure is observed, cleanup and verification are **still attempted if their positive budget remains**. They are not automatically called after global deadline exhaustion. This is a deliberate distinction between "cannot safely start a new stage" and "cleanup was proven". An external supervisor needs emergency teardown in that case.
- `resourceTerminationProven:false` is fixed. Even PASS refers **only to the injected callback's self-reported contract and observed elapsed time**, not the OS process group, child PID, disposable DB, network, container destruction, identity proof, data isolation, or billing.

## Critical limits

1. **This module does NOT interrupt a hung or noncooperative `runStage`**. It awaits the callback. To enforce the passed `timeoutMs`, a separately audited real coordinator must run each stage under the #185/#186 bounded child supervisor or other equivalent independent process kill, including cleanup and verification. The `runStage` implementation MUST not disregard its budget. Without external enforcement, a stage can hang beyond the 10-minute job limit.
2. The #185/#186 `runBoundedChild` takes a test `spawnImpl` override. The eventual P2 runner **must use the default Node spawn**, not permit arbitrary injection.
3. The job-level `timeout-minutes: 10` is an independent last-resort stop; GitHub Actions cancellation may skip `finally`. Incomplete cleanup/verification must remain FAIL or NOT_PROVEN, never PASS.
4. The 60s cleanup reserve is **not an endorsed runtime/cleanup guarantee**. Real cleanup duration, descendants, sockets/volumes and billing still require G3/G2 plus Muse audit. No workflow wiring or manifest change is made here.
5. Only synthetic callback **V8-shim tests 10/10** have been run by development, not Node's `node --test`. Independent Node tests and adversarial probes are needed before merge.

## Accurate files changed

Three **new** files only:
- `tests/rings-now-p2-shared-time-budget.cjs`
- `tests/rings-now-p2-shared-time-budget.test.cjs`
- `docs/rings-now-p2-shared-time-budget-20261117.md`

All previously audited code (including #180/#184/#185/#186), workflow, manifest, candidate SQL, fixture and production remain unchanged. Existing workflow `if: ${{ false }}`, manifest `BLOCKED_NOT_RUN` / explicitExecutionApproval=false, prod OFF, featureStartedAtMs null, PR #109 HOLD all remain.

## Muse audit request

At fixed PR HEAD, verify the three-file diff; run 10 tests from **actual Node**; add probes for exceeding reserved duration, zero/no remaining time, unknown statuses, error/clock anomalies and a never-settling callback (documenting that no watchdog exists). Verify stage budgets can never add up to an unbounded series of calls, and that a callback's PASS does not certify cleanup/resources. Reject any interpretation of this PR as P2 execution permission.
