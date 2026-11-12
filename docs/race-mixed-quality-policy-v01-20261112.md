# Mixed-quality race split policy comparison v0.1 — Draft, synthetic only (2026-11-12)

## Context
PR #90's elapsed split-to-training bridge is synthetic only. PR #91's gate refuses current real-shaped summaries lacking a trusted per-segment continuity proof. PR #92 identifies distance plateau candidates and raw GPS/time gaps without certifying quality. **This PR compares policy implications only; no policy is selected.**

## Candidate approaches (not approvals)
| Candidate | Illustrated behavior | Important limitation |
| --- | --- | --- |
| Whole-activity rejection | No recommendation if any interval is uncertain. Even all simulated-clean runs remain unapproved until provenance exists. | Can suppress most real runs with routine traffic stops. |
| Show all laps with warning | Retain full elapsed times, label potentially uncertain segments, but make **no training recommendation**. | Must avoid implying segment accuracy; future owner-only UI approval required. |
| Drop suspicious km, compare medians | **Prohibited in this prototype.** | Breaks first-half versus second-half meaning and can select away unfavorable miles. |
| Contiguous high-confidence window | Display consecutive simulated-clean blocks as diagnostic counts only; **not approved for training analysis**. | Has a different estimand from complete-activity #86; needs explicit new validation, confidence, thresholds and user approval. |

## Critical boundaries
- The input field `simulatedObservation` is a **human-authored fictional fixture label**, never quality certification. Allowed labels: `simulated_clean`, `plateau_ambiguous`, `gps_gap`, `clock_gap`, `unknown`.
- A 1km lap has exact `distanceKm:1`; at most one partial (<1km) is allowed at the end. All observed elapsed times are clock-based (stops included). No inference of moving pace, diagnosis, GPS-freeze versus voluntary stopping, or official race splits.
- Model output always says `trainingEligible:false`, `recommendationsAllowed:false`, `sourceQualityCertified:false`. No real data may enter. At most 251 fictional intervals. Unknown labels/malformed data fail closed.
- A clean simulated label may make the *illustrative* clean-block tally higher, but **never** changes eligibility or certifies reliable source timing.
- This module does not call #86 or #91 in production; tests use those established modules only to confirm their safety gates remain closed.

## Open decisions needing owner approval after later validation
1. When a normal traffic stop is observed, should Runner’s Rings display elapsed results with a visible uncertainty label while withholding advice? Do not claim actual stopping without GPS/timer proof.
2. Should recommendation always fail closed when even one full km is questionable? The current #86 contract says yes; a new method requires an explicitly independent analysis design and test.
3. Review distances and elapsed accuracy thresholds on explicitly approved Garmin real-run fixtures, including #67 plateau handling, timer pauses/autopause, GPS freeze, duplicate/invalid samples, and per-segment provenance. Thresholds 250m/120s/5 points are still unvalidated.
4. Decide a nonmisleading communication strategy for partial laps and sensor missingness, independent from elapsed clock quality.

## Containment
Only new offline CommonJS helper, tests, doc and CI workflow. No index.html, sw.js, Supabase, Garmin APIs, login, storage, billing, network, HTML preview, or production imports. PR #67 and #69 stay Draft; PR #68 stays HOLD. This PR is Draft, not merged, and an independent Muse audit is mandatory before any Atsuo merge decision.
