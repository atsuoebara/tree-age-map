# Rings Now G4 H2 — private run-owned PostgREST HTTP transport (NOT RUN)

PR #232 extends the existing audited Docker CLI adapter with a dormant method: `probeInternalH2`. This PR does **not** connect H2 to the runner or provision database roles/fixtures.

The adapter accepts only seven fixed H2 case IDs, a 0700 temporary directory and the exact POST request for `postgrest:3000/rpc/rings_now_snapshot_candidate_v01` with body `{}`. Anonymous has NO Authorization header. All other cases require a three-segment bearer token in a private 0600 file; token *provenance* and actual signature validity are deliberately NOT claimed by this adapter.

The adapter checks immutable SHA of the previously audited Bash fixture `tests/fixtures/rings-now-p2-internal-http-probe.bash`, verifies the run-owned PostgreSQL container label before copying any token, and copies the request only to the fixed container tmpfs path `/tmp/rn-p2/http-probe.req`. After the bounded command it parses the restricted HTTP/1.1 response. On failure, the host request file is removed in finally. Container-side temporary bytes remain until run-owned container teardown; no zeroization guarantee. Sequential use with the earlier synthetic 0-row smoke is required; running probes concurrently would contend for the same fixed path and is not supported.

The *next* audited runner PR must:
- Obtain real GoTrue-issued A/B access tokens; independently seed A/B run rows and prove both exist, foreign A cannot see B.
- Obtain a **signature-intact genuinely expired** token without editing claims; wait for expiration only inside approved bounded execution, consider cleanup reserve and expiry configuration.
- Provision and independently verify a dedicated no-RPC-EXECUTE role in the disposable DB (not production). Do not masquerade as an authenticated role.
- Call this adapter sequentially after H1 and only after prerequisite provenance, with fail-closed behavior and non-secret evidence; do not mark H2/G4 verified on CLI reports alone.

No workflow, manifest, runner, runtime, production, billing or existing SQL changes. `BLOCKED_NOT_RUN`, `if:false`, approval=false, productionAccess=false hold.

Independent review: `node --check` the adapter and new test; `node --test tests/rings-now-p2-h2-private-transport.test.cjs tests/rings-now-p2-g3-docker-cli-adapter.test.cjs tests/rings-now-p2-h2-postgrest-http.test.cjs`. Verify command order, anonymous without auth, failed exec and ownership rejection, temporary file cleanup, and absence of JWT in argv.
