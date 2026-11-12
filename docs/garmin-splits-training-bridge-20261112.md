# PR #90 — PR #69 split preview × PR #86 training integration (2026-11-12)

**DRAFT ONLY. No main merge, no GitHub Pages preview, no production UI connection.**

PR #69 is still Draft/HOLD. Its original example is 3 complete 1km splits plus a 0.42km partial segment (3.42km total); PR #86 requires 6 quality-checked complete 1km splits. Passing the original sample to #86 must yield insufficient_data with no recommendations. Separate synthetic 7.42km examples show positive recommendations without misrepresenting the original 3.42km run.

## Implementation
- `src/race-training-split-preview-adapter.cjs`: pure adapter; strict MM:SS/HH:MM:SS; each full split needs explicit `elapsedQualityOk:true`, exactly 1km. A partial distance is allowed only last and ignored by #86. Malformed input fails closed. HR sensor coverage must not determine elapsed quality.
- `previews/garmin-splits-training-bridge-synthetic-20261112.html`: copied isolated PR #69 split-card layout with the original 3.42km sample; embeds audited #86 function and this adapter; four fixture choices (3.42 insufficient, 7.42 even, 7.42 slower later, 7.42 faster later). Computes displayed total distance and elapsed time directly from displayed splits; renders suggestions from actual function output. Bilingual disclaimer and 44px Japanese/EN controls.
- Original PR #69 untouched. All main files including index.html/sw.js/#86/#87/#88/#89 untouched.

## Safety gates
- Extra Garmin intervals and sensor measurements are fabricated fixtures only. No real Garmin / FIT / TCX, login, API, Supabase, RLS, network, persistent storage, database, fees or actual user data.
- `elapsedQualityOk` is explicitly supplied by synthetic fixtures; mapping from real quality flags needs separate design and approval. Do not use sensor-value coverage to infer elapsed-time validity.
- Elapsed time includes stops; not moving pace or official race splits. 10% threshold is an unvalidated heuristic, and descriptions must not diagnose causes or prescribe personal training.
- PR #68 Stage A remains HOLD pending private restore rehearsal, security re-probes and Atsuo approval; PR #69 still Draft. Physical iPhone Safari test still pending.
- Merging this page would expose a Pages URL. New explicit Atsuo merge approval is mandatory following independent review.

## Muse audit
Verify original 3.42km numbers and 0.42km tail, elapsed totals and all four training branches, bad inputs fail closed, HR missing vs elapsed quality separated, UI language/selected scenario/44px, no horizontal overflow, and exact embedded logic/adapter, no #68/#69/main changes.
