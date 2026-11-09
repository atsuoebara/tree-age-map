# PR #66 / v0.5 — R1–R3 decision record (2026-11-09)
Status: independent-audit supplement; implementation NOT authorized by this document.

## Verified existing receiver invariant
`supabase/functions/garmin-activity-push/index.ts` currently enforces **8,000,000 raw bytes** in `readBody()` before JSON parsing. It returns 413 on oversized request bodies. The importer uses `sanitized()` only *after* full request read and parse, and enqueues the batch by a DB RPC. This matters for R1:

> A request already larger than 8 MB **cannot** be rescued by a `sanitized()` sensor fallback. The receiver rejects it before any activities can be read. Calling this a graceful fallback would be factually wrong.

## R1 decision (two separate paths)
1. **Raw body <=8,000,000 bytes:** parse the batch once. For every activity, attempt the OPTIONAL sensor preview under per-activity sample and byte budgets. When preview is invalid/too large, retain **existing sanitized GPS-only shape** for that activity. Never drop other activities in the batch because one activity is unsuitable for analysis.
2. **Raw body >8,000,000 bytes:** preserve current 413 guard **until** a separately audited streaming/bounded parser or larger verified safe limit is approved. Do not claim GPS-only intake in that case; `sanitized()` is unreachable. An oversized Garmin batch may not be imported. Evaluate risk using multi-activity batch size fixtures (e.g., two or three 12,561-sample activities) and the existing 8MB limit before activation.
3. No automatic retry loop from optional analysis failures. For <=8MB valid notification, raw payload parsing and mandatory GPS import errors retain current semantics. For >8MB body, provider retry/behavior remains a known blocker and must be measured/documented rather than disguised.

## R2 reception-side and transaction-side responsibilities
- `sanitized(d)` must **never throw due to optional sensors**: use bounded non-throwing extraction, returning base GPS-only payload if any optional shape, size, range or serializer test fails.
- Existing `validDetails` and whole-batch validation remain unchanged. Sensor validity must not cause `enqueue` to return a new 503.
- The authoritative `garmin_commit_activity` still handles `saved / duplicate / ignored / stale` atomically. The new analysis insertion is optional and can never roll back the existing run import.
- `sanitized` extraction failure and **DB/inbox failure are different things**: don't silently turn a durable inbox failure into success (lost Garmin data). Keep existing 503 for mandatory DB failure.

## R3 immutable JSON fixtures required in *implementation PR*
Use a versioned `analysis_version` and fixtures (one complete, one partial coverage, one missing sensors, one invalid/reverse, one pause, one indoor exclusion) pinning:
```json
{
  "analysis_version": "garmin-activity-details-v1",
  "distance_basis": "device_cumulative_m",
  "time_basis": "clock_elapsed_seconds",
  "segment_index": 1,
  "start_m": 0,
  "end_m": 1000,
  "distance_m": 1000,
  "clock_elapsed_s": 300,
  "quality_flags": [],
  "metrics": {
    "heart_rate": {
      "source_field": "heartRate",
      "raw_unit": "bpm",
      "aggregation_method": "distance_weighted_linear",
      "covered_distance_m": 1000,
      "coverage_fraction": 1,
      "mean_raw_value": 150
    },
    "cadence": {
      "source_field": "stepsPerMinute",
      "raw_unit": "steps/minute as provided",
      "aggregation_method": "distance_weighted_linear",
      "covered_distance_m": 0,
      "coverage_fraction": 0,
      "mean_raw_value": null
    },
    "power": {
      "source_field": "powerInWatts",
      "raw_unit": "W",
      "aggregation_method": "distance_weighted_linear",
      "covered_distance_m": 0,
      "coverage_fraction": 0,
      "mean_raw_value": null
    }
  }
}
```
Show sensor mean only if coverage>=0.80; otherwise show "データ不足（計測範囲: XX%）" / "Insufficient data (coverage: XX%)". Do not double cadence or claim moving pace.

## C6 measurement matrix (before enablement)
- 1 x 12,561 samples with complete GPS/sensors; 2 x and 3 x of same; 12,561 samples with half heart-rate coverage; GPS-only; 8,000,000-byte boundary and +1; malformed optional sensor; malformed mandatory GPS.
- Measure *raw body bytes*, sanitized batch bytes, DB RPC payload bytes, Deno peak memory, CPU/runtime, HTTP ACK and 413/503 behavior, retry and inbox state transitions.
- Target: optional sensor errors do not turn otherwise-valid under-limit GPS batches into 503; over-limit handling is accurately reported; no accepted batch lost.
- Treat the above as unverified until local Deno/Supabase tests run.

## Lifecycle and access remain gated
C4 synthetic rollback tests on real schema in isolated scope, simultaneous disconnect/process, account deletion inventory. DDL/RLS account A/B tests, and Japanese+English strings are still requirements. No production code/DB change or merge via this PR.
