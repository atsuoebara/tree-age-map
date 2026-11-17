# Rings Now P2 — snapshot candidate SQL connected to existing real runner (2026-11-17)

**Classification: 本道 (existing real P2 runtime integration), NOT G4 final audit.**

The existing #209 staged real runner now calls `applySnapshotCandidate` **only after PostgreSQL readiness, fixture SQL and the non-superuser authenticator role bootstrap have reported successful CLI completion**. It does so before GoTrue migration and PostgREST creation. A snapshot failure blocks both later services, enters existing cleanup, and cannot become G3/G4 success.

The existing #200/#209 Docker CLI adapter's new method reads the **unchanged original candidate** `docs/rings-now-single-statement-snapshot-CANDIDATE.sql`, calculates its Git blob SHA-1, requires exactly `c8bb8bfdeb1e2e88bea422aa76c27d094127bdea`, checks the disposable PostgreSQL container's exact owned label, then issues bounded `docker container cp` and owner-checked `docker container exec ... psql -v ON_ERROR_STOP=1 -f ...` to **that disposable PostgreSQL only**. No SQL is synthesized, copied from production or sent to a live Supabase instance. The source SQL's header forbids execution without separate explicit approval and staging evidence; this PR does not provide that approval and does not run the commands.

The snapshot code is deliberately not proof of RLS, ACL or JWT. GoTrue still has no verified real account or JWT issuance, no HTTP path has been exercised, PostgREST signing/claim GUC and 1000/1001 boundaries are unproved, and the container image startup/migration versions have never been boot-tested. The `CLI_SNAPSHOT_CANDIDATE_APPLIED_NOT_RLS_PROOF` status is solely a future Docker CLI response description. No positive G1–G5/H6 evidence.

**Developer tests:** GitHub-source V8 shim runner suite **18/18 PASS** and syntax validation; native Node, filesystem-backed original SQL hash check and three new adapter tests **not executed by developer**. Request independent Muse native:
`node --test tests/rings-now-p2-real-docker-runner.test.cjs tests/rings-now-p2-g3-docker-cli-adapter.test.cjs tests/rings-now-p2-ephemeral-service-runtime.test.cjs`.
Audit exact HEAD, source SQL byte tampering before Docker CLI, role-owner spoof, SQL failure after partial copy, cleanup on failures, order of stages, and no success proof elevation. Since the snapshot header requires **separate owner execution approval**, scrutinize that the existing manifest `BLOCKED_NOT_RUN` stays untouched.

**Remaining blockers:** controlled simulated signed JWT + PostgREST real HTTP/RLS coverage, load 1000/1001 fixture rows; actual GoTrue migrations and app readyness; independently observed Docker daemon resource absence and late-create cancellation; image digest provenance G1, incremental ¥0 G2, real G3, final G4, explicit G5. No Docker, Actions, P2 or SQL execution occurred.

**Safety invariant:** workflow `if: ${{ false }}`, active manifest `BLOCKED_NOT_RUN`, all image refs/digests null, billing `NOT_VERIFIED`, explicit execution approval false; production OFF / start null; PR #109 HOLD, #201 HOLD. **No merge or runtime execution authorized by this PR.**
