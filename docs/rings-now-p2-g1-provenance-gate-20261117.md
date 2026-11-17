# Rings Now P2 — G1 image digest provenance evidence format (NOT RUN)

2026-11-17. G1 remains **BLOCKED**. The existing checked-in manifest has `images.postgres/gotrue/postgrest.digest=null`, and no independent immutable `linux/amd64` platform digest evidence has been verified. The 47/47 PASS synthetic-process regression tests from Muse addendum 106 are not a substitute for G1.

## Purpose and exact scope

This PR adds an OFFLINE-only **structural format inspector**, not a registry client, image resolver, trust attestation, signature verifier, or ready-for-execution declaration.

New files only:
- `tests/rings-now-p2-g1-provenance-gate.cjs`
- `tests/rings-now-p2-g1-provenance-gate.test.cjs`
- `docs/rings-now-p2-g1-provenance-gate-20261117.md`

No modifications to workflow, live manifest, Docker/Actions, existing runner/watchdog/transport, fixtures, candidate SQL, application, production or billing. No internet access or child process execution is triggered by this module.

## Exact G1 evidence to collect independently

Each of PostgreSQL, GoTrue and PostgREST needs:
1. Official publisher source URL and concrete image tag as **reference only**, not a digest proof.
2. Exact registry reference anchored to an immutable digest and the digest field (`sha256:` plus 64 lowercase hex), with equality enforced.
3. An independently checked **linux/amd64 platform-specific manifest digest**, not a casual tag lookup, guessed digest or a multi-architecture index digest substituted for platform digest.
4. Registry verification URL, observed UTC date/time, exact checkout commit SHA, and an independent verifier's record. Re-fetch/validation from a trusted registry tool is a separate, mandatory activity before any approval.
5. Maintain the exact source and method because a syntactically valid URL or a self-declared `INDEPENDENTLY_AUDITED_EXTERNAL_PROBE` field is **not evidence that a probe actually ran**.

`inspectG1Evidence(manifest,evidence)` checks presence/shape/matching strings, platform, source references, date and source HEAD. The checked-in blocked manifest intentionally produces `status=BLOCKED`. Even if all strings look complete, the output is only `EVIDENCE_FORMAT_COMPLETE_UNVERIFIED`, with **`g1Verified:false` and `p2ExecutionAuthorized:false` unconditionally**. Thus no synthetic JSON can promote G1 to PASS. The next step is obtaining real official published digest proof, followed by independent Muse verification, NOT toggling manifest values.

## Other gates unchanged

G2: user's 2026-11-17 screenshots show currently billed Actions $0, budget $0 and usage blocked, **not guarantee of zero incremental charge for a proposed run**. G3: no validated disposable services, actual resource teardown or cleanup evidence. G4: no audit of a fully executable runner HEAD. G5: Atsuo has NOT separately approved a P2 run. H1–H6 still NOT PROVEN. No G1–G5 satisfaction is asserted by this PR.

`.github/workflows/rings-now-p2-isolated-manual.yml` still has job `if: ${{ false }}`, manifest `status=BLOCKED_NOT_RUN` / `explicitExecutionApproval=false`, production OFF / `featureStartedAtMs=null`, and PR #109 HOLD.

## Requested independent Muse audit

- Confirm new three-file diff only and no execution/wiring.
- Run checked-in Node tests: 8 cases; developer has not run Node tests yet and does **not** claim they pass.
- Add mutation probes: missing any service, wrong digest/platform, official link missing, mismatch with checkout SHA, invented timestamps, forged `verifier` declaration, and acceptable-looking synthetic evidence; no case must return G1 verified or execution authorized.
- Confirm the checker does not actually validate officialness/cryptographic integrity; these remain real-world evidence obligations, so pass of format-only tests MUST NOT be called a completed G1 gate.
