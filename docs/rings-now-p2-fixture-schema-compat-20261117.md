# Rings Now P2 fixture V2 — ID type + auth.uid ACL candidate (NOT RUN)

2026-11-17. Static inspection found a **concrete fixture disagreement**:
- Existing `tests/fixtures/rings-now-p2-isolated-schema.sql` has `public.runs.id uuid` and reads only `request.jwt.claim.sub`.
- Production-shaped, separately established PG17 fixture `tests/rings-now-pg17-isolated-setup.sql` has `id bigint GENERATED ALWAYS AS IDENTITY`; PR #178 synthetic scenario/comparator expects integer IDs.
- PR #181 `auth.uid()` dual-GUC candidate has been audited in disposable PostgreSQL by Muse (11 cases), but **when applied alone** defaults to PUBLIC EXECUTE. PR #176 requires the post-function REVOKE/GRANT ACL.

This PR introduces a **separate V2 candidate fixture**, not a replacement for older tests:
1. `public.runs.id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY`, `user_id uuid`, six columns matching the candidate snapshot SQL.
2. `\\ir ../rings-now-p2-auth-uid-guc-CANDIDATE.sql` loads the *exact* #181 candidate in the future from the fixture directory.
3. Enforces `FORCE ROW LEVEL SECURITY`, authenticated-only owner SELECT, and **AFTER** function creation, `REVOKE ALL ON FUNCTION auth.uid() FROM PUBLIC, anon, service_role` followed by `GRANT EXECUTE ... TO authenticated`. Also explicit schema/table ACL.
4. No workflow, manifest, existing PG17 fixture, production settings, public application code, or candidate snapshot SQL is changed.

Offline test checks source-text invariants and negative mutations; **not** a PostgreSQL SQL parser or a DB execution test. In particular, it cannot establish actual role inheritance, Supabase-auth fidelity, unsigned/malformed JWT behavior, FORCE RLS effectiveness, correct SQL `\\ir` resolution at runtime, or non-exposure under a real PostgREST JWT. These require a separately approved isolated P2 run and independent A1/H3 proof.

**Further gate**: The fixture includes `CREATE ROLE`, so must be used only against a disposable database. Role create permissions, transaction behavior of psql meta-commands, and effective ACLs must be checked with a real PostgreSQL preflight before use. In particular, #176's fixture permission tests must be repeated. This V2 is NOT connected to Actions, is NOT production SQL, and does not lift G1–G5.

Actions `if: ${{ false }}`, manifest `BLOCKED_NOT_RUN`, production OFF, featureStartedAtMs null and PR #109 HOLD remain unchanged.
