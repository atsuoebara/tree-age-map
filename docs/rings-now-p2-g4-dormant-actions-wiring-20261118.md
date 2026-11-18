# Rings Now P2 G4 — dormant Actions wiring (2026-11-18)

**Audit-only Draft. Nothing is enabled, executed, dispatched or authorized by this change.**

This PR replaces the empty placeholder step in the manual P2 workflow with a **dormant** checkout and CLI entrypoint that GitHub can later audit as part of the final G4 execution HEAD. Job `if: ${{ false }}` is retained without exception.

## Job topology
- Manual `workflow_dispatch` only; exactly one `ubuntu-latest` standard-runner job, 10 minute ceiling, concurrency group fixed, `cancel-in-progress: false`, `contents: read` only.
- Sole external action `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` pinned immutable; `ref: ${{ github.sha }}`, no stored checkout credentials, shallow checkout.
- First active script (if later enabled after another independent audit) checks checkout HEAD exactly matches `GITHUB_SHA`, then validates the canonical manifest with `inspectP2Preflight` before the CLI.
- Second script calls one canonical `node tests/rings-now-p2-cli.cjs --isolated-once`; it uses `set -euo pipefail`, preserves its terminal code **1 (not proven)** or **2 (blocked)**. No `continue-on-error`, artificial green status, output upload, cache, paid external action, release, artifact upload, persistent service or production secrets.
- Existing `inspectDisabledWorkflow` contract and tests updated to allow **only** pinned checkout and reject dynamic tags, ref drift, permissions, timeouts, bypass steps, and fake success.
- CLI's non-secret stdout remains in the standard Actions run logs if the job is someday separately authorized. Logs are not proof of Docker daemon teardown, nor signed GoTrue H1/H2 evidence.
- Manifest **unchanged**: `BLOCKED_NOT_RUN`, `checkoutCommit=null`, `billingZeroAdditionalCost=NOT_VERIFIED`, `independentAudit=PENDING`, `explicitExecutionApproval=false`, `productionAccess=false`.

## Unresolved G4 boundaries
G4 final HEAD review must settle the audited source `checkoutCommit` vs. the final approval-only commit SHA **without a self-referential Git commit hash**. `GITHUB_SHA` is the actual checked-out commit and cannot simply be written into a manifest inside that same commit. The final auditor must inspect the parent/source commit and the approval-only delta; never claim `checkoutCommit` exact-source binding just from the syntax check here.

H1 and H2 remain incomplete: the runner currently tries locally generated JWT and only a zero-row HTTP probe. Implement actual GoTrue-issued tokens and case-by-case PostgREST HTTP evidence before G4 final certification and execution. No live G4/H1/H2 PASS is claimed. G2 freshness check is due only once immediately before any separately approved run.

## Muse audit
Inspect this exact PR HEAD; independently run `node --test tests/rings-now-p2-stack-static-gate.test.cjs tests/rings-now-p2-cli.test.cjs`. Mutate hard stop, dispatch trigger, checkout action digest/ref, permissions, extra action/job, billing/approval flags, timeout, log-failure behavior and unsafe bypass. Confirm actual Actions has **not** been dispatched and no Docker/SQL/production changes occurred.
