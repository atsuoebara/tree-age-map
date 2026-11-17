# Rings Now P2 — Synthetic stage integration (NOT P2 RUN)

2026-11-17. This PR is the first **integration** of the previously audited JavaScript contracts, but **only against synthetic Node child processes**. It does not start or touch GoTrue, PostgREST, PostgreSQL, Docker, GitHub Actions, production, or candidate SQL.

## Architecture and exact scope

- New `tests/rings-now-p2-synthetic-stage-coordinator.cjs` calls the existing `runWithSharedTimeBudget` (#187) and `runBoundedChild` (#185/#186). The bounded child is restricted to the **existing, audited synthetic fixture** `tests/rings-now-p2-process-watchdog-fixture.cjs` with mode allowlist `success/failure/hang/ignore-term`. It cannot take a caller-selected script, PID, shell command or inherited environment. An optional `childRunner` is provided solely as a test seam and is **not suitable for a P2 execution boundary**.
- The bounded execute stage returns a synthetic PASS/FAIL. The bounded cleanup stage maps only a synthetic child PASS to synthetic CLEAN; the bounded verify stage maps only synthetic PASS to `verified:true`. Neither actually creates nor removes a resource. `resourceTerminationProven:false` and `actualP2Proven:false` are unconditional.
- All stages draw on **one monotonic absolute time budget** through the audited #187 module, whose maximum is 600,000 ms. The outer GitHub workflow remains hard-stopped and unmodified.
- Normalized `records` always include **execute, cleanup, verify**, including unattempted stages with no budget. This resolves the *presentation* ambiguity noted in Muse addendum 105 without modifying #187 `stageRecords`.
- Synthetic timeout/child FAIL yields overall FAIL even when later cleanup/verify synthetic children succeed. `childClosed:false` means **close was not observed at settlement**, not that the child is alive.

## Development-side test evidence

Local Node v22.16.0: **8/8 PASS**, running the new integration source and test with locally reconstructed copies of previously audited #185/#186 watchdog, #187 budget module, and the synthetic fixture. **These reconstructed dependencies were not checked byte-for-byte against GitHub**, so this is not an exact GitHub repository test. Muse must rerun all actual repository sources, inspect differences, and independently confirm results.

## Limits before a real isolated P2 runner

1. Synthetic children cannot demonstrate actual cleanup of descendant groups, containers, sockets, databases or credentials. Group termination remains unproven.
2. Synthetic cleanup/verify PASS maps from an empty local child exiting zero, **not real resource inspection**. It is never a G3/H6 PASS.
3. Actual GoTrue/PostgREST JWT/RLS, HTTP, candidate SQL, official image digest verification, zero-additional-cost proof, and G1–G5 individual execution approval are NOT PROVEN/BLOCKED.
4. The workflow, manifest, existing audited modules, fixtures, SQL, public website and production remain unchanged.
5. Import has no side effects. The only child is an explicitly invoked preexisting synthetic fixture.

## Muse independent audit request

Review **three new files only**: coordinator module, Node test, this document. Re-run exact-repository `node --test` on all eight cases and inspect original versions of #185/#186/#187. Verify restriction to synthetic fixture, no P2 traffic/SQL/Docker/Actions, actual timeout and cleanup-stage fail-closed semantics. Probe time-budget exhaustion and missing-stage normalization. Verify this does not claim real resource cleanup or P2 execution readiness.

**P2 status remains BLOCKED_NOT_RUN**; workflow `if: ${{ false }}`, `explicitExecutionApproval=false`, production OFF, `featureStartedAtMs=null`, PR #109 HOLD unchanged. Merge and actual P2 execution are each separately unapproved.
