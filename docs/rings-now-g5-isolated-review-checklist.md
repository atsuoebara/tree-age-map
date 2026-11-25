# G5 isolated execution readiness — review candidate
2026-11-25. Source baseline 83d0cbeb. Not an execution approval.

## Review together
- v02 SQL: VOLATILE, invoker, strict expiry, own-row RLS, bounded single-statement snapshot.
- HTTP: original GoTrue JWT expiry must yield exact PT401, not upstream rejection; GET must return 405.
- SQL boundary: 0/1000/1001, missing fields, deleted/foreign rows, synthetic expiry and comparator controls.
- Concurrent writer: 100 rows, alternating committed whole-table states, reader must see both states and never a mixed state.
- Lifecycle: cleanup and empty inventory required. Preserve 600s total / 120s cleanup reserve / 30s verification reserve.
- Additional concurrent probe runs before H1 issuance. Startup and H1 must leave sufficient original-JWT wait budget; do not increase job ceiling or consume cleanup reserve.
- Offline test suite contains eight tests. Execution evidence must be independently reproduced; prior reported results are not accepted without a retained execution log.
- Verify script syntax, fixture grants, exact pinned hashes, fake-driver lifecycle coverage, expiry-window timing and production metadata parity before enabling execution.
- Default real backend hard stop remains mandatory; no workflow dispatch or production changes authorized.
- G4 immutable; G5 final decision belongs to independent auditor after admissible evidence. No extra cost.

## Remaining activation work
A separately reviewed disabled workflow and entrypoint must bind the approved checkout and manifest, then an explicit one-run approval must authorize activation. Do not bypass the hard stop or fabricate approval fields.

## Verified offline evidence
Run `node --test tests/rings-now-g5-http-contract.test.cjs tests/rings-now-g5-h2-sequence.test.cjs` against the reviewed checkout. No retained execution log is available for earlier reported results. Review-only workflow and CLI remain disabled.

## Handoff to independent auditor
Review source baseline `40ce9d650cb37fa2c623166f36242d237f2fa7e0` (20 new files, no existing files changed). The CLI is review-only, not an authorized real execution entrypoint. Request a consolidated defect list and a determination of the minimum changes required for one isolated run. Do not interpret this handoff as G5 completion or dispatch authorization.
