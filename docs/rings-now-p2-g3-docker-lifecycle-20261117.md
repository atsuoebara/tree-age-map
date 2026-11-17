# Rings Now P2 — G3 Docker lifecycle orchestration contract (NOT RUN)

Date: 2026-11-17. **G1–G5 still BLOCKED / P2 BLOCKED_NOT_RUN.**

This PR consolidates the proposed isolated Docker network and PostgreSQL/GoTrue/PostgREST container lifecycle into a *single inert orchestration contract* and a thorough mocked-driver test. It is **not** an executable P2 runner and **does not contain a Docker Engine/CLI adapter**. It must not be presented as proof of actual container launch, teardown, network isolation, Auth/JWT, or HTTP.

## Exact implementation

- New `tests/rings-now-p2-g3-docker-lifecycle.cjs`: requires a deliberately labelled `INJECTED_SYNTHETIC_DRIVER` with explicit `listOwned`, `createNetwork`, `createContainer`, `startContainer`, `stopContainer`, `removeContainer`, `removeNetwork` methods.
- Validates the already-audited separate **candidate manifest against the original G1 auditor ledger** through `inspectCandidate`. The active manifest must still be blocked and contain null image pins; values cannot be silently rewritten to pass. Image references must be immutable `docker.io/...@sha256:` child-manifest digests.
- For an accepted empty run-owned baseline, the synthetic driver receives a fixed three-service order, a private/internal non-attachable network request, no published ports, privileged mode disabled, read-only-rootfs **requested** (compatibility not proven), persistent volumes disabled, synthetic empty environment marker and explicit `linux/amd64`. These are **requests to a fake driver**, not proof an actual Docker daemon honors them.
- Attempts cleanup after partial network/container creation or failed startup. It rescans run-owned resources and tries to stop/remove all observed and known run-owned containers, then removes run-owned networks. Cleanup failures, untrusted listing, or nonempty post-cleanup inventory cannot yield success. If the initial run ID already owns anything, it **refuses to delete pre-existing resources**.
- The **only favorable status** is `SYNTHETIC_LIFECYCLE_CONSISTENT_NOT_REAL_PROOF`; evidence flags `actualContainersObserved`, `resourceTerminationProven`, `g3Verified`, `p2ExecutionAuthorized`, `actualP2Proven` are **always false**. The driver remains self-reported and can lie about resources: the code alone does not certify absence.

## Tests and limitations

- New `tests/rings-now-p2-g3-docker-lifecycle.test.cjs` with 12 cases: normal three-service lifecycle, partial network/container creation, startup failure, stop/remove/network cleanup failure, forged after-inventory leak, untrusted/missing inventory, fake real-driver label, live-manifest approval forgery, mismatched candidate image pins (including both reference and digest changed), and pre-existing run-ID collision.
- Developer replayed **GitHub source via a V8 test shim: 12/12 PASS**. This is **not an official native Node execution**. Muse should independently execute `node --test tests/rings-now-p2-g3-docker-lifecycle.test.cjs` on the fixed PR HEAD, run more adversarial mutations, and verify all failures remain blocked.
- Deliberate current gaps: no actual Docker client; no real runtime service configuration, health checks, runtime network inspection, resource IDs attested from an independent API, timeout/kill integration for uncooperative Docker APIs, cancellation cleanup guarantee, durable or tamper-resistant log evidence, loopback HTTP/JWT/RLS tests, or G2 cost verification. Injected `driver` promises may hang: this orchestrator **does not enforce an absolute deadline**. A future independently audited executable Docker adapter and lifecycle-to-watchdog coupling are required. Running it does not constitute G3 or H6 proof.
- Image **pulls** are external network operations, distinct from banned outbound application data access. No image is pulled here. Read-only-rootfs with PostgreSQL/GoTrue/PostgREST may require explicitly approved ephemeral tmpfs/mount configuration later; do not claim this specific declarative request is a working service deployment.

## Safety and scope

Exactly **three newly added files**, no existing code modification: lifecycle contract, 12-case test, this document. No Action/workflow dispatch, Docker, DB/SQL, secrets, fees or production operations; workflow hard-stop `if: ${{ false }}`, live manifest `BLOCKED_NOT_RUN`, digest/reference all null, `billingZeroAdditionalCost=NOT_VERIFIED`, `explicitExecutionApproval=false`. Production OFF, `featureStartedAtMs=null`, PR #109 HOLD.

## Independent Muse audit request

At exact PR HEAD, validate the 3-file-only diff and run 12 native Node tests. Probe a successful creation that throws before returning an ID; a false-empty inventory; an out-of-run collision; all partial cleanup errors; forged G1 manifest pins, invented approval, hung driver callback and unexpected Docker runtime exposure. Separate **consistent synthetic-driver lifecycle** from **real Docker resource evidence**. Merge approval, activating workflow, applying SQL and executing P2 are independent, currently unauthorized actions.
