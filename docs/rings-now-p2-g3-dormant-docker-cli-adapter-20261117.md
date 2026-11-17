# Runner’s Rings — P2 G3 dormant Docker CLI adapter (2026-11-17)

**Status: NOT RUN / G1–G5 & H6 unproven / PR REVIEW ONLY.**

## What this PR actually adds
- A Docker CLI adapter with `listOwned`, `createNetwork`, `createContainer`, `startContainer`, `stopContainer`, `removeContainer`, `removeNetwork`. Every operation builds a fixed allowlisted argv and checks run ownership labels; there is no shell, privilege elevation, port publication, persistent mount or inherited secrets. A dedicated optional `createBoundedDockerCommand` executes `docker` via Node `execFile`, with 15-second CLI timeout, SIGKILL timeout signal, 64 KiB output bound, empty environment, and no logging of stdout/stderr.
- **Dormant by design:** Neither module launches anything on import. The adapter has no default executor and can only be constructed with explicitly supplied `command`. The bounded executor is not instantiated or referenced by any workflow, production code or P2 runner. Combining the two is *possible in future code after approval* but is not done by this PR.
- A 10-test adapter suite checks allowed service names, network scoping, label identity, cleanup command shapes, privilege/secret/volume rejection, malformed runId and failures. A separate 4-test suite checks CLI executor timeout options, shell/environment control, errors and output bounds.

## Critical distinctions
- This is a **CLI adapter**, not a working service configuration. Containers created without PG/GoTrue/PostgREST's required environment, certificates, persistent directory paths or health checks will not provide P2's real Auth/JWT/HTTP experience. Read-only root FS in particular may not boot PostgreSQL without explicitly reviewed ephemeral writable mounts. We have *not* claimed the stack can start.
- `execFile` timeout and SIGKILL may stop only the CLI process. **Docker daemon actions may continue** and must be reconciled with separate, independently observed cleanup. This is **not** yet connected to `runBoundedChild` process-group watchdog or to the #199 G3 orchestration; the latter permits only `INJECTED_SYNTHETIC_DRIVER` and must **never** be fooled by this adapter's distinct `DOCKER_CLI_ADAPTER_NOT_ADMITTED` label.
- `listOwned` checks the CLI's self-reported data using label/name inspection but is not a tamper-resistant or complete engine inventory proof. Trust boundary, race between inspect and destructive command, create-after-timeout, unbounded promise from injected executor, or daemon crash leave possible orphaned resources. Real G3 independent resource absence evidence remains missing.
- No image pull, DNS, Docker daemon access, CLI invocation, CI/Actions dispatch, SQL, secrets or chargeable run occurred in the developer session. V8 shim ran 14/14 unit cases against fetched GitHub sources; **native Node test suite not run by developer**.

## Executable integration gate — NOT YET SATISFIED
A later integrated PR must: (1) bind this adapter and #199 orchestration **without weakening the synthetic-only proof boundary**; (2) preflight actual Docker service compatibility, explicit ephemeral data paths / tmpfs, synthetic auth configuration and localhost network exposure; (3) bound/harden every CLI action and reconstruct cleanup after timeout; (4) observe daemon-managed resources independently and record cleanup evidence, even on cancellation; (5) supply real HTTP/JWT/RLS and candidate SQL contract tests; (6) source official digest provenance and check G2 incremental cost 0; (7) pass Muse independent HEAD audit and receive separate Atsuo P2 execution approval. Until then no live adapter is admitted.
There is no secret runtime parameter, environment gate, or CLI allowlist sufficient by itself to authorize P2 execution.

## Strict scope
Exactly **5 new files**: `tests/rings-now-p2-g3-docker-cli-adapter.cjs`, its test; `tests/rings-now-p2-g3-bounded-docker-command.cjs`, its test; this document. Existing watchdog, #199 lifecycle, manifests, workflows, fixture, SQL, UI and production unchanged. Active manifest still `BLOCKED_NOT_RUN`, digests/references null, billing `NOT_VERIFIED`, `explicitExecutionApproval=false`, production OFF, `featureStartedAtMs=null`, PR #109 HOLD, workflow `if: ${{ false }}`.

## Muse audit instructions
1. Verify 5 new files only and source HEAD. Run native Node:
   `node --test tests/rings-now-p2-g3-docker-cli-adapter.test.cjs tests/rings-now-p2-g3-bounded-docker-command.test.cjs`.
2. Probe identity/label mismatches, fake zero-resource list, improper Docker argv injection, privilege or environment exposure, invalid names, daemon timeout and post-create inventory races.
3. Confirm no workflow/module imports this adapter, no real Docker calls were executed, no positive G1/G2/G3/P2 approval asserted, and **15-second execFile timeout is not descendant/daemon termination proof**.
4. No merge, Actions, Docker/P2 run, SQL or production modification is approved by this PR.
