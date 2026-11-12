# PR #94 — Uncertified split warning preview (2026-11-12)

**DRAFT / SYNTHETIC DATA ONLY / NOT A POLICY DECISION / NOT AN APPROVED TRAINING ANALYSIS.**

## Purpose
Demonstrate what a small-screen runner-facing view might look like if the user can see full 1km elapsed times and an explicit uncertainty notice, without silently dropping questionable splits. No quality certificate or practice suggestion is produced.

## Scope
- New standalone page `previews/race-mixed-quality-warning-synthetic-20261112.html`; no source import, API, network, storage, app navigation, auth, Garmin, FIT/TCX, Supabase, pricing or user information.
- Four synthetic scenarios: 8km mixed concerns, 8km distance plateau candidate, 8km nominally clean, and 8km + 0.42km tail. All displayed split times are fabricated.
- Clear badge **DRAFT · SYNTHETIC**, noindex, description saying clock elapsed includes stops (not moving pace or official race splits); the standalone "No training suggestions" message is always present.
- Normal-looking splits also read **uncertified**, even if there are no highlighted observations. Plateau is explicitly cause-unknown, **not** labelled as a definite traffic-light stop.
- No `elapsedQualityOk`, `qualityOk`, proof, source quality flag, or #86 advice engine in the page. Scenario labels cannot lead to real quality certification; PR #93 policyDecision remains undecided.
- Bilingual Japanese/English two-button switch with 44px controls, `aria-pressed` and document language alignment; switching language retains selected scenario, scenario switch retains language. Max content width 620px, narrow screens stack cards. Physical iPhone testing remains separate.

## Risks and design gates
- **Viewing an uncertain time can still mislead.** The introduction, banner, lap labels and footer warn that these are unverified reference values. Whether this display strategy is desirable is unresolved; it is not adopted by PR #94.
- Source PR #67, Stage A PR #68 (HOLD), and standalone split mock PR #69 all remain Draft. No new feature in `index.html` or `sw.js`. Merging this preview in the future would expose its URL via GitHub Pages even if not linked; **new explicit owner authorization** is mandatory.
- The visual classification is fictional and is not sourced from PR #92 diagnostic results; no conclusion about stops, auto-pause, GPS freeze, or sensor coverage.
- A real mapping would require trusted provenance, observed-vs-unobserved time policies, validated thresholds and user choice; all remain hard gates.

## Muse audit requests
Check CSS responsiveness and 44px control sizes, no external I/O, language+scenario interactions, all-four-fixture counts and 0.42km tail display, unavoidable uncertainty labels and no recommendations even on nominally clean, no production refs, and fail-safe separation from PR #86/#91/#92/#93. No merge / deploy / DB modifications without Atsuo approval.

## PR #95 follow-up to Muse observations (synthetic only)
- The summary now explicitly states that the warning count is **among complete 1 km splits**; the final 0.42 km partial lap is excluded from both the full-km denominator and the warning count, **but remains visible and explicitly marked `品質不明` / `Uncertain quality`**. This is a denominator clarification, not quality certification or removal of data.
- The `aria-label` for the split-list section now changes with the Japanese/English language toggle while retaining the selected fictional scenario. The `lang` attribute and `aria-pressed` state remain synchronized.
- Automated UI regression assertions verify both language labels, explanatory denominator text, and the tail's warning label. All source data and times remain fictional. No official mixed-quality policy is selected, no training suggestions, data connections, app routing or extra costs.
