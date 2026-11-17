# Rings Now P2 G2 — zero-additional-cost documentary gate (NOT RUN)

2026-11-17. **Status: G2 NOT VERIFIED, P2 BLOCKED_NOT_RUN.** No GitHub Actions job, Docker pull, process, database, HTTP request, artifact upload, billing change, or production change is authorized or performed by this PR.

## Historical context and outstanding evidence

The prior P2 execution-evidence gate document records Atsuo's **2026-11-17 GitHub Billing UI screenshot observations**: current Actions charge **$0**, Actions budget **$0**, and "Usage blocked." These describe the screenshot/account state at observation time only. **They DO NOT prove a future proposed P2 job will generate $0 incremental cost**, nor standard-runner eligibility, billing exclusions, retained storage/artifact charges, or behavior when budgets are reached.

Before any separately approved P2 run, G2 requires fresh, account/repository-specific verification of likely costs: GitHub-hosted standard runner eligibility by repo visibility and plan; billing budgets and block behavior; Actions minutes and storage; retention and cache/artifact effects (disabled by default); registry pulls and third-party services; run count and 10-minute job limit; cancellation behavior; and post-run billing. An unknown answer means **STOP**, not "probably free." Do not buy services or change paid settings.

## New offline contract

- `tests/rings-now-p2-g2-cost-envelope.cjs` checks a proposed execution envelope's *declarations*: fixed owner repo, checkout SHA format, **one** standard Ubuntu job, max 10 minutes, concurrency 1, retries 0, no larger runner, artifacts, cache write, external paid service, and billing evidence provenance/time.
- All inputs, including a completely filled fictional fixture, return **g2Verified=false** and **p2ExecutionAuthorized=false**. The strongest result is `DOCUMENTARY_ENVELOPE_COMPLETE_COST_NOT_PROVEN`. This means only the format is complete, **not a G2 PASS**. Invalid conditions return `BLOCKED`.
- `tests/rings-now-p2-g2-cost-envelope.test.cjs` supplies eight synthetic test cases for absent evidence, runner violations, new cost exposures and forged approval.
- The test fixture explicitly says `SYNTHETIC_TEST_ONLY` and uses an invented timestamp and SHA. **It is not actual billing evidence.** No live account data was newly acquired.

## G3 integration requirements

The existing process watchdog and shared deadline (#185–#188) were audited only with **synthetic** Node children. A future disposable-services runner still needs independently audited:
1. a single, isolated job with no production credentials, persistent volumes, or real user data;
2. enforced 10-minute shared budget, per-stage kill, emergency teardown, and **actual** post-cleanup container/process/network absence verification, including cancellation;
3. loopback-bound client sockets and separately controlled image registry pulls; pinned image/action/checkout references and non-secret evidence;
4. fail-closed enforcement of every G1–G5 gate, including G2 cost approval, exact executable HEAD review (G4), and Atsuo's **separate explicit P2 execution approval** (G5).

This PR does **not** implement a real runner, prove G3/H6 or connect the cost checker to Actions.

## Exact scope and safety

**Three new files only**: offline G2 inspector, 8-case tests, and this document. Live manifest's three image digest/reference fields remain null, `status=BLOCKED_NOT_RUN`, `billingZeroAdditionalCost=NOT_VERIFIED`, `explicitExecutionApproval=false`, `productionAccess=false`. Workflow retains job `if: ${{ false }}`. Production OFF, `featureStartedAtMs=null`, PR #109 HOLD. G1–G5 remain incomplete.

## Independent Muse audit request

Inspect the three-file diff at exact HEAD and independently run `node --test tests/rings-now-p2-g2-cost-envelope.test.cjs`. Mutate the evidence, runner limits, storage/artifact assumptions and approval flags. Even perfect-looking synthetic evidence must never yield G2 PASS. Confirm no actual billing API, P2, Actions, Docker, SQL or production change. PR merge (if separately authorized) does not approve P2 execution.
