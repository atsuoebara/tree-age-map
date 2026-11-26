# Rings Now P3 production application review packet — 2026-11-26

Status: REVIEW ONLY / production application NOT authorized / UI OFF / release timestamp null.
No execution, no production connection, no automatic migration. This is the existing final G5 gate carried into P3, not a new gate.

## Evidence and exact SQL
- Independent auditor's report supplied by owner: second isolated run at 08:34 JST, single authorized execution, all 14 POST/GET cases passed, exact RPC PT401 evidence on both methods, cleanup and inventory passed. GitHub Failure is intentional non-self-certification. Run ID and retained evidence digest to be supplied by auditor before approval; not independently retrieved here.
- Execution candidate bf291b7ad2f6fe0e5e03104c1850f4598e7c7c5d; source main 9e8a5467ec4008a5a379f9920ae07ae7e7954379.
- Exact proposed apply SQL: docs/rings-now-g5-snapshot-v02-REVIEW.sql, Git blob e760aabb930367220d90bcc00e96194bbd8fc167. Use original bytes, not a copy, migration rewrite or CREATE OR REPLACE. No alteration of existing v01, tables, data, policies, auth functions or global API settings. Separate owner approval must name target project, exact SQL blob and execution operator.
- The SQL transaction has lock timeout 2s and statement timeout 10s per statement; errors abort the transaction. Confirm client stops on error and does not split the transaction. Existing signature is a hard stop.

## Before approval: read-only production metadata and infrastructure review
- Verify exact target project fhwvntpzwyenendhcgbw; do not access rows or tokens. Separate authorization for bounded metadata read if needed. Use read-only transaction with statement timeout 5s, lock timeout 1s, rollback. Do not issue DDL or EXPLAIN ANALYZE.
- Recheck v02 absence, public schema exposure, runs owner/RLS/force RLS, authenticated effective role memberships (including inherited grants, owner and bypass paths), column types and effective SELECT, applicable SELECT policies and auth.uid/auth.jwt definitions, default function ACL including inherited grants. Inventory roles that can execute after creation; no unexpected client role. Administrative roles are distinct from API callers. Review query plan without ANALYZE if safely possible without row access; no new indexes or other changes by implication.
- Review expected request volume, existing free-tier limits and query cost; no new paid service or resource. A row limit is not a guarantee of bounded scan cost.
- UI OFF is NOT an RPC access barrier: creation with authenticated EXECUTE exposes the RPC to authenticated API callers immediately if public is exposed. Approval must explicitly cover this exposure.
- HEAD: determine whether deployed gateway/PostgREST serves HEAD, and whether authorization and expiry checks run before any response metadata; check anonymous, invalid signature, expired, no-grant and valid owner behavior. A bodyless success alone proves neither authorization nor lack of disclosure. No production HTTP before approval. Use documented configuration and independently retained evidence where available; unresolved material exposure blocks apply approval, not a new numbered gate.
- Cache: determine actual API gateway/CDN/proxy/browser path; verify authenticated responses are not reusable across users or after expiry, review Cache-Control/Vary and shared cache rules. Do not infer from isolated direct HTTP or VOLATILE. No new paid proxy or global setting change. If evidence unavailable, report unresolved and propose narrow remediation for review; do not silently assume no caching.

## Apply and verification sequence (not authorized)
1. Auditor validates exact SQL, evidence, metadata and HEAD/cache exposure decision, and proposes exact bounded verification and rollback statements. Owner explicitly approves target, exact blob, exposure and execution scope.
2. Execute the exact transaction once by designated operator, no automatic retry. If result uncertain, stop and determine catalog state read-only; never rerun blindly. No schema reload command unless separately reviewed and approved.
3. Verify catalog signature, body, language, volatility, invoker, empty search_path, effective grants and RLS using read-only metadata. Confirm no unintended changes. Any failure stops progression; do not claim rollback after commit.
4. If necessary, separately approve narrowly scoped rollback: revoke authenticated EXECUTE or drop exact new zero-argument function with RESTRICT, only after exact identity and dependency verification. Never CASCADE, touch v01 or delete run data. No rollback executed by this packet.
5. Separately approve production HTTP verification with designated consenting test accounts and no data writes, no token/row logging. Confirm POST/GET/HEAD and cache behavior within scope; never use arbitrary real-user data. Keep feature OFF and release timestamp null.
6. iPhone-first UI and device-local analysis: existing functionality intact, individual calendar selection including multiple same-day runs, outdoor only, 691200 seconds elapsed including stops, no correction, missing started_at blocks, late/session-changed responses discarded. No automatic feature enablement. Owner explicitly approves release after independent audit and device check.

## Audit outcome requested
One consolidated decision: apply-ready or blocked, with exact evidence and minimal remaining actions. Do not create G6/G7 or repeat already established isolated checks without a concrete change or evidence gap.
