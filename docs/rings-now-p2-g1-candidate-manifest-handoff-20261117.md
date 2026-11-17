# Rings Now P2 — audit-only G1 candidate manifest handoff (NOT RUN)

2026-11-17. **This is not the live P2 manifest, a G1 PASS, or execution approval.** The only purpose is to map Muse addenda 108–110 registry observations onto immutable digest-pinned image-reference syntax in a separate, reviewable candidate.

## New files and scope

1. `tests/rings-now-p2-g1-candidate-manifest.json` — **distinct from** the live `tests/rings-now-p2-isolated-manifest.json`; 3 exact `docker.io/<repository>@sha256:<linux/amd64 child manifest>` references matching the already merged `docs/rings-now-p2-g1-auditor-registry-evidence-20261117.json` ledger. Deliberately `status=BLOCKED_NOT_RUN`, `checkoutCommit=null`, `billingZeroAdditionalCost=NOT_VERIFIED`, `independentAudit=PENDING`, `explicitExecutionApproval=false`, `productionAccess=false`, `g1Verified=false`.
2. `tests/rings-now-p2-g1-candidate-admission.cjs` — static cross-check of **candidate, ledger and live manifest**. Rejects repository substitutions, child/index digest swaps, any missing/duplicated service, tampered ledger approval declarations, changed live manifest image fields, or candidate approval promotion. Even when structural checks match, the only positive description is `CANDIDATE_MATCHES_REPORTED_LEDGER_ONLY`; `g1Verified` and `p2ExecutionAuthorized` are **always false**. This is not cryptographic registry verification.
3. `tests/rings-now-p2-g1-candidate-admission.test.cjs` — eight offline tests, intended to be executed from the repo source by Muse.
4. This document.

**No existing file is modified.** The candidate is not imported by any production path, workflow, actual P2 runner, service manager, or manifest parser that can activate execution. The live manifest's three digests and references remain null and its status BLOCKED. Original workflow `if: ${{ false }}` and PR #109 HOLD are untouched.

## Evidence and outstanding obligations

- Source: Muse addenda 108 and 109, consolidated in PR #192 (addendum 110). These cover SHA-256 comparisons against Docker registry raw child manifests at approximately 2026-11-17 14:47 JST. Raw HTTP responses, headers/Accept, and exact registry client version are **not attached** to the ledger. This PR adds no registry request or live recheck and cannot assert a fresh verification.
- PostgreSQL `17.12-trixie` index changed from page `dbb9623d...` to auditor-time `0d938e97...` while amd64 child `6f7593c1...` was unchanged. **Only the amd64 child digest** appears in the candidate image reference.
- Do not set the candidate's checkoutCommit to the current branch SHA and declare G1 done: executable runner HEAD, the exact run-time registry pin, GitHub Actions G2 billing gate, G3 real isolation and cleanup, G4 whole-runner review, and G5 Atsuo's **separate explicit P2 execution approval** all remain incomplete.
- A syntactically valid reference is not proof of operational compatibility, image runtime availability, Auth/JWT, SQL authorization, or any end-to-end real P2 behavior.

## Development validation and independent audit

Development separately used a **locally reconstructed version** of the candidate gate and a reduced ledger/active-manifest fixture, with `node --test` reporting 8/8. **The final GitHub source is not thereby certified as 8/8**: Muse must test exact commit and full original files. Do not treat the reconstructed run as independent or repository-exact.

Muse: inspect the **four new files only**; execute `node --test tests/rings-now-p2-g1-candidate-admission.test.cjs` using exact HEAD; mutation-probe fake ledger, duplicate/missing service, index-vs-child swap, namespace alias and the live null manifest. Confirm the candidate is never consumed by Actions and that `CANDIDATE_MATCHES_REPORTED_LEDGER_ONLY` never promotes G1 or authorizes P2.

The P2 workflow, live manifest, tested watchdog modules, fixture, SQL and public website have **no changes**. Production OFF, `featureStartedAtMs=null`, G1–G5 unfulfilled, PR #109 HOLD. PR merge, live manifest update and actual P2 execution each require **separate approval**.
