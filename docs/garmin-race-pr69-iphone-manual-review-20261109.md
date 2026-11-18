# PR #69 Stage C — iPhone manual inspection handoff (2026-11-09)

**Status: NOT YET VERIFIED ON A PHYSICAL IPHONE.** This is an isolated GitHub Draft PR preview, not a production/public site. Do not merge or deploy solely to make this page available.

## Scope
- Source: `previews/garmin-race-splits-20261109.html` in Draft PR #69 (single offline HTML file).
- No external scripts, network calls, Garmin data, Supabase login, storage, or changes to `index.html`.
- Source can be downloaded as a local HTML file using GitHub's **Raw / Download raw file** controls, then opened with a local HTML-capable browser/viewer. iOS Files Quick Look may show the HTML source or suppress scripts; **that is a viewer limitation, not proof of app failure**. Avoid uploading the private preview to a third-party HTML rendering/hosting site or enabling GitHub Pages solely for this test.
- If iPhone cannot execute the offline HTML locally, mark this checkpoint **BLOCKED**, not PASS. A separately approved safe preview route can be planned later.

## On-device acceptance checklist
1. iPhone portrait: no horizontal page scroll or clipped summary, buttons, sensor cards, or explanatory content. Test smallest available portrait width and large text accessibility setting if possible.
2. Portrait and landscape: 3 full split cards plus final `端数区間 · 0.42 km` show without implying 0.42 km is 1 km; elapsed `03:08`.
3. Distances `3.42 km`, elapsed `18:25` align with splits `04:48+05:20+05:09+03:08`.
4. 3 km HR missing shows `データ不足` and `計測範囲: 75%`; tail cadence `62%`, power `43%`. Valid cadence/power values with 92–100% coverage do **not** display a coverage percentage.
5. Power 0 W in the 3 km segment displays as a real zero, not missing. Raw Garmin cadence value 88 stays 88, label `平均ピッチ（Garmin値）`.
6. Tap English / 日本語; headings, privacy caveats, method explanations, missing readings and partial section all switch and switch back. Expanded `測定値について` uses the correct language.
7. Check that the word `平均ピッチ（Garmin値）` wraps acceptably on the smallest screen and doesn't cover a value.
8. Verify preview disclaimer **架空データ**; do not mistake fake data for an actual imported Garmin activity.

## Automated checks
- CI #42577822996 PASS after improving the preview source label symmetry and extending fake-DOM tests to include static explanation/quality/privacy/summary/footer JA↔EN switches.
- CI cannot prove physical device appearance, Safari file-open permissions, or integration with real Garmin data.

## Unchanged release gates
Stage A PR #68 remains HOLD until actual secure production backup, private restore rehearsal, execution ownership/window and fresh Atsuo go/no-go. Stage B/Stage C live data integration must be separately reviewed and authorized. No production DB writes, merge, deploy or Garmin receiver activation.
