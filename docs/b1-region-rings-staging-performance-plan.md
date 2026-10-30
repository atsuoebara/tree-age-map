# B-1 Region Rings — isolated Today ingestion performance acceptance plan
Date: 2026-10-30
Status: TEST PLAN ONLY. No staging project created, no ingestion test run.

## Ground truth
- Production runs trigger: trg_rings_today_live_sync, row-level AFTER INSERT or UPDATE of route/distance_km/activity_date/deleted_at, calls enqueue_rings_today_live_sync() and sends HTTP to Edge Function.
- B-1 trigger: b1_runs_invalidate, statement-level AFTER INSERT/UPDATE/DELETE, calls rr_private.invalidate_region_rings_cache(), updating one dirty-state row and clearing private candidate rows.
- The region distance source has its own invalidation trigger.
- Private candidate table empty; public release remains disabled.
- Only one Supabase project was returned by list_projects on 2026-10-30; do not create another project or incur costs without checking account limits and obtaining explicit approval.

## Reproduction design
1. Build an isolated local PostgreSQL/Supabase environment at zero marginal cost if supported. Never clone real runs or secret keys, or send requests to actual Today functions.
2. Create equivalent minimal runs schema, private candidate/dirty-state tables, exact production-style B-1 statement-level trigger, and a stand-in Today row-level trigger that records a queued event locally. This local sink is an approximation; network HTTP queue impact requires separate staging.
3. Exercise the actual ingestion patterns, including single-row statements and multi-row statements (batch sizes 1, 10, 100; 100 and 500 synthetic runs per trial). Use 5+ alternating A/B trials and compare with and without only the B-1 trigger.
4. Measure total INSERT/UPDATE transaction latency, median/p95/max, counts of Today queue events, B-1 trigger calls, transaction failures and lock waits for two concurrent sessions. Reset caches fairly and disclose test system specs.
5. Add a staging test with a real asynchronous pg_net -> **dummy receiver** (never production Today) before release if needed to assess actual network enqueue overhead.
6. Test update/soft delete, region sync and revocation causing private candidate invalidation. All synthetic data only.

## Acceptance and limitations
- Today event count unchanged by toggling B-1.
- No unexpected ingest errors or deadlocks. Record actual contention rather than relying on one snapshot.
- Report A/B latency deltas and confidence/sample size rather than assuming a threshold not agreed in advance.
- Separate local/staging measurements from production observations.
- MUSE must independently audit. Atsuo approves the release.
- Formal public authorization/UI, differencing suppression and external-cache revocation are separate blockers.
- Public aggregation remains OFF, and no production data modification is permitted for tests.
