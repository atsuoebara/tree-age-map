# Rings Now G1 — fixed image references staged while P2 remains BLOCKED (2026-11-18)

**Draft only; independent audit required; not execution approval.**

## Scope and rationale
Transfer the three **reported and separately audited** linux/amd64 child digest references from `tests/rings-now-p2-g1-candidate-manifest.json` into the checked-in `tests/rings-now-p2-isolated-manifest.json`. Preserve the distinct candidate and evidence ledger unchanged. No registry recheck is implied: historical evidence has incomplete raw headers and G1 is **not** promoted to VERIFIED by this PR.

| Service | Pinned child digest |
| --- | --- |
| PostgreSQL | `sha256:6f7593c161689b6b02c78668b314af7da8811b592c5519108c57a49d0b6ad788` |
| GoTrue | `sha256:839f529492d116b4e8b7777c953a27c381d34c15a744b1bcefde5eefaa1f9f9f` |
| PostgREST | `sha256:c847127074bd26e1b8d3f7c0e6e01e5346f4b85dd34f5d699fd230af960827c0` |

Existing candidate admission checks accepted only three nulls in the actual manifest; G3's synthetic contract also required nulls. Adapt them to the **full, identical pinned set**, keeping blocked/null state as an accepted input to the offline candidate checker for regression only; reject partial pins, wrong child digest, index/child substitution, alternate repository, additional service, or any promoted approval flags. Offline test expectations update. No production or runtime logic is activated.

## Non-negotiable invariants
- `status=BLOCKED_NOT_RUN`, `checkoutCommit=null`, `billingZeroAdditionalCost=NOT_VERIFIED`, `independentAudit=PENDING`, `explicitExecutionApproval=false`, `productionAccess=false`, `authJwtCompatibility=NOT_PROVEN`.
- `.github/workflows/rings-now-p2-isolated-manual.yml` unchanged: `if: ${{ false }}`.
- Production feature OFF, start null; #109 and #201 remain HOLD; #222 remains Draft/HOLD.
- No real Docker, SQL, Actions, PostgREST, network, G5 execution, image pull, or production modification.
- G1/G2/G3/G4/G5/H6 **not claimed PASS**. Independent Muse audit on exact PR HEAD, then Atsuo's separate merge decision.

## Requested independent tests
`node --test tests/rings-now-p2-g1-candidate-admission.test.cjs tests/rings-now-p2-g3-docker-lifecycle.test.cjs tests/rings-now-p2-stack-static-gate.test.cjs tests/rings-now-p2-real-docker-runner.test.cjs`

Audit pin completeness and exact ledger equality, forgery and mixed-state negatives, fail-closed status, unmodified workflow, and no network/process side effects. Any affected additional regression suites can be added by Muse.
