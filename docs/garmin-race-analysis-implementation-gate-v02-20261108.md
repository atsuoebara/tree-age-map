# Garmin Race Analysis — implementation gate v0.2 (2026-11-08)
Status: DESIGN REVIEW ONLY; no production changes.

## Verified production baseline
- `garmin-activity-push` accepts `activityDetails` notifications.
- `sanitized()` retains only location samples, and removes heart rate, cadence, power, time and distance series before `garmin_receive_details` saves its inbox payload.
- `garmin_commit_activity` is the authoritative permission, duplicate and soft-delete gate and writes to `runs`; completed inbox payload is emptied.
- Do not alter those invariants until an independent audit approves a precise implementation diff.

## Required implementation behavior
1. New optional analysis cannot block the GPS/year-ring importer. On any parser failure, importer behaves identically to the current version.
2. Generate a proposed 1 km summary from device cumulative distance, interpolating boundary time between adjacent valid samples. Use recording clock elapsed and label it as such; do not call it moving pace. Last partial segment is labelled and carries its true distance.
3. Missing heart rate/cadence/power remains `null`, never zero-filled. Sensor averages must define coverage and sample weighting and reject invalid monotonicity; no diagnosis or definitive fatigue causes.
4. No analysis persistence before authoritative commitment. `saved` may attach to the committed run. `duplicate` from another provider is NOT auto-attached. `ignored`, deleted, revoked and stale-connection results persist no analysis.
5. Protect with unique `(user_id, run_id, analysis_version)`, foreign key and owner-equality check; read restricted to authenticated owner. No direct browser inserts.
6. Deleting a run, disconnecting Garmin, or losing Garmin export permission must hide and purge its sensor-derived analysis per defined retention policy; no resurrection on replay.
7. No raw FIT, TCX or per-second sensor samples are retained. Avoid logging raw payloads or sensitive tokens.
8. Response to Garmin Push remains promptly HTTP 200 and costly parsing is deferred. Measure actual JSON body size, worker duration, memory peak and retry behavior on a simulated 12,561+ point marathon before enabling ingestion.

## Existing PoC evidence (local, NOT deployed)
- User supplied TCX: 12,561 points; device distance 42,397.15m; elapsed 12,518s.
- Prototype 1km result: 43 segments, last 397.15m, JSON 9,849 bytes versus 9,364,925-byte TCX.
- Seven local test cases passed (distance boundaries, partial, conservation, missing sensors, repeated/backwards distance and insufficient samples).
- These are NOT real Garmin Push load measurements. Device 42.397km must not be force-matched to the certified 42.195km course.

## Blocking review questions
- M1: settle timer/clock/moving semantics, interpolation invariants and quality flag vocabulary/thresholds.
- M2: duplicate/save atomicity and schema tests.
- M3: deletion/disconnect/revocation policy and actual current app flows.
- M6: measure Push JSON size, peak memory and worker execution.
- M4, M5, M7, M8: **not verified**; resolve from auditor's full v0.1 report rather than guessing.

## Acceptance gates
- Independent audit: sign off all M1-M8 against full report.
- Unit/golden tests for 1km, partial, missing, pauses, duplicate and invalid data.
- Integration tests: saved, same-Garmin repeat, cross-source collision, soft-delete, disconnect, revoked consent, concurrent workers.
- Security: owner-only select, no client writes, no orphaned sensor data.
- Production parity: GPS routing and previous year-ring behavior unchanged.
- No merge, rollout or Garmin portal login without separate explicit approval.
