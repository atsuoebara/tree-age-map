# PR #92 — source sample continuity diagnostic v0.1 (2026-11-12)

**DRAFT / synthetic fixtures only / no real-data connection / no quality certification.**

## Motivation and evidence
- Draft PR #67 `supabase/functions/_shared/garmin_race_segments.ts` discards identical-distance or identical-time adjacent samples with `plateau_or_equal_time` and increments excluded count. Its clean `Summary` has no continuity evidence; PR #91 correctly rejects it.
- PR #91's `race-continuity-proof-v0-synthetic` is not real provenance, and the provisional 5-point, 250m, 120s thresholds are not validated. This PR deliberately **does not create a passing `elapsed_continuity_evidence`** and does not modify PR #91.

## New stand-alone diagnostic
`src/race-source-continuity-diagnostic.cjs` consumes mock source point shapes consistent with PR #67 (`startTimeInSeconds`, `totalDistanceInMeters`). Its output describes raw neighboring intervals and per-km diagnostic statistics from device cumulative distance. Time is clock elapsed (stops included). No moving pace, rounding into artificial exact km times, Garmin permission, or medical/training prescription.

- Reject nonfinite/negative input, decreasing distance, equal/decreasing time, record length outside 2..20,000.
- Preserve **time advancing while distance is constant** as `distance_plateau_candidate` event; report duration by adjacent km segment instead of dropping as duplicate. This is **not proof of a traffic-light stop**; it can be GPS freeze, measurement quantization or recorder-specific behavior.
- Distinguish **time not advancing** (invalid source) from a plateau with time advancing. Report large gaps in increasing-distance pairs (>250m, >120s) separately.
- List per-segment sample counts, largest raw moving-pair distance/time gap, stationary candidate duration, gaps and partial tail. All metrics and thresholds are diagnostic only.
- Every segment `elapsedQualityOk:false`, `certification:NOT_CERTIFIED`. The proof version is `race-source-evidence-v0-diagnostic` and does **not** match PR #91 accepted `race-continuity-proof-v0-synthetic`; attaching this output to PR #91 must fail closed. Source fields provided by a caller are **not trusted provenance**.

## Cautions / open decisions for independent audit
1. Distances that stay flat do not establish intentional stopping; non-monotonic or equal-time points are rejected rather than repaired. Need separate policy for timer pauses, autopauses, duplicates and GPS freezing.
2. A long leap may cross multiple 1km boundaries. Each crossed segment is marked with the **full observed raw gap**, not deceptively clipped by boundary interpolation.
3. Plateau at exactly a km boundary is assigned to the following segment (a deterministic convention, not a ground-truth segment assignment).
4. The `samplesInSegment` count currently uses unique advancing-distance sample points within the segment and may undercount interpolated boundary support. This is diagnostic only, not a basis for quality approval.
5. A >120s plateau with 1-second intervals is different from a single unobserved 120s interval; neither alone can prove reliable split timing. The 10% median heuristic could still reverse if boundary interpolation is poor.
6. **Important PR #67 implementation issue observed during read-only review:** the fetched Draft source appears to declare `let excluded=0` twice in `summarizeRace`, which would be a compile error if present in its actual head. This PR does not edit #67; the separate #67 owner/auditor should verify this before treating it as deployable.
7. This research tool is not imported by `index.html`, `sw.js`, PR #67, #68, #69, the PR #90 bridge, or the PR #91 gate. No data transmission, browser storage, database writes or new dependencies.

## Release gates unchanged
- PR #68 DB Stage A HOLD. PR #67 and #69 Draft. No real Garmin/FIT/TCX data processed here.
- Before production mapping, design verifiable server-side provenance and per-segment source-boundary evidence; test against explicitly consented real owner records in an isolated workflow, review whether 250m/120s/5-point limits should be changed, and agree mixed-quality policy.
- Physical iPhone preview verification is separate. Any merge requires new explicit user approval after independent Muse audit.
