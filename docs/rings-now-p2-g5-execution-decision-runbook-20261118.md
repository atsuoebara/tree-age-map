# Rings Now — G5 execution decision runbook (draft; NOT RUN)
Date: 2026-11-18

**Document-only proposal. No P2, Docker, SQL, GitHub Actions, network, or production execution is authorized.** This is a decision aid, not a command to run. The exact run-time HEAD, Docker images, workflow, actual billing state, and final scope must be independently audited before a separate G5 approval.

## 0. Current authority and status

- PR #222 (SQL/RLS probe integration) remains **Draft / HOLD**. Its Muse audit passed but its merge is **not approved**.
- PR #223 (G1 immutable digest staging) remains **Draft / independently unaudited / NOT MERGED**.
- This document has no operational effect: existing P2 workflow `.github/workflows/rings-now-p2-isolated-manual.yml` remains manually triggered and **hard disabled** by `if: ${{ false }}`.
- The checked-in **main** runtime manifest remains `BLOCKED_NOT_RUN` with three digest/reference fields null; draft PR #223 contains proposed pins but is not merged.
- Production Rings Now is **OFF**, `featureStartedAtMs=null`; PR #109 and #201 remain HOLD. Never use production Supabase, production credentials, real FIT, or real runner personal data for P2.
- G1–G5, H1–H6 are **not** promoted to PASS by this document, by a PR merge, by a syntax check, or by a synthetic Node test.
- User's phrase "ネクスト", "おけ", approval of a different PR, or approval of this documentation is **not** G5 execution approval.

## 1. Three distinct owner decisions (no implicit approval chain)

1. **#222 merge decision**: only the exact independently audited HEAD, after checking main drift, CI and six-file scope. A HOLD means no merge.
2. **#223 manifest-PR merge decision**: only after independent audit of its exact HEAD, pin equality, fail-closed gates, disabled workflow, and regression. This decision does not authorize Docker or P2.
3. **G5 execution decision**: separate, explicit owner consent to an exact executable HEAD and one tightly bounded disposable run, *only* after G1–G4 prerequisites. Approval must identify runner, actions/actor, platform, one-run maximum, cost cap of **additional $0**, allowed network/registry behavior, immediate stop conditions, cleanup and post-run evidence collection.

If any decision is HOLD, STOP that dependent operation. Development and document-only audit may continue without considering HOLD a project-wide cancellation.

## 2. Preconditions before asking for G5

| Gate | Minimum evidence and acceptance | Fail / unknown behavior |
| --- | --- | --- |
| G1 image provenance | Registry-verified, pinned linux/amd64 child digest, repository names, versions/registry request metadata; cross-check against audited candidate ledger. Staged pins alone do not establish final G1 PASS. | STOP |
| G2 no additional cost | Use Muse addendum 65's **two outstanding recheck conditions** as the authoritative detailed checklist (not reproduced from memory). Verify against current owner-account GitHub Billing & repository's final executable workflow; public repo standard-hosted Ubuntu eligibility, storage/cache/artifact policies, outbound registries, service charges, budget/usage blocking and post-run evidence. **No inferred free guarantee.** | STOP; no payment or settings modification |
| G3 isolation/teardown | Exact standard runner (one job), fixed checkout SHA and image digests, no production credentials/ports/persistent volumes, bounded overall and per-command timeouts, owner-scoped inventory, fail-closed cleanup and verification. Independent audit of eventual executable runner is needed; synthetic drivers do not prove real teardown. | STOP |
| G4 exact HEAD audit | Muse independently audits final workflow, manifest, SQL fixture, GoTrue/PostgREST config, JWT transport, Docker adapter, runner, logging, evidence collector and dependency refs at the **same immutable executable SHA**. #222/223 audits separately are not substitute. | STOP |
| G5 separate owner approval | Exact, affirmative authorization for the above bounded single run, its cost/scope and stop/cleanup rules. | NOT APPROVED, STOP |

No action to satisfy G1–G4 automatically changes `explicitExecutionApproval`. Any edits to approval markers or hard stop need separate reviewed PR/scope, and a new precise consent.

## 3. Execution sequence — informational only, NOT executable instructions

1. Freeze exact main/checkout SHA, source tree and provenances, immutable image child digests, and node/runner platform; compare planned changes to independently reviewed HEAD. If drifted, halt and re-audit.
2. Reconfirm account-specific additional $0 condition and ensure final workflow cannot introduce artifact/cache/external-paid storage, nonstandard runners, unbounded jobs, retries or surprise paid traffic. Get final independent G1–G4 review.
3. Request separate G5 owner approval identifying **one** disposable run and its evidence obligations. **Do not dispatch while HOLD/NOT VERIFIED.**
4. Only after all gates are passed and operation separately authorized: create one run-owned isolated network, start disposable PostgreSQL, apply checksum-verified synthetic fixtures and candidate SQL to it only, validate isolated role/row boundaries, start GoTrue and PostgREST, then perform the pre-approved signed-token HTTP cases inside the isolated environment. No external production endpoints, user data or production secrets.
5. Record non-secret results by H1–H6 with exact provenance. After success, failure or timeout, attempt owner-scoped cleanup, independent daemon-level absence checks and billing check; do not infer cleanup proof from CLI messages.
6. H1–H6 may independently be PASS/FAIL/NOT PROVEN; overall PASS requires all required proofs, not just boot success. No permission for P3, production ON or production SQL follows.

## 4. Post-run evidence matrix

| Evidence | Required real-world observation | Never infer from |
| --- | --- | --- |
| H1 Auth | Disposable GoTrue signup/signin for two fictional users, signed JWT sub/role/aud/exp, expiration and invalid-signature behavior; do not log tokens | Locally fabricated HS256 JWT or offline string parser |
| H2 HTTP/ACL/RLS | PostgREST actual HTTP statuses for anonymous, valid owner, foreign owner, invalid/expired tokens and RPC permissions; distinguish authentication-layer denial from RPC blocked response; no cross-user leaks | SQL-only SET ROLE / claims GUC manipulation |
| H3 auth.uid() compatibility | PostgREST v14 runtime claim/GUC behavior on actual HTTP requests; `request.jwt.claim.sub` versus `request.jwt.claims` and expected fail-closed NULL semantics | Code shape or isolated psql alone |
| H4 snapshot/boundary | Exact candidate SQL SHA, isolated DB application, 0/1000/1001 rows, foreign/deleted rows, null precedence, 6-digit time precision and 8-day edges | 0-row smoke only or unchecked result count |
| H5 races/stale replies | Concurrent update/delete, ABA, same-count substitution and single-statement consistency, plus separate logout/stale UI reply suppression checks | Claim that H4 covers concurrency or session clearing |
| H6 cleanup/cost/off invariants | Independent Docker daemon absence of containers, networks and processes after cleanup, failure/cancellation handling, no additional charges, production OFF / start null / HOLD unchanged | `docker rm` exit code or mock `listOwned` alone |

## 5. Fail-closed stop / teardown rules

- Missing G1–G5, changed image/checkout digest, workflow mismatch, or stale billing proof: **NOT RUN**. No pull, boot or dispatch.
- Unexpected non-loopback destination, leaked secret, real user data, production endpoint, network publication or persistent volume: **FAIL, abort**, isolate and destroy only verified run-owned resources.
- GoTrue JWT validation, PostgREST RLS, owner boundaries, 1001 rejection or candidate SQL hash differs: **FAIL**; never log sensitive payloads or promote partial success.
- Runtime crash, command timeout, 10-minute budget deadline or cancellation: **FAIL / NOT PROVEN**, attempt cleanup; cancellation may prevent steps from running, so do not presume destruction.
- Cleanup, final daemon inventory or billing recheck fails or is unavailable: **FAIL / NOT PROVEN**, never label G3/H6 PASS. Do not delete unknown/unowned resources.
- Do not enable production or upload real FIT after isolated testing.

## 6. Non-secret execution record template (fill only after authorized run)

- Execution authority: G5 explicit approval reference, approved scope and actor
- UTC/JST start/end: NOT RUN
- Executable checkout SHA: NOT SET
- Source PR audit references, registry child digest and version per image: NOT FINAL
- Standard runner, job limit, retries, artifact/cache/external cost controls: NOT FINAL
- Actual billing/zero-additional-cost check: NOT VERIFIED
- H1: NOT PROVEN; H2: NOT PROVEN; H3: NOT PROVEN; H4: NOT PROVEN; H5: NOT PROVEN; H6: NOT PROVEN
- Stop/teardown/daemon remainder: NOT OBSERVED
- Production OFF/null, #109/#201, #222/#223 HOLD state: verify independently, not inferred

**Approval request remains unwritten until the exact executable scope and independent G1–G4 evidence exist.** This runbook only organizes what the owner would need to read and decide.
