# Rings Now P2 — real service environment handoff (2026-11-17)

**開発側判定：本道（既存実runnerへ3サービスの一時起動設定を接続）。ただし G4最終監査の対象としてはまだ不十分。**

## What has been connected, not just proposed

- Modified existing #200 Docker CLI adapter's `createContainer` to accept **only** two allowed environment modes. Previous `SYNTHETIC_EMPTY` works unchanged. New `EPHEMERAL_SERVICE_ENV_FILE` accepts only `/tmp/rn-p2-<random>/{postgres,gotrue,postgrest}.env`, matching the current service. Passes `--env-file` (path **only**, no literal password/JWT in command argv), `--tmpfs` for ephemeral writable locations, and keeps `--read-only`, `--cap-drop ALL`, `--security-opt no-new-privileges`, internal network with no published ports or persistent mounts.
- Modified existing #203/#204 real staged runner to inject runtime files **after** manifest preflight, propagate each file into the existing `createContainer` path, and always call `dispose()` via outer `finally`, including the emergency reconciliation path. The canonical real `execFile` backend must use the imported active manifest and canonical runtime factory; test-only fake manifest can only use an injected nondefault CLI command factory.
- Added the minimal implementation dependency `tests/rings-now-p2-ephemeral-service-runtime.cjs`: creates a random `/tmp/rn-p2-*` directory (0700), three exclusive 0600 env files, run-unique cryptographic PostgreSQL password and shared GoTrue/PostgREST JWT secret; deletes the directory on completion. No real files are created on module import. Test paths are mocked; no running production secrets, URLs or user data are copied.

## Exact isolation limitations

This is **not** a working authenticated P2 stack and **not G4 completion**:
- PostgreSQL 17's tmpfs and `PGDATA` were proposed from the official Docker image guidance, **but no real container startup/healthcheck has occurred**. Docker image declared anonymous VOLUME and root filesystem compatibility, UID, entrypoint, migration behavior and file access remain unproven.
- GoTrue is configured with DB URL and isolated JWT secret, but signup and email/phone are disabled. No Auth schema migration, signing flow, users, JWT generation or expiry has been tested. These settings may prevent test users from being created until a separately audited synthetic-only setup path exists.
- PostgREST is configured to connect as `postgres` for the moment, with an `anon` role that **does not yet exist unless the candidate SQL is applied**. **Using a PostgreSQL superuser as PostgREST's `db-uri` connection user is not acceptable for the real RLS proof**: superuser may bypass RLS and cannot be treated as authenticator-role evidence. A dedicated non-superuser authenticator role and exact candidate SQL initialization must be connected before any real HTTP/JWT/RLS evaluation. Do not record G4 PASS or execute P2 until fixed and reaudited.
- Even with `--env-file`, Docker daemon container inspect metadata may retain environment variable values. Environment files are deleted by best-effort `dispose()` but daemon secrets/late-create/orphan risk is NOT eliminated; a daemon-independent cleanup proof is still absent. A failed force-remove can leave env values. Existing #200 15-second CLI timeout is not daemon termination or cancellation proof.
- No real Docker daemon, Actions, SQL, HTTP or P2 was run. Extra cost zero **not verified**; G1 official digest evidence and G2 billing proof outstanding. G3 real daemon cleanup, G4 executable stack audit, G5 Atsuo approval, H6/A1–A6 remain NOT PROVEN.

## Tests / audit

Previous V8 shim re-ran current real runner and CLI adapter tests with actual GitHub source: **27/27 PASS**, **not native Node**. A dedicated ephemeral runtime filesystem test is added and **has not been run by the developer**; ask Muse to run:
`node --test tests/rings-now-p2-real-docker-runner.test.cjs tests/rings-now-p2-g3-docker-cli-adapter.test.cjs tests/rings-now-p2-ephemeral-service-runtime.test.cjs`.
Also probe wrong service filename, missing directory permissions, env-file process visibility, Postgres RLS bypass via superuser, cleanup after exception, tmpfs path validity and simulated partial-create. No Docker/Actions/P2 run is authorized by this PR.

## Immutable safety

No workflow, active manifest, candidate SQL or fixture, synthetic-only #199, or production changes. Workflow still `if: ${{ false }}`; active manifest still `BLOCKED_NOT_RUN`, all digest/reference null, billing `NOT_VERIFIED`, approval false, production OFF, `featureStartedAtMs=null`, PR #109 HOLD, PR #201 HOLD.

**Next integration blocker:** dedicated non-superuser database role + exact fixture load and GoTrue Auth bootstrap / healthcheck, then daemon-residual cleanup proof and full G4; no more standalone shape checks. **Do not merge or execute without explicit permission.**
