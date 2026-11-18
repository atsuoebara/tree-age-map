# Rings Now — P2 service boot configuration preflight (NOT RUN)

Date: 2026-11-17. This is an **OFFLINE, non-executable configuration SHAPE review**. It does **not** create runnable Docker commands or secrets, pull images, start containers, execute SQL, connect to Supabase or enable P2.

## Scope
Adds `tests/rings-now-p2-service-boot-preflight.cjs`, `tests/rings-now-p2-service-boot-plan-CANDIDATE.json`, and `tests/rings-now-p2-service-boot-preflight.test.cjs`. Pure validation against the existing audited G1 candidate/ledger and the still-BLOCKED active manifest. The proposed PostgreSQL 17, GoTrue v2.197.0, PostgREST v14.18 environment **key names only** are documented; no values, passwords or JWT secrets exist here. The configured environment variables are not claimed to be sufficient for those exact image builds. Required keys may be missing or named differently until official runtime/image evidence and real integration checks confirm them.

The review proposes one private, non-attachable, non-published network, ephemeral credentials created *inside a future disposable runner*, no production credentials, no mail/phone/OAuth external delivery, and empty runtime verification flags. The PostgreSQL write path is a **proposal**, not proof that `readOnlyRootfs` works for any of the three services. In particular, GoTrue migrations/schema setup and the PostgREST JWT claims GUC behavior remain untested.

## Automated review results
14 test cases target forged execution permission, secret inclusion, host network exposure, container image drift, incorrect environment key names, startup/healthcheck proof promotion, billing claims and cleanup/timeout claims. Development ran these through a V8 shim against the fetched GitHub source: **14/14 PASS**; this does **not** count as native Node verification. Ask Muse to execute `node --test tests/rings-now-p2-service-boot-preflight.test.cjs` on the exact PR HEAD.

## Completion blockers (no progress credit for documents)
1. **G1**: official immutable image provenance, actual runtime image/variant compatibility and supplied startup requirements not yet independently validated for executable P2.
2. **G2**: GitHub Billing/account UI evidence proving *incremental* cost zero for a planned Actions run, including retention and runner eligibility, remains absent.
3. **G3**: actual, isolated service boot config, real healthchecks, Auth DB roles + JWT, bounded Docker actions, independent daemon resource cleanup/absence evidence and timeout/cancellation remediation not yet implemented or proven.
4. **G4**: entire executable runner HEAD requires a separate independent audit. A preflight-shape PR audit alone cannot fulfill it.
5. **G5**: explicit Atsuo approval of a *specific* P2 run only after G1–G4. Neither a “next” nor PR merge approval authorizes execution.
6. **H6/A1–A6**: actual isolated HTTP/JWT/ACL/RLS/SQL, snapshot consistency, timing, boundaries and recovery remain NOT RUN. Production changes are a wholly separate decision.

## Safety invariants
The existing workflow stays `if: ${{ false }}`. Live manifest remains `BLOCKED_NOT_RUN` with all image references/digests null, billing `NOT_VERIFIED` and `explicitExecutionApproval=false`. No existing fixture, SQL, watchdog or production source changes. Feature OFF, `featureStartedAtMs=null`, PR #109 HOLD.

## Muse review focus
Check three added files, source-head tests, no runtime env values or executable commands, no false G1/G2/G3/P2 claims, and try negative mutations of service key lists, forged billing/proof flags, network modes, image references and production credentials. **Do not merge, start Docker/Actions, apply SQL, or launch P2 without separate authorization.**
