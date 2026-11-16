# P2 auth.uid() dual-GUC candidate — isolated, NOT RUN

2026-11-17. This is **a static SQL candidate and a separate JavaScript expectations model only**. The SQL has not been executed, and the model tests do not prove PostgreSQL evaluation or actual PostgREST JWT validation.

## Basis
- Existing synthetic PG17 fixture in main reads only `request.jwt.claim.sub`, whereas PostgREST 14 documents `request.jwt.claims` JSON. Both can differ across deployments; never infer that the legacy setting is definitely absent without actual HTTP observation.
- PostgREST 14 transaction-scoped settings: https://docs.postgrest.org/en/v14/references/transactions.html
- PostgREST 14 authorization: https://docs.postgrest.org/en/v14/explanations/db_authz.html
- Supabase compatibility expression: https://supabase.com/kb/troubleshooting/permission-errors-when-granting-custom-roles-access-to-the-auth-schema-9e32e7

## Proposed behavior (NOT proven)
- Legacy-only or JSON-only `sub`: use it; missing/empty: NULL; both equal: use it; both present and **unequal: NULL**.
- Invalid UUID or malformed JSON: SQL error is preferable to authenticating the wrong user. This is an evaluation design, NOT evidence of a valid signed JWT.
- Scope is synthetic P2 fixture only; not a change to real Supabase `auth.uid()`. The candidate file is not imported or loaded by existing CI/workflow.

## Before real P2 proof
A separately reviewed PG17 test must execute **this exact candidate file** (not a hand-written substitute), set each GUC inside transaction scope, exercise missing/empty/equal/conflicting/malformed cases, verify owner A vs B + RLS, and inspect `request.jwt.claims` produced by actual PostgREST 14.18 using valid/invalid/expired GoTrue JWT. Avoid logging tokens or real user data. PostgREST signed JWT, audience, role and expiration must be separately verified. No Actions dispatch before G1–G5 and owner approval. Unexecuted SQL test cases are **NOT PROVEN**.

PR #179 and #180 independent audits remain separate. Existing PG17 fixture/CI, main workflow hard stop `if: ${{ false }}`, manifest `BLOCKED_NOT_RUN`, production OFF, featureStartedAtMs null, and PR #109 HOLD remain unchanged.
