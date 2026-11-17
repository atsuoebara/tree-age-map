# Rings Now P2 — synthetic child-process watchdog (NOT RUN on P2)

2026-11-17. PR #184 established an *advisory* AbortSignal/Promise deadline. This PR adds a separate, actual **Linux child-process SIGTERM/SIGKILL watchdog**, tested **only with synthetic Node processes**. It is not connected to P2 services or GitHub Actions. It does not start containers, databases, PostgREST, GoTrue, SQL, or any production service.

## Concrete offline implementation

- `tests/rings-now-p2-process-watchdog.cjs`: no effect on import. Explicit invocation of `runBoundedChild` launches `process.execPath` with a **required absolute .cjs script path**, string arguments, `shell:false`, `detached:true` (isolated process group on Linux), ignored stdio, and an explicit environment object defaulting to empty. This avoids inheriting production credentials, token/proxy variables or running through a shell. Caller still has to audit and whitelist the script path and inputs; this module by itself is not an authorization boundary.
- Each stage must have an integer deadline from 1 to 540,000 ms; grace period 1–5,000 ms. At deadline the supervisor sends SIGTERM to the *child's process group*, then attempts SIGKILL after grace, **including if the direct child already exited**. A deadline always produces FAIL, regardless of late exit status. Nonzero exit, missing script and spawn error are FAIL.
- `tests/rings-now-p2-process-watchdog-fixture.cjs` is a synthetic child with modes success/failure/hang/ignore-term. `tests/rings-now-p2-process-watchdog.test.cjs` tests only these local subprocesses, including independent expiry of a synthetic cleanup stage.
- Per-stage deadline of up to 9 minutes is an upper cap, **not** a safe schedule for several serial stages. A future runner must allocate a single shared absolute job budget, enforce execution + cleanup + verification combined within the job's 10 minutes, reserve sufficient teardown time and inspect actual process and resource absence. An outer runner/job-level timeout still applies.
- `childClosed:true` means only the direct child close event occurred. `groupTerminationVerified:false` is **always** returned: signals sent and direct-child close are not proof that grandchildren, containers, sockets, database, or external resources have been destroyed. OS-level child-group verification, orphan cleanup, process IDs, and forced GitHub Actions cancellation need separate independent audit.
- Output is intentionally minimal: status, deadline flag, signal attempts, exit signal/code, spawn error, and a **false** verification marker. It does not log secrets, but lacks evidentiary recording of timing/runner ID/hashes until integrated in an independently audited runner.
- The synthetic tests do **not** prove real `runWithVerifiedCleanup` wiring or end-to-end G3/A4-G5. A future coordinator must treat a cleanup-stage FAIL/NOT_PROVEN as overall failure and may not assert success solely on `runBoundedChild` PASS.

## Scope and unchanged guardrails

Four **new** files: this document, watchdog module, synthetic fixture, Node tests. No changes to PR #180/#184 modules, SQL/fixture, workflow, manifest, actual candidate SQL, or production application. Existing manual workflow still has job-level `if: ${{ false }}`, manifest remains `BLOCKED_NOT_RUN` / `explicitExecutionApproval=false`. Production OFF, `featureStartedAtMs=null`, PR #109 HOLD remain unchanged.

**No P2 execution permission** is conveyed. Still blocked by G1–G5, including digest, additional-cost proof, exact-runner independent audit, and separately explicit user approval. H1–H6 remain NOT PROVEN.

## Independent Muse audit requested

- Re-run actual Node source via `node --test`, including Linux process hang and SIGTERM-ignoring cases. Review race between close, deadline and escalation; ensure no PASS after deadline.
- Audit the exact four-file diff and the execution-free scope; check no automatic workflow trigger and no production references.
- Check Linux-only behavior, signal group semantics, lack of lingering test processes, missing-script failure; independently probe whether child-group termination is **not falsely proven** and cleanup hang cannot yield overall success.
- Confirm that this is a subprocess building block, **not** a complete or approved P2 runner, not a verified cleanup of arbitrary descendants.
