# Rings Now P2 HTTP/JWT evidence-contract preparation (2026-11-17)

**Developer classification: prerequisite / 横道 (not yet wired to the real runner).** This PR does NOT close G4, unlike #213 which wires SQL probes directly into the real runner. Do not confuse syntactically valid or locally signed synthetic JWTs with a verified PostgREST HTTP response, an actual GoTrue-issued JWT, or an isolated daemon proof.

## Real changes to existing components
- The existing `tests/rings-now-p2-loopback-transport.cjs` no longer discards all HTTP 200 response bytes: requires JSON content-type; parses bounded 1MiB JSON with the existing 5-second absolute deadline, direct loopback connection, fixed RPC path, no DNS, redirects or production endpoints. Non-200 bodies are not returned. Malformed/oversized success responses throw instead of being accepted.
- Its pure `assertSnapshotRpcResult` checks exact synthetic owner, deduplicated IDs, required fields, expected row count up to 1000, and 1001-row `too_many_rows` blocked response with no leaked rows. This evaluates **only returned JSON**, not whether the caller actually used HTTPS/JWT/PostgREST.
- Existing `tests/rings-now-p2-ephemeral-service-runtime.cjs` can mint a strictly synthetic HS256 60-second JWT for one of **two hard-coded fake UUIDs**, using the run-unique random key already shared by isolated GoTrue and PostgREST. No production identity, key or token used, no network/filesystem I/O caused on module import. An exported signer is an offline/test aid, not a GoTrue login or verified JWT issuance.
- Existing tests add loopback mock response parsing, owner leakage, blocked response, malformed/oversized body, cryptographic signature and run-specific token tests.

## NOT connected; blocking risk
**No real Docker HTTP transport is connected to this code.** Existing Docker adapter creates an `--internal` network with **no published ports**; the host-side loopback socket **cannot reach** PostgREST by assuming localhost or adding a port. Do not disable internal networking, publish a port, use production URLs, or silently claim HTTP proof. Before connecting the runner, design and independently audit an isolated/test-only transport (e.g., an approved network-namespaced diagnostic probe with explicit image provenance), bounded process lifecycle, no host exposure and daemon independent teardown. Then run signed JWT acceptance, invalid signature/expiry, anon forbidden RPC, foreign-owner isolation and 1000/1001 cases against actual PostgREST.

**Separate blocker:** #213's SQL-only probe awaits Muse audit, merge and any separate execution approval. This PR was based on main and does not include #213.

## Developer validation and Muse request
GitHub file-source syntax compilation: all 4 changed JS files passed. Pure response checker: 1 valid result accepted and 3 negative cases rejected in V8 shim. **Native Node tests are not run by developer; no loopback listening and no Docker/SQL/HTTP execution occurred.**

Request independent native Node:
`node --test tests/rings-now-p2-loopback-transport.test.cjs tests/rings-now-p2-ephemeral-service-runtime.test.cjs`.
Also inspect wrong signed audience/expiry, malformed content-type, 1MiB ceiling, non-200 error body not leaked, no redirect, localhost-only, JWT hard-coded subjects, zero production credentials, no real runner linkage. Audit HEAD exactly and state **横道** explicitly unless a real runner connection is discovered.

**Safety:** active manifest `BLOCKED_NOT_RUN`, images null, costs `NOT_VERIFIED`, explicit approval false; workflow `if: ${{ false }}`; prod OFF and startedAt null, PR #109 HOLD and #201 HOLD. No permission to merge, execute SQL, Docker, Actions or P2.
