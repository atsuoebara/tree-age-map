# Rings Now G4 staged CLI entrypoint — audit-only, NOT RUN

2026-11-18, based on Muse addendum 135. This is **the first implementation slice**, not a completed G4 activation PR.

- Adds `tests/rings-now-p2-cli.cjs` as the missing CLI bridge to the canonical dormant runner.
- Checks **exact** one-shot invocation shape, the repository-owned pinned manifest, all preflight statuses, and forbidden production environment variables **before any Docker CLI**. Does not accept an external manifest or approval flags.
- When all final authorizations are separately fulfilled, can invoke one runId-scoped runner, but **still exits nonzero even if CLI reports clean**: existing implementation cannot claim independent H1–H6 evidence.
- Offline tests cover actual BLOCKED state, fake fixture syntax, argv abuse, denied permissions, production variable presence and subprocess launch with no Docker.
- This PR **does not** modify the workflow hard stop, checkoutCommit null, billing NOT_VERIFIED, audit PENDING, executionApproval false, productionAccess false, or any production feature.
- Remaining for a future G4 review: complete Actions single-job wiring, exact checkout SHA and stage transitions without approval promotion, verified real GoTrue signed-JWT H1 and multi-scenario PostgREST HTTP H2/H3, integration evidence H4–H6. G2 freshness once near the run, G5 exact-HEAD owner confirmation once after G4.

## Audit request
`node --test tests/rings-now-p2-cli.test.cjs tests/rings-now-p2-real-docker-runner.test.cjs tests/rings-now-p2-stack-static-gate.test.cjs`

Confirm real checked-in manifest is blocked and no Docker or paid resource is touched by tests. Synthetic approved fixtures remain offline-only. Verify `main` workflow is still `if: false`. This PR is **not** execution approval or an invitation to run P2.
