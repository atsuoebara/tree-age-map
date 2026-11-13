# C4 account deletion and concurrent revoke: evidence (2026-11-09)
**Read-only production catalog inquiry. No prod user rows read, no production writes.**

## Live database FK inventory
- `public.garmin_activity_inbox.user_id → auth.users(id) ON DELETE CASCADE`
- `public.garmin_api_connections.user_id → auth.users(id) ON DELETE CASCADE`
- `public.runs.user_id → auth.users(id)` with **no ON DELETE CASCADE** (default NO ACTION).

**Interpretation**: deletion of an `auth.users` row while it still has `runs` may fail due to FK. There is no proof of a full account deletion flow. Do not claim C4 account deletion is cleared. Any cleanup path must preserve user consent and never delete real data during testing.

## Isolated two-session concurrency test
- GitHub Actions run #42557834855, ephemeral Postgres 16, synthetic owner/inbox/record.
- Session A updates Garmin export permissions to `[]`, holds connection row for ~4s; session B invokes actual 4-argument proposed `garmin_commit_activity`.
- Observed `RPC returned: ignored, elapsed seconds: 4`.
- No `runs` row inserted and inbox state becomes `ignored`.
- Result proves **this lock-order competition** behaves safely in isolation; it is not proof of all races or production behavior.

## Remaining C4 gate
- Account deletion: inventory all user-owned dependent tables and current deletion entrypoint, decide cascade/manual removal strategy, test only in isolated DB.
- Concurrent run insert vs physical/soft delete and permission refresh/reconnect; include stale processing attempts.
- Review schema and RPC fixtures together on actual Supabase-style privileges, not only CI superuser.
- Independent Muse audit before deploying. Do not merge or apply until explicitly authorized.
