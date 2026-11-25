# G5 isolated execution readiness — review candidate
2026-11-25. Source baseline 83d0cbeb. Not an execution approval.

## Review together
- v02 SQL: VOLATILE, invoker, strict expiry, own-row RLS, bounded single-statement snapshot.
- HTTP: original GoTrue JWT expiry must yield exact PT401, not upstream rejection; GET must return 405.
- SQL boundary: 0/1000/1001, missing fields, deleted/foreign rows, synthetic expiry and comparator controls.
- Concurrent writer: 100 rows, alternating committed whole-table states, reader must see both states and never a mixed state.
- Lifecycle: cleanup and empty inventory required. Preserve 600s total / 120s cleanup reserve / 30s verification reserve.
- Additional concurrent probe runs before H1 issuance. Startup and H1 must leave sufficient original-JWT wait budget; do not increase job ceiling or consume cleanup reserve.
- Offline tests actually executed locally under Node v22.16.0 at source baseline ad0b0d249a67e4a733ec5e8fa989280068541a03: 8 passed, 0 failed, 0 skipped. Nine source/test blobs verified via git hash-object against GitHub. Independent reproduction still required; synthetic tests are not real Docker/SQL/JWT proof.
- Verify script syntax, fixture grants, exact pinned hashes, fake-driver lifecycle coverage, expiry-window timing and production metadata parity before enabling execution.
- Default real backend hard stop remains mandatory; no workflow dispatch or production changes authorized.
- G4 immutable; G5 final decision belongs to independent auditor after admissible evidence. No extra cost.

## Remaining activation work
A separately reviewed disabled workflow and entrypoint must bind the approved checkout and manifest, then an explicit one-run approval must authorize activation. Do not bypass the hard stop or fabricate approval fields.

## Verified offline evidence
`node --test *.test.cjs` in the reconstructed nine-file local tests directory: 8/8 PASS. No Docker, network or database calls. Sequence blobs: `2a0417757fb58d02f2800d01b9edd29299d42ead`, `b8948a4eef711ac9c4f4a355a32bb27924934932`, `a3444510473305eb4770f9b08ac7a5c68272664b`. HTTP six-file blob IDs are recorded in the production plan. Review-only workflow and CLI remain disabled and cannot execute Docker.
