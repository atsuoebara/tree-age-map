# PR #69 — UI display density refinement, independent re-audit request (2026-11-09)

**DRAFT ONLY; no production UI, Garmin receiver, Supabase, deployment or main merge.**

Following Muse's original PASS on the isolated mockup, this incremental change addresses two review observations and adds a built-in-only behavioral test.

## Changes
1. **Coverage is shown only when the sensor average is missing**. Below the established 80% threshold, display the bilingual insufficient-data label plus coverage number, e.g. `データ不足 / 計測範囲: 75%` or `Insufficient data / Coverage: 75%`. For healthy sensor readings, hide 98%/100% to reduce visual noise; it still uses the same 80% threshold, not a changed calculation.
2. **Cadence is explicitly labeled Garmin-sourced**, `ピッチ（Garmin値）` / `Cadence (Garmin)`; value (88) remains raw, not doubled. Full copy including the original unit/meaning remains in the expanded explanatory section.
3. Provide tighter wrapping of labels for narrow phone width, no changes to section structure.
4. Add `tests/garmin-race-ui-preview.test.cjs` and `.github/workflows/garmin-race-ui-preview.yml`. Node built-in `vm` + tiny fake DOM runs actual inline preview logic; asserts Japanese/English language toggle, the missing-only percentage behavior, 75/62/43% missing readings, positive 98% coverage hidden, raw 88 cadence, 0 W valid, 0.42km partial section and no network/storage calls.

## Verification
- CI #42576336925 failed on a false positive: explanatory JS comment contained literal `fetch()`; no call existed.
- Comment changed to avoid the false positive. No runtime behavior affected.
- **CI #42576389823 PASS**, isolated DOM render checks.
- No physical iPhone width test has been performed; this still belongs to Stage C with Atsuo.

## Muse review target
Confirm both bilingual labels remain semantically faithful to approved PR #67 text, that dropping visible healthy coverage % is an acceptable **display-only** choice, that null and zero remain distinct, that 0.42km isn't scaled to a full km, and that the test cannot accidentally contact or modify production.

**Stage A PR #68 remains HOLD pending real backup/recovery rehearsal, operator plan and specific go/no-go.**
