# Rings Now P2 — real Docker backend runner ENTRY (NOT RUN, 2026-11-17)

**開発側分類：本道（実Dockerバックエンドの接続）。ただし G4最終合格の申告ではない。**

## Existing pieces genuinely connected

- Existing P2 static manifest preflight (`inspectP2Preflight`), before any runner command.
- #188 actual `runWithSharedTimeBudget`, with execution/cleanup/verification stages and reserved cleanup time.
- #200 actual `createBoundedDockerCommand` (the **real** `execFile('docker', ...)` backend) and `createDockerCliAdapter`.
- Shared #199 lifecycle semantics: validate empty run-scoped baseline, create private bridge network, three pinned-identifier containers, start, inventory discovered resource cleanup, verify empty run inventory. **Implemented as a separate real-backend stage function**, not by impersonating #199's synthetic driver. The #199 synthetic-only module and its evidence kind remain unchanged.
- #198 watchdog was built specifically for a fixed synthetic Node child fixture and **is NOT applicable to Docker execFile**. This real runner instead invokes #200's 15s bounded Docker CLI. The #198 actual process-group watchdog is **not integrated**; no claim otherwise. Any future cancellation/daemon cleanup verification must explicitly bridge that gap.

## Hard STOP, live current state

`tests/rings-now-p2-isolated-manifest.json` is imported directly by default. The current manifest is `BLOCKED_NOT_RUN`, billing `NOT_VERIFIED`, all digests/references null, audit `PENDING`, `explicitExecutionApproval=false`, checkoutCommit null. Before creating the command executor, `inspectP2Preflight` must pass AND each image ref must match the expected official repository@digest and productionAccess must be false. A forged approved `manifest` object cannot invoke the default real execFile backend (the exact imported manifest object is required). Separate dry unit tests may pass a fake green fixture **only when explicitly injecting a fake command factory**. No standalone command-line entrypoint or Actions import exists and the P2 workflow remains `if: ${{ false }}`.

**No Docker binary, daemon, network, image pull, container, DB, Auth, SQL, HTTP, Actions or billable runtime were touched.**

## What the code actually can do AFTER the separately audited gates/approval

The new exported `runRealP2DockerLifecycle` would use the existing #200 real execFile adapter to issue run-scoped `network create`, `container create` and `container start` Docker commands, then stop/remove containers, remove the network, and query run-scoped inventory with the existing adapter. Every stage has a shared budget, while individual CLI calls have an independent 15-second timeout. No logs of tokens/command output are emitted by the command adapter. This is **not a working P2 Auth/PostgREST stack**: the unchanged #200 adapter creates read-only containers with `SYNTHETIC_EMPTY` configuration, so PostgreSQL writable data paths and GoTrue/PostgREST database, signing and migration settings are absent. The code does not run SQL or HTTP/JWT tests. A successful CLI lifecycle result is `DOCKER_CLI_LIFECYCLE_REPORTED_CLEAN_NOT_G3_PROOF`, with all proof/authorization flags false, not a passed real G3.

## Major unresolved safety gaps before G4 and G5

1. **G1/G2** immutable image provenance/availability and actual zero **incremental** cost documented in account billing UI not established; manifest remains blocked.
2. **Real runnable services**: proper ephemeral-only writable paths and PG17 role/fixture initialization; GoTrue schema migration/email-OAuth isolation; PostgREST connection+JWT role claim GUC; localhost-only real transport. Those are integration work, not additional preflight documents.
3. **Watchdog/real cleanup**: #200's CLI timeout does NOT stop Docker daemon operations; use a separate engine inventory observer and reconciliation of late creates, canceled jobs, leaked images/volumes/processes, cleanup on coordinator throws, and deadlines. The `runWithSharedTimeBudget` callback time budget does NOT forcibly cancel hanging promises. Existing implementation's CLI self-report is NOT independent resource absence proof.
4. **G4** should audit the final fully executable, bootable real runner with these properties, not treat this PR audit as G4. **G5** is Atsuo's explicit separate approval of one run after G1–G4. H6 and real JWT/SQL/RLS still unproven.
5. Current code does not use `#198` real watchdog, does not run real service readiness, and does not attach the real Docker adapter to `#199` synthetic-only method. Do not assert an end-to-end #188/#198/#199/#200 real runtime is complete.

## Review/test scope

Only 3 new files: `tests/rings-now-p2-real-docker-runner.cjs`, its tests, and this report. No existing workflow, manifest, fixture, SQL, or production modifications. V8 shim with exact GitHub source covered 8 cases before the additional forged-manifest test; request Muse native `node --test tests/rings-now-p2-real-docker-runner.test.cjs` for all 9 and adversarial head-specific probes. Specifically test source-manifest identity, fake vs real executor choice, partial create, label spoof, leaks, coordinator throw, timeouts, and promises that never resolve. No mere PR review authorizes merge or actual Docker/Actions/P2 execution.

Production entry OFF, `featureStartedAtMs=null`, PR #109 HOLD. PR #201 separate hold.
