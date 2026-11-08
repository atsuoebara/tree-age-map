# PR #66 — independent audit follow-up (2026-11-08)
Status: proposed design decisions, **not** implementation approval. No live application code or DB changes.

## M1 — fixed terminology and quality policy for next review
- Distance reference is device cumulative distance, not certified race distance.
- Split boundary times are linear interpolation of cumulative device distance versus timestamps; strictly increasing valid samples only.
- `clock_elapsed_s` is wall-clock elapsed, including pauses; `timer_elapsed_s` and `moving_elapsed_s` must remain null unless explicitly supplied and separately validated. Never relabel clock pace as moving pace.
- `quality_flags` allowed vocabulary for PoC: `partial_segment`, `sensor_missing`, `plateau_or_equal_time`, `nonmonotonic_samples`. Further additions require documented fixtures and audit.
- Do not assert field coverage merely because a numeric average exists; add measured coverage ratio before calling it complete.
- Invalid or out-of-order distance/time points are excluded and flagged, not quietly repaired.

## M2 — commit behavior
- `saved`: analysis may attach only to the newly committed canonical Garmin run with matching owner and latest consent.
- Same-Garmin `duplicate`: no new attachment unless an audited optional backfill policy is approved.
- Cross-provider `duplicate`, `ignored`, soft-deleted or revoked: do not attach. Preserve existing duplicate logic.
- Candidate analysis must not outlive a failed or uncommitted run. Atomicity and unique constraints are mandatory before writes.

## M3 — lifecycle
- Default policy: Garmin sensor analysis is deleted or made inaccessible when its run is deleted, Garmin connection is disconnected, or export permission is revoked. Retention beyond any of those events is not supported in v1.
- The precise delete paths and server-side cleanup are unverified; implementation blocked pending source and integration tests.

## M4 — concrete access control requirement
- Private owner-only read policy: `TO authenticated USING ((SELECT auth.uid()) = user_id)` on an RLS-enabled `public.run_race_analysis` table.
- `anon` and browser `authenticated` get **no INSERT/UPDATE/DELETE privileges**; only validated server-side writes, with source Garmin identity, consent, run owner and nondeleted status checked in DB.
- Make `run_id` foreign-keyed, unique per (user_id,run_id,analysis_version), and enforce same owner with composite FK or trigger; plain standalone FK is insufficient.
- Audit fixtures must prove account A cannot SELECT account B's analysis. If user account or consent is revoked, listing must not leak data.
- Exclude the analysis table from public ranking, B-1 anonymous regional aggregation and every public endpoint. No API keys or raw sensor payload in logs.

## M5 — indoor runs
- v1 **exclude indoor/treadmill runs from kilometer-split analysis** by default, while retaining the current GPS-less run import behavior unchanged.
- UI must say `屋内ランは現在、詳細レース分析の対象外です`; do not display a misleading zero or missing data fault.
- Future indoor support requires a separate, audited distance-basis specification. No GPS coordinates are invented.

## M6 — ingestion size and reliability
- Local TCX is NOT a representative Garmin Push JSON fixture. Need a **synthetic Garmin activityDetails fixture** >=12,561 samples, using documented field names, with measured serialized bytes, peak memory, processing time, 8 MB request guard and retry semantics.
- The incoming response must retain current rapid HTTP 200 ACK and no per-second storage. Worker processing optional, import success independent of analysis failure.
- Fix data-retention limits and max input sizes only after measurements. Never assume 9.85kB summary means small incoming push.

## M7 — field provenance and units
- Persist metadata `source_kind=garmin_activity_details`, `source_field`, `raw_unit`, `aggregation_method`, and actual coverage for every displayed metric.
- For `stepsPerMinute`, preserve original unit and value. Do not multiply by two, reinterpret cadence, or mix TCX RunCadence with Garmin stepsPerMinute without a verified conversion rule.
- Heart rate = bpm; power = W when explicitly supplied; missing values = null; sensor measurements are not medically diagnostic.

## M8 — exact user-facing promises
- `計測距離（Garmin）: XX.XX km`
- `大会公式距離: 42.195 km（別の基準です）` only when official number is entered or independently sourced.
- `ペースは計測データの経過時間に基づく推定です。停止時間を含む場合があります。`
- `当時の詳細データが保存されていないため、この記録は分析できません。`
- `屋内ランは現在、詳細レース分析の対象外です。`
- `センサーの記録が不足している区間は数値を表示しません。`
- Never promise re-fetch of historical activity or definitive explanation for fatigue.

## Audit boundary
These are decisions to be reviewed, not evidence of production enforcement. Must verify full original M1–M8 and auditor's C1–C8 report, PoC tests, and real flow before approving implementation.
