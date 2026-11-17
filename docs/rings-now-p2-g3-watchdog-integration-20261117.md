# Rings Now P2 G3 — fixed synthetic Node watchdog integration (NOT P2 RUN)

2026-11-17. **Scope: synthetic Node child fixture only.** This PR adds a narrowly constrained adapter linking the **existing** Linux process-group watchdog into the G3 integrated synthetic budget/cleanup/inventory pipeline. It does not start Docker, PostgreSQL, GoTrue, PostgREST, real HTTP/SQL, Actions or production resources.

## Change and behavior

- `tests/rings-now-p2-g3-watchdog-integration.cjs` calls the existing `runBoundedChild` through `runG3SyntheticDryRun`. Allowed modes are **only** `success`, `failure`, `hang`, `ignore-term`; the script is always the repository's `rings-now-p2-process-watchdog-fixture.cjs`; arguments are exactly the selected mode and `env={}`. The caller cannot select a Docker binary, arbitrary script or production environment through this adapter.
- Uses the existing shared stage budget and cleanup/verify execution path. The watchdog supplies bounded execution of each synthetic child stage, with Linux SIGTERM→SIGKILL escalation on timeout. A child may count as stage success only when status PASS, not timed out, `childClosed=true`, and `spawnError=null`. On execute failure, subsequent cleanup and verification are attempted **if remaining shared budget allows**.
- Reuses the previously audited G3 *synthetic inventory* consistency check; an injected inventory is not real resource evidence. Callback success does not override a failed inventory check or failed cleanup.
- Even the favorable result remains `SYNTHETIC_PIPELINE_CONSISTENT_NOT_REAL_PROOF`. Always `resourceTerminationProven=false`, `actualResourcesVerified=false`, `g3Verified=false`, `actualP2Proven=false`, `p2ExecutionAuthorized=false`. Watchdog signal delivery and child close are **not** proof that descendant processes or detached Docker resources are absent.

## Tests, evidence and remaining limits

- Adds `tests/rings-now-p2-g3-watchdog-integration.test.cjs`: **10 injectable synthetic tests** (fixture path, empty environment, timeout, unknown close, spawn error, cleanup failure, inventory leak, forged modes/source and exhausted budget), plus **2 Linux-only native child-process integration tests** checking normal fixture completion and `ignore-term` timeout with cleanup attempt.
- Development ran **only the first 10** by a V8 shim against fetched GitHub source: **10/10 PASS**. The two Linux-only tests require actual Node and have **NOT been run by the developer**. Do not interpret the V8 shim as native Node evidence. Muse must run the full 12 cases from the exact HEAD and confirm no leaked synthetic child processes.
- This adapter still does not implement service container lifecycle, real Docker teardown, loopback topology proof, real inventory collection, process group absence verification or cancellation handling. The watchdog handles its dedicated Node child process group only; shared-budget stage callbacks are bounded **because this specific adapter uses the watchdog**, not because the generic G3 synthetic coordinator gained unconditional termination.
- G2 costs are still not verified for future Actions/P2 runs. Native Node tests are not Actions runs and should be run only in an authorized disposable local test environment, without production secrets or paid runners.

## Exact scope and invariants

Exactly **three new files**: adapter, tests, this document. All existing source, original watchdog, fixture, workflow, active manifest, SQL and website remain unchanged. P2 workflow retains `if: ${{ false }}`; manifest `BLOCKED_NOT_RUN` with all digest/reference null and `explicitExecutionApproval=false`; G1–G5/H6 remain open. Production OFF, `featureStartedAtMs=null`, PR #109 HOLD.

## Independent audit request

At exact PR HEAD confirm three new files only, run:
`node --test tests/rings-now-p2-g3-watchdog-integration.test.cjs`
Check the Linux native child success and `ignore-term` cases, stage cleanup attempt, childClosed/spawnError/timeout enforcement, no false terminal/resource absence proof, and no arbitrary scripts/commands/environments. Probe skipped cleanup when shared budget is exhausted, arbitrary mode/real inventory denial, and inventory residue. No PR merge, P2 launch, Actions dispatch, SQL application or production changes are authorized by this document.
