# Race 1km elapsed-quality gate v0.1 — review candidate (2026-11-12)

**DESIGN + SYNTHETIC ISOLATED CODE ONLY. NOT connected to actual Garmin records or the production site.**

## Verified input/output contracts
- PR #67 Draft `garmin_race_segments.ts` returns `Summary` with `analysis_version=garmin-activity-details-v1`, `distance_basis=device_cumulative_m`, `time_basis=clock_elapsed_seconds`, `quality_flags` at summary/segment level and `excluded_samples`.
- Existing known global flags: `invalid_sample`, `nonmonotonic_samples`, `plateau_or_equal_time`. Existing segment flags: `sensor_missing` and `partial_segment`.
- The segment function interpolates elapsed time at distance boundaries and includes stops; its 80%-sensor-coverage policy applies to **sensor means only**, not to elapsed-time confidence. Garmin cadence is raw and power 0W is valid.
- PR #90 adapter uses `elapsedQualityOk` supplied explicitly by synthetic fixtures. PR #86 needs ≥6 valid full 1km intervals and rejects invalid full intervals; final <1km partial may be displayed but not included in suggestions.

## Safety rule
`elapsedQualityOk` must NEVER be derived from presence of a numeric `clock_elapsed_s` alone, sensor quality/coverage, or the absence of currently known flags. The PR #67 summary lacks per-segment sample-density / max interval evidence; **all current real-shape segments must remain ineligible** until separately approved source-based continuity proof exists.

### Candidate gate, implemented in `src/race-elapsed-quality-gate-review.cjs`
1. Require exact source version/distance/time basis and summary/segment flags arrays, segment membership, zero excluded samples and empty overall flags. All unknown flags also fail closed.
2. Each full interval must be exactly 1000m; only last interval may carry the partial flag and be <1000m. Clock elapsed must be finite and >0.
3. `sensor_missing` is allowed because it does not establish elapsed-time invalidity; all unknown per-segment flags block.
4. Require `elapsed_continuity_evidence` with explicit provenance `fromOriginalSamples:true`, isolated **synthetic-only** version `race-continuity-proof-v0-synthetic`, ≥5 original accepted points per 1km, maximum consecutive sample distance gap ≤250m and clock gap ≤120s. These are **provisional, conservative engineering thresholds; not validated against Garmin recordings**. A pause >120s can correctly lead to "insufficient quality", not forced advice. Passing them is not yet proof of validity in production.
5. If any full split is not quality-approved, leave it as `qualityOk:false` and let PR #86 reject the entire activity instead of selecting convenient splits. Missing metadata must fail closed.
6. The mapping preserves raw clock elapsed seconds (including stops), raw distance and missingness; no moving-pace or official-race label.

## Security / scope
This PR adds only a pure CommonJS helper, a synthetic test file, docs and a CI workflow. It does not touch PR #68 (HOLD), #69 (Draft), #67 (Draft), #86–#90 (main), `index.html`, `sw.js`, Supabase, Garmin receiver, API, RLS, auth, user data, or external services. No extra fee.

## Unresolved **hard gates** — no real data connection authorized
- Upstream PR #67 must separately emit deterministic **source-derived, per-segment continuity evidence**, with a reviewed proof of accurate interval boundaries, handling of monotonic exclusions, paused time and data gaps; cannot trust unvalidated server/client input to claim `fromOriginalSamples:true`.
- Independently review the candidate thresholds (especially 5 samples, 250m, 120s), float/rounding at 1000m boundaries and compatibility with real Garmin recording intervals; revise before live acceptance.
- Explicit design for **mixed-quality multi-km runs**: this candidate rejects whole recommendation if any 1km interval fails; do not silently filter and skew medians.
- Correct PR #67 receiver/aggregator build and run its isolated tests as its own gated change; no PR #67 merge implied by this design.
- Stage A PR #68 remains HOLD until backup, private restore rehearsal, role probes and Atsuo go/no-go. Stage C iPhone UI test and actual owner-only access remain outstanding.
- The next step after independent review is separate, no-network synthetic provenance generator / quality-mapping audit PR. Do not connect or deploy live data in this PR.

## Review request to Muse
Confirm the candidate genuinely fails closed on **current** PR #67 summaries without new evidence, does not manufacture positive quality from numeric elapsed time or sensors, accepts 0W and missing HR independently, checks unknown flags/version/partial location and zero global exclusions. Critically assess whether strict exact 1000m and temporary thresholds are too restrictive; the outcome may be conditional approval as a safety proposal, NOT approval to release real data.
