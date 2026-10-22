# Garmin Starter Activity Push: deployment and verification

## Specification basis

- User-provided Activity API 2.0 PDF, revision 2026-10-15. SHA-256: `e7d88431d0876cbab7a6ea5773471570347e4dac69562f88a046a805e7063319`.
- Sections 3/4 (pages 5-6): server-to-server JSON Push, acknowledge within 30 seconds, process asynchronously; maintenance On Hold retains notifications for seven days. Disabling an endpoint discards its queued notifications.
- Section 6.3 (pages 13-16): `activityDetails` contains summary and optional GPS samples. Details exceeding 24 hours are not delivered. This importer ignores manual, parent, non-running and GPS-less activities.
- Enterprise Ping/Pull/backfill is not used. This integration cannot reconstruct a notification Garmin has permanently dropped.
- [Official OAuth PKCE specification](https://developerportal.garmin.com/sites/default/files/OAuth2PKCE.pdf), page 5: registration DELETE and authoritative user-permissions GET. The Activity PDF does **not** define lifecycle webhook JSON. `deregistrations`/`userPermissionsChange` are accepted as cache-invalidation hints; their contents never directly revoke or grant a registration. Actual provider lifecycle delivery remains unverified.
- [Supabase scheduling documentation](https://supabase.com/docs/guides/functions/schedule-functions) and [Cron](https://supabase.com/docs/guides/cron).

## Architecture and security

1. Push secret-path and optional client-ID header checks precede body handling. Streamed request bodies are capped at 8 MB. The entire batch is validated before writes.
2. `garmin_receive_details` records an atomic batch for an unambiguous account with local intake enabled and stored Activity Export permission. It retains only importer fields, discarding legacy tokens and unused sensor data. HTTP 200 follows durable receipt; DB errors return 503 for provider retry.
3. The asynchronous worker refreshes authoritative Garmin permissions. Cached permissions older than two minutes cannot authorize a run insert. Provider outage retains encrypted credentials and retries, rather than trusting stale permissions. Confirmed 403 or OAuth `invalid_grant` removes only the matching connection generation.
4. `garmin_commit_activity` locks the connection then the receipt, checks the current connection generation and attempt number, and commits run creation and receipt completion together. Reconnection cancels old queued work. Local disconnect first disables intake and strips queued payloads; remote DELETE is serialized with token refresh and retried after provider failure.
5. Garmin external IDs deduplicate across receipts, including soft-deleted runs. Distinct Garmin IDs survive even at the same distance/time. Other sources require start time within two minutes and distance within 3% (minimum 100 m). Cross-source heuristic matching does not guarantee deduplication against a simultaneous independent Strava insert or an old record without `started_at`.
6. Completed/ignored/duplicate receipts retain metadata, not raw GPS. A stale attempt cannot overwrite a later claim. Interrupted work is reclaimed after six minutes; retry backoff grows from one minute to a six-hour cap. A five-minute worker lease prevents overlapping refresh-token rotation.
7. All public RPCs are SECURITY INVOKER and revoked from PUBLIC/anon/authenticated. Private Vault-token comparison is a narrowly scoped SECURITY DEFINER function outside the exposed schema, executable only by service_role. Private worker state has RLS and no client grants.

## Scheduled recovery

- Active job: `garmin-activity-retry`, every two minutes. It posts only to the fixed `/garmin-activity-push/drain` endpoint.
- A dedicated 256-bit worker token is generated inside Postgres and stored in Vault. Its value is not returned, committed or embedded in cron SQL. `GARMIN_TOKEN_KEY`, client credentials and existing push secret are never replaced by these scripts.
- Acknowledging `/drain` means the background worker was accepted, not that imports succeeded. Check cron run status **and** receipt states, last permission check, worker logs and HTTP response status.
- Two oldest due connections are reconciled each tick, even without activity notifications. Receipts belonging to other accounts also force a fresh permission check when needed. Lifecycle notification loss therefore recovers through polling. Failed permission checks retry after five minutes.
- For maintenance, use Garmin's On Hold setting rather than disabling the endpoint. Resume within seven days. After recovery, confirm that failed notifications arrive and receipt states progress. Starter has no historical backfill recovery guarantee.
- Lifecycle endpoints may be pointed at the same existing secret URL, without changing its value. Their actual JSON and delivery must be verified in Garmin's tools before declaring lifecycle webhook testing complete. Polling is already active.

## Apply and test

- Base schema: `supabase/garmin-activity-inbox.sql`; reliability schema and scheduler: `supabase/garmin-activity-reliability.sql`.
- Edge functions: `garmin-activity-push` and `garmin-oauth`. Both handlers perform their own authentication; platform JWT verification remains disabled as before.
- Mock suites: `node scripts/test-garmin-push.mjs`, `node scripts/test-garmin-oauth.mjs`, `node scripts/test-garmin-controls.mjs`.
- `scripts/test-garmin-database.sql` runs service_role integration checks using a synthetic user within one transaction and always rolls back. It does not persist mock accounts, runs or outbound trigger requests. Identity sequences can advance.
- The unchanged connection UI still describes automatic sync as preparation until the first real end-to-end watch test passes. No UI Build increment is included.

## Verification on 2026-10-22

- Deployed Push v5 and OAuth v7; retrieved source matches the tested local source.
- All three mock suites passed. Service_role DB tests passed: receipt/run idempotency, stale-attempt rejection, soft-delete protection, separate Garmin runs, cross-source match, reconnect, permission removal, local disconnect and RPC grants. Transaction rolled back; no mock account remains.
- Dedicated worker authentication: a real Vault-backed POST returned HTTP 200 without timeout. Live permission GET succeeded for the existing account; `ACTIVITY_EXPORT` confirmed. Scheduled runs at 13:46, 13:48 and 13:50 JST succeeded; permission recheck advanced at 13:50:03 JST.
- Public negative checks: invalid Push path 404, unauthenticated drain 403, OAuth status without valid origin 403. Inbox remained empty.
- Security/performance advisors checked. No new Garmin client-callable SECURITY DEFINER warning; private RLS-without-client-policy and unused empty-inbox index are expected. Existing unrelated warnings were not changed. See [RLS no-policy explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- **Unverified:** real Garmin watch sync through configured Push URL to saved run; actual lifecycle notification delivery; actual device revoke/reconnect; real provider notification replay after an outage; simultaneous independent delivery across two sessions. Mock/transaction tests do not establish these outcomes.

## First real watch test

Sync a new GPS running activity through Garmin Connect. Check the inbox state and the resulting Garmin external ID, date, distance and route in runs. Re-send the same notification through Garmin's tools to verify one saved run. Check a second run on the same day remains separate. Then test permission withdrawal and disconnect/reconnect using the real account; do not simulate those changes against the real account without the user's participation.

## Real automatic delivery and UI update, 2026-10-22

At 18:06:26 JST Garmin automatically delivered activity 24811705124 without manual resend. Inbox completed saved at 18:06:30. The resulting run has the correct owner, date, Garmin external ID, 39.31 m and 106 GPS points. Strava also linked to the same single run; no duplicate row was observed. Earlier activity 24810481769 also arrived and completed duplicate. This verifies one real automatic delivery/save and observed coexistence, not general concurrency, lifecycle or outage coverage.

UI Build 2026.10.22.06 describes automatic GPS-run import after connection and possible delay in Japanese/English. Historical lifecycle/concurrency/revoke/reconnect gaps above remain open.
