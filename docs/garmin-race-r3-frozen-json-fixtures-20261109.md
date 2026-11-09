# R3 — Frozen Garmin 1km segment JSON fixtures, 2026-11-09

**PR #67 Draft, review-only, not deployed.** No production Garmin Push receiver, database, main branch or user data changed.

## Fixed expected snapshots
Three human-constructed, synthetic expected output JSON snapshots are checked into
`supabase/functions/_shared/fixtures/garmin-race/`:

- `small-missing-partial.json`: 2.25km input, segment clocks 300/420/100 seconds, missing heart-rate coverage in the last two segments, null mean, 250m partial with raw cadence and power preserved (including zero at end).
- `marathon-42195.json`: **42.195km exactly**, independent sparse two-point interpolated model, 43 segment objects = 42 x 1000m plus 195m, 300 seconds/km and 58.5 seconds tail. Constant HR=148 bpm, cadence=88 steps/min as supplied, power=290W.
- `plateau-stop.json`: one full km, 420 seconds including the stop, one repeated-distance point excluded, global `plateau_or_equal_time` flag.

`garmin_race_r3_fixtures_test.ts` invokes the real isolated `previewGarminSensors` **and** `summarizeRace` and compares complete output JSON (key order, numerical values, coverage, units, flags, nulls and segment list) with these committed immutable expected snapshots. The test never autogenerates/rebaselines expected JSON from the module being tested.

## CI evidence
GitHub Actions https://github.com/atsuoebara/tree-age-map/actions/runs/42568331840

Initial job failed **before tests** due to Deno release download HTTP 504. Failed job rerun succeeded:
- `R3_GOLDEN_PASS small-missing-partial segments=3`
- `R3_GOLDEN_PASS marathon-42195 segments=43`
- `R3_GOLDEN_PASS plateau-stop segments=1`
- **31 passed, 0 failed**, including pre-existing unit/batch/load suite.

## Limits / gate for independent audit
All are synthetic fixed inputs; real Garmin activityDetails samples (with user consent) are not yet pinned. Sparse interpolation means 300 s/km of the marathon snapshot is **illustrative**, not a measured race pacing curve. Snapshot only ensures the parser/segment algorithm stays consistent for specified cases; it does not assert endpoint integration or fitness accuracy. Reviewers should check expected numbers are independent and consistent with documented units and rounding, not trust green CI as the only evidence.

R3 candidate complete subject to Muse audit. English display/text remains a separate gate. No merge/apply/deploy authorized.
