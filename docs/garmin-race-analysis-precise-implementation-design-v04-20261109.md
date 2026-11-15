# Garmin Race Analysis — precise implementation diff for independent audit (v0.4, 2026-11-09)

> **Design only.** This is not executable migration and no DDL/Edge Function is deployed. No merge authorization. C4 (lifecycle proof), C6 (Deno pressure test) and partial sensor coverage remain blocking.

## Actual code and catalog confirmed 2026-11-09

- `supabase/functions/garmin-activity-push/index.ts` deployed `sanitized()` stores GPS-only samples, `parsed()` constructs a run, worker invokes `garmin_commit_activity(p_id,p_attempt,p_record)`.
- SQL `garmin_commit_activity` performs current consent/generation check, cross-source duplicate test, inserts into `runs` only for `saved`, clears receipt `payload={}` **in the same transaction**.
- `garmin_cancel_queue` trigger fires on `garmin_api_connections` DELETE or relevant UPDATE and strips queued inbox payload. `runs` has AFTER UPDATE triggers for region cache invalidation and live sync.
- `runs.id` bigint PK, `runs.user_id` uuid *nullable*, `deleted_at` timestamptz nullable. RLS owner-select, insert/update/delete already exists on `runs`. `garmin_api_connections.user_id` uuid NOT NULL and has `import_enabled`, `permissions`, `connection_version`.
- These statements are catalog/code observations, not proof of the current iPhone delete UI path.

## Proposed DDL (illustrative; audit before migration)

```sql
-- 1. A composite reference requires an explicitly unique target pair.
create unique index if not exists runs_id_user_id_unique
  on public.runs (id, user_id);

-- 2. Analysis belongs to one canonical run and one source connection generation.
create table public.run_race_analysis (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  run_id bigint not null,
  analysis_version text not null,
  source_kind text not null check (source_kind = 'garmin_activity_details'),
  source_connection_version uuid not null,
  distance_basis text not null check (distance_basis = 'device_cumulative_m'),
  time_basis text not null check (time_basis = 'clock_elapsed_seconds'),
  sample_count integer not null check (sample_count >= 2),
  segments jsonb not null check (jsonb_typeof(segments) = 'array'),
  overall_flags jsonb not null default '[]'::jsonb check (jsonb_typeof(overall_flags) = 'array'),
  created_at timestamptz not null default now(),
  unique (user_id, run_id, analysis_version),
  foreign key (run_id, user_id) references public.runs (id, user_id) on delete cascade
);
alter table public.run_race_analysis enable row level security;
revoke all on public.run_race_analysis from public, anon, authenticated;
grant select on public.run_race_analysis to authenticated;
create policy run_race_analysis_owner_select
 on public.run_race_analysis for select to authenticated
 using ((select auth.uid()) = user_id and exists (
   select 1 from public.runs r
   where r.id=run_id and r.user_id=user_id and r.deleted_at is null
 ));
-- Do not create INSERT/UPDATE/DELETE policies or client write grants.
-- Ownership of server-side authorized write RPCs must be audited.
```

**DB security note:** row ownership also requires server-side checking of Garmin import consent and `source_connection_version` in the same transaction that inserts analysis. No `SECURITY DEFINER` exposed to public clients. Use the already privileged, REVOKE-protected importer RPC pattern. Verify actual role and grants in catalog before migration. JSON field sizes, quality flags, canonical versions and array validation must be enforced in the worker/RPC beyond the illustrative SQL.

## Exactly where the ingestion change must be

**Current**
```ts
// sanitized(): samples only [latitudeInDegree, longitudeInDegree]
// parsed(): returns {activity_date, started_at, distance_km, name, route, indoor, source, source_external_id}
// worker: rpc('garmin_commit_activity',{p_id:r.id,p_attempt:attempt,p_record:parsed(r.payload)})
```

**Proposed (pseudocode; no shipped implementation)**
```ts
// sanitized(): preserve required limited sensor fields per point ONLY after validated shape:
// startTimeInSeconds, totalDistanceInMeters, heartRate, stepsPerMinute,
// powerInWatts, latitudeInDegree, longitudeInDegree.
// Preserve summary activityType, distance and connection version.
// No raw FIT/TCX and no full verbatim notification.
// Apply per-activity size/samples cap before DB storage; failure falls back to old GPS-only processing.
const input = parsed(r.payload); // unchanged route producer
const candidate = !input?.indoor ? safelySummarizeSamples(r.payload) : null;
// candidate failure MUST NOT prevent original route insert / outcome processing
await rpc('garmin_commit_activity', {
  p_id:r.id,p_attempt:attempt,p_record:input,
  p_analysis_candidate:candidate
});
```

**Atomic commit requirement**: the revised SQL `garmin_commit_activity` must produce the existing `saved/duplicate/ignored/stale` result unchanged. Only in the same transaction on `saved`, after the run ID is obtained, may it insert `run_race_analysis`. A candidate must never attach to a cross-source duplicate, soft-deleted run, stale connection or revoked consent. If invalid/oversized candidate, simply skip the optional analysis and complete existing import. A DB error involving analysis must not roll back run import: validate candidate thoroughly and use a contained PL/pgSQL exception block/savepoint for optional insert; audit observable failure counters without private payloads.

**Race condition**: the `saved` branch must use `INSERT ... RETURNING id INTO saved_run_id`; `on conflict DO NOTHING` without returning an ID is not proof of saved. Keep the connection/inbox row locks and same `p_attempt` guard. Never add a second independent post-commit write for analysis.

**Peak payload and ACK**: retaining 12k+ sensor fields in inbox increases storage and worker RAM. Repeated JSONB transfer must be measured with actual-ish Deno fixtures; the current 8,000,000-byte receiver limit remains unchanged and may legitimately reject oversized files. No unbounded array or full raw payload retention.

## Partial coverage: required data contract (blocks acceptance)

For each metric, persist `raw_field`, `raw_unit`, `aggregation_method`, `covered_distance_m`, `coverage_fraction`, `mean_raw_value` (nullable). `covered_distance_m` is the *sum of covered positive-distance intervals with two finite endpoint values*; `coverage_fraction=covered_distance_m / segment_distance_m` clamped to [0,1]. Never mark 50%-covered segment as complete. Proposed v1 UI: show numeric sensor mean only if coverage >= 0.80, otherwise show `データ不足（計測範囲: XX%）`; coverage and threshold require auditor approval. `stepsPerMinute` remains raw in its original unit; do not double to match TCX cadence.

## C4: lifecycle proof plan (not yet passed)

| Event | Existing path / observation | Proposed guarantee | Evidence required |
| --- | --- | --- | --- |
| Physical DELETE of `runs` | Existing owner DELETE RLS | Composite FK cascade removes analysis | transactional synthetic fixture, rollback |
| Soft-delete `runs.deleted_at` | Column exists, live-sync trigger watches it | New AFTER UPDATE OF deleted_at trigger deletes child analysis immediately | transactional synthetic fixture, rollback; assert RLS hides before+after |
| Garmin local disconnect | `garmin_cancel_queue` already clears inbox on connection DELETE/UPDATE | New connection cleanup trigger purges all Garmin analyses for user on DELETE or disable, version change, user ID change | transactional fixture, rollback; verify no unwanted run deletion |
| Export permission revoked | Existing queue trigger checks `garmin_has_export` | Purge analysis only on **authoritative** permissions change (not webhook hint alone); RLS also hides if absent consent | permission refresh integration test and transaction rollback |
| In-flight processing at disconnect | Existing `garmin_commit_activity` locks connection and inbox; generation checked | save blocked after disable/version change, analysis write atomic with saved | two-session concurrency test with deterministic barriers |
| Repeat notification / soft-deleted run | Existing dedupe includes deleted run | no resurrection or new analysis | simulated attempt and SQL result assertions |
| User-level removal | Unknown overall account deletion graph | explicit cleanup inventory and proof | inspect account deletion flow before ship |

**Important**: physically removing historical analyses when Garmin connection is disabled may be a product-policy decision; this document proposes strict deletion, not claims it already exists. Prevent accidental loss of manually imported analysis from another source by scoping `source_kind` and run source to Garmin.

## DDL/RLS test plan before any deployment
1. Use disposable isolated test identities/rows in a transaction that is ROLLED BACK; never modify real runner rows.
2. As authenticated account A, SELECT its own analysis only; SELECT account B returns none; anon returns none; attempts to insert/update/delete via client fail.
3. Service-side write allowed only for correctly correlated owner, saved Garmin run, permission and connection generation; wrong user_id + run_id composite FK fails.
4. Confirm physical DELETE cascades, soft-delete trigger purges and cannot be seen even if trigger fails, disconnect/revoke purges and blocks inflight insert.
5. Confirm no contribution to B-1 region public aggregation, Ranking, public endpoints or export; verify with query inventories.
6. Capture Postgres index usage, policy overhead and lock ordering. Ensure maintenance doesn't trigger unrelated `runs` update side effects.

## C6: Deno mandatory gate
- Instrument a **local isolated Deno/Supabase worker** with synthetic 12,561+ sample POST and >8 MB negative case; report raw and sanitized body bytes, memory peak, processing ms, DB receipt bytes, retry/state transitions, HTTP ACK/timeout behavior.
- No credentials in fixtures/logs. Compare parsing failure with original run import result for identical GPS-only inputs. Confirm existing importer behavior bit-for-bit before enabling.
- 3,090,649 bytes is *synthetic local Python payload only* and not Deno proof.

## Status / no overclaim
This PR documents exact recommended architecture but does NOT contain executable DDL, real Deno load results, or audited deletion tests. Approval requested: **review this precise diff design**, not authorization to deploy or merge.
