# Journal audit read-only account — implementation and QA plan (2026-11-06)

Status: PREPARED ONLY. No audit-user account or RLS policy has been created.

## Goal
Give one designated Supabase Auth user read-only access to `public.journal_posts` drafts for independent auditing. No `runs` access, no service_role sharing, no broadened read permissions for other registered users.

## Verified production baseline (2026-11-06)
- `journal_posts` has RLS enabled; currently five policies: four owner-specific CRUD and one published-only SELECT.
- `authenticated` has table grants for all CRUD; actual authorization MUST be governed by RLS.
- `runs` has RLS enabled; broad public SELECT and INSERT policies were removed by migration `restrict_runs_rls_to_owner_only_20261106`; four owner-specific policies remain.
- Existing owner JWT is NOT a valid test identity for an auditor: must use a new, distinct Auth UID.

## Preflight
1. Recheck `pg_policies` for both tables and confirm the broad `runs` policies remain absent.
2. Confirm the designated auditor can access email/password Auth without putting the password in GitHub, chat, logs, SQL, or public URLs.
3. Create an account using Supabase Auth Admin UI or a secured registration process, not raw direct inserts into `auth.users`. Verify email where applicable.
4. Obtain the resulting UUID from Supabase Auth Users dashboard. Do not use a dummy or guess UID. Confirm it differs from application owner.
5. Confirm no extra broad policies on sensitive tables under `public` before first sign-in.

## Migration template — DO NOT RUN BEFORE AUDITOR UUID EXISTS
Replace `<AUDITOR_UUID>` with the actual auditor Auth UID. Create **one** SELECT-only policy; do not touch existing policies.

```sql
CREATE POLICY "Journal auditor can read all posts"
ON public.journal_posts
FOR SELECT TO authenticated
USING ((select auth.uid()) = '<AUDITOR_UUID>'::uuid);
```

Do not create an `INSERT`, `UPDATE`, `DELETE`, or `ALL` policy for this account.
The auditor is not to receive the owner account, password, service_role key, or any direct database privileged role.

## QA (run before declaring deployment complete)
- With **anon** token: draft SELECT returns 0, published SELECT returns published articles only.
- With **auditor** JWT: SELECT can read a known draft and published post. Audit access applies only to `journal_posts`; SELECT on `runs` returns zero rows.
- With **different nonowner authenticated user** JWT: drafts are not visible.
- With **auditor** JWT: test INSERT, UPDATE, DELETE are denied by RLS. Use a dedicated disposable journal test record and a staging environment, or protect production tests from side effects. Note: `UPDATE`/`DELETE` can return 0 affected rows without an error; assert actual row count and unchanged original state.
- Check existing owner can still create/edit/publish posts; check public Journal still loads published posts.
- Confirm Auth access and JWT session are reproducible by the auditor using their own secure login flow.
- Capture pass/fail per item, no passwords or JWT in evidence.

## Revocation
1. Drop exactly the auditor policy:
   `DROP POLICY "Journal auditor can read all posts" ON public.journal_posts;`
2. Disable/delete auditor Auth user, revoke sessions where possible, and rotate compromised credentials.
3. Validate that auditor SELECT on drafts now fails even with a previously issued JWT. Dropping the policy is the definitive immediate RLS revoke; deleting the Auth user alone does not invalidate existing JWTs.

## Important scope boundary
Only `journal_posts` SELECT is intended. The auditor's `authenticated` role may inherit *table grants* elsewhere, but proper RLS must continue to restrict rows; re-audit all sensitive table RLS before enabling the account. No need to give access to `runs` or individual route points.

## Outstanding runs security remediation final acceptance
- Anonymous SELECT denied: verified by Chappy and independently by Muse.
- Anonymous INSERT denied; cross-user INSERT denied; owner-only SELECT: verified in transactional database role tests.
- Owner INSERT, UPDATE, DELETE functional verification: pending; production triggers include live-sync side effects, so do not casually run write tests against production just for QA.
- Ranking, Territory, regional rings, and public statistics: live UI verification pending.
- Strava synchronization and file-import: actual end-to-end verification pending.
- No rollback of the two `runs` policy removals unless an actual breakage merits incident response; broad access restoration has privacy cost.
