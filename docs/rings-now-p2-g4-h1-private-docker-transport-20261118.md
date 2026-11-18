# Rings Now G4 — run-owned GoTrue internal HTTP transport (dormant)

PR #229 adds a **non-invoked** Docker adapter method `probeInternalGoTrue` and immutable private Bash probe. This is staging code, not H1 or G4 evidence.

- Exact fixed H1 case allowlist, exact GoTrue request path/headers, `example.invalid` emails, 64-digit hex passwords; request length checked; any forged external Host or arbitrary path blocked before Docker operations.
- Require run-owned PostgreSQL container label and private `/tmp/rn-p2-...` directory mode 0700.
- Write request 0600, copy using paths only, run pinned Bash via `/dev/tcp/gotrue/9999` on internal Docker network, parse strict bounded HTTP reply in memory, remove host request file. No secret in argv or environment. Container-side tmpfs persists until container teardown (not zeroized).
- No published port, external endpoint, artifact upload, modified billing or new image; pinned Bash Git blob SHA must match.
- Runner is intentionally **not wired** to this method yet; no changes to GoTrue signup disabled settings, RLS, CLI, manifest, or Actions.
- Known unresolved: GoTrue success response 200 is parsed; 201 signup is status only, not user data. GoTrue real signup requires isolated-only activation and confirmation settings. Two-user collector integration, H2 PostgREST, evidence provenance and teardown are subsequent audited PRs. No execution claims.
- Independent offline suite: `node --test tests/rings-now-p2-g3-docker-cli-adapter.test.cjs tests/rings-now-p2-h1-gotrue-http.test.cjs`.

Original P2 execution remains `if: false`, manifest `BLOCKED_NOT_RUN`, approval false.
