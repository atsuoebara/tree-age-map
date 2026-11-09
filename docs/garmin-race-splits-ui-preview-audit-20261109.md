# Garmin 1 km split UI — isolated mobile-first preview (2026-11-09)

**Status: DRAFT / synthetic preview only.** This is a standalone HTML file under `previews/`; it is not imported by `index.html`, not linked from the public site, and not wired to any live database, auth, Garmin API, Edge Function, storage, or real run records. No existing functionality changes.

## Scope
- File `previews/garmin-race-splits-20261109.html` has responsive cards fitting narrow iPhone screens (stacked 1km splits, three sensor values, final 420 m partial segment).
- Japanese and English toggle and expandable explanation; text based on PR #67 copy audit (plus two approved hand-offs).
- Shows **Garmin device cumulative distance** and clock elapsed time (includes stops, not official race splits); cadence is the unchanged Garmin-provided steps/min (e.g. 88, not 176).
- For coverage under 80%, sensor average shows **データ不足（計測範囲：XX%）** in visual combination of missing label and explicit percentage. HR at 75%, cadence at 62%, power at 43% demonstrate missing values. Power 0 W with 100% coverage deliberately remains 0 (valid input, not missing).
- Japanese quality message now includes repeated timestamps **or repeated distances**, aligning with the approved English meaning.
- All figures are **synthetic**, and the display is not a prediction that current accounts have Garmin sensor data.

## Next integration gates (not authorized by this draft)
- Independent Muse audit of UI copy and ergonomics, especially small iPhone and English switching.
- After real Stage A backup/restore evidence, a separately authorized Stage A application and live owner-only role probes; separate Stage B receiver and RPC gates.
- Only after approved live data access, integrate UI into the existing language system and real-run record view with null/quality flag handling. Keep owner-only read, opt-in, and graceful absence of analysis.

## No production change
No main merge, build increment, deployment, schema apply, Garmin permission request or activation. Stage A PR #68 remains Draft/HOLD due to real backup rehearsal and explicit approval requirements.
