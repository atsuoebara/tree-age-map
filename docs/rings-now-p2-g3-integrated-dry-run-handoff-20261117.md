# Rings Now P2 G3 — offline stage-budget + inventory integration (NOT RUN)

2026-11-17. **This PR does not start or stop services, Docker containers, child processes, databases, HTTP connections or Actions.** It adds a synthetic integration seam to connect two previously audited modules, not a runnable P2 stack.

## New integrated behavior

- `tests/rings-now-p2-g3-integrated-dry-run.cjs` imports the existing `runWithSharedTimeBudget` and `inspectG3ResourceEvidence`.
- The caller injects a **synthetic** stage callback for `execute`, `cleanup` and `verify`. The shared budget assigns stage budgets and reserves teardown time. The inventory gate examines a separately supplied, self-reported `before/created/after` list. A `CLEAN` callback cannot conceal a residual network/container/process/volume or a missing verification.
- All stages are best-effort according to remaining budget. When execute throws or returns FAIL, the coordinator still attempts cleanup and verification if budget remains, and a later synthetic clean claim does **not** rewrite the execution FAIL.
- The only favorable top-level result is `SYNTHETIC_PIPELINE_CONSISTENT_NOT_REAL_PROOF`. The implementation **always returns** `g3Verified=false`, `actualResourcesVerified=false`, `resourceTerminationProven=false`, `actualP2Proven=false` and `p2ExecutionAuthorized=false`.
- The new tests cover 10 cases: all-clean synthetic path, execute failure/throw, cleanup failure/throw, verification failure, resource leak, forged real-evidence label, missing inventory and exhausted reserve. The development side checked fetched GitHub source through a V8 shim and observed 10/10, **not a native Node execution**.

## What is still missing from the real G3 runner

The coordinator **does not use or replace `runBoundedChild`** and does not establish process group termination. `runWithSharedTimeBudget` is budget accounting, not a deadline-enforcing timer. If an injected stage callback hangs forever, this coordinator alone **cannot terminate it and may never settle**. The synthetic inventory is self-reported, not obtained from Docker/process APIs, so it cannot prove that a container or network actually disappeared. A reported stage `CLEAN` has no physical meaning until future independently audited adapters verify cleanup.

A future **separately audited and specifically authorized** executable runner must integrate the process watchdog with a real isolated service lifecycle, enforce an absolute job deadline including cleanup, connect to actual container/network/process inventory APIs, prohibit production credentials and external data transfer, prove absence after success/failure/timeout/cancellation, and independently verify G1 immutable image references, G2 additional-cost protection, G4 exact runner HEAD and G5 Atsuo's explicit execution approval. These cannot be inferred from this synthetic PR.

## Scope and audit

**Exactly three new files**: `tests/rings-now-p2-g3-integrated-dry-run.cjs`, `tests/rings-now-p2-g3-integrated-dry-run.test.cjs` and this document. Original watchdog, cleanup contract, shared-budget and G3 inventory modules are unchanged. Workflow remains `if: ${{ false }}`. Live manifest stays `BLOCKED_NOT_RUN` with all image digests/references null, billing `NOT_VERIFIED`, `explicitExecutionApproval=false`; production OFF, `featureStartedAtMs=null`, PR #109 HOLD.

Muse audit request: confirm exact three-file diff, run `node --test tests/rings-now-p2-g3-integrated-dry-run.test.cjs` against PR HEAD; mutate callbacks to throw/fail, introduce leftover resources, forge `REAL_DOCKER` sources, exhaust remaining budget. In particular, distinguish **stage accounting and synthetic inventory consistency** from an actual runtime watchdog or container teardown proof. This PR is NOT authorization for merge, Actions dispatch, P2, SQL or production changes.
