# Rings Now P2 G3 — resource lifecycle inventory gate (SYNTHETIC ONLY)

2026-11-17. The existing G3 watchdog/shared-budget/cleanup contracts (PR #180, #185–#188) have synthetic coverage, but **no isolated Docker services, resources or networks have been started or destroyed in this PR**.

## New capability

The pure, offline module `tests/rings-now-p2-g3-resource-absence-gate.cjs` compares a **caller-injected synthetic** lifecycle record: resources already associated with a run before setup; resources created during its lifetime; resources still assigned to that run after cleanup. It rejects:
- retained run-owned containers, networks, processes and volumes, even when cleanup claims CLEAN;
- missing cleanup attempt or independent verification, duplicate or foreign run identifiers, incorrect service mapping (postgres/gotrue/postgrest), invalid IDs, preexisting run-owned resources and wrong checkout format;
- attempts to promote G1, billing, production access or execution approval, or to relabel fabricated inventories as real evidence.

Even with a consistent empty post-cleanup inventory the returned status is only `SYNTHETIC_INVENTORY_CONSISTENT_NOT_REAL_PROOF`; **actualResourcesVerified=false, g3Verified=false, p2ExecutionAuthorized=false unconditionally**. The input is self-reported synthetic data and the module has no Docker API, process, network, filesystem, registry, database or Actions access. A fabricated empty list cannot prove actual absence. It is a **future attestation-validation component**, not a resource inspector or an executable runner.

## Remaining genuine G3 integration work

A separately audited and individually approved future runner must gather the *real* initial baseline, created-resource identities and final inventories from isolated local runtime/container APIs; ensure that service identity and run ownership cannot be spoofed; couple process-group kill and the shared deadline with real container/network teardown; verify actual descendant/service absence on success, failure, timeout and cancellation; never inherit production credentials; cap log/artifact cost and retention; confirm no residual resources and no unexpected egress. In particular, a background process/group or detached Docker daemon **cannot be declared terminated** merely because the synthetic stage returned PASS or a callback returned an empty list. If real verification is missing, G3 remains NOT PROVEN.

## Test and safety boundary

Two new files plus this document only. Added tests: 8 synthetic cases covering zero residuals, each resource-type leak, failed/missing cleanup, missing/duplicated services, forged IDs/ownership/approval and missing checkout. Development evaluated fetched GitHub source with a V8 shim and observed **8/8 PASS**, **not a native Node run**. Muse should run `node --test tests/rings-now-p2-g3-resource-absence-gate.test.cjs` against exact HEAD and adversarially mutate `after`/owner/service/approval/status.

**No existing files modified.** Workflow remains hard-stopped `if: ${{ false }}`; main P2 manifest `BLOCKED_NOT_RUN`, images digest/reference all null, billing `NOT_VERIFIED`, execution approval false, production OFF/`featureStartedAtMs=null`, PR #109 HOLD. **G1–G5 and H6 remain open.** Merging does not permit image pull, Actions dispatch, Docker execution, SQL application, real FIT or production activation.
