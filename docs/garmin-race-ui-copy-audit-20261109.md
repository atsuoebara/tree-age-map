# Garmin optional analysis — Japanese/English UI wording gate (2026-11-09)

**Review-only. PR #67 remains Draft, and this copy is NOT connected to a screen.** No production UI, receiver, RPC, database, deployment, or consent settings changed.

## Source of truth and review target

Paired copy: `docs/garmin-race-analysis-ui-copy.ja-en.json` (20 independently named JA/EN message keys). CI contract: `supabase/functions/_shared/garmin_race_ui_copy_test.ts`.

The draft explains:
- Segments use Garmin-provided **cumulative device distance**, not official race course distance. **Elapsed clock time includes stops** and is not moving pace.
- HR is expressed in bpm, power in W; Garmin-provided cadence is kept in **steps/min as provided**, without multiplying by two or asserting external sensor equivalence. Averaging is distance weighted; zero cadence and zero power are valid sensor values, but zero heart rate is missing.
- Means are displayed only when valid sensor values cover **at least 80%** of segment distance. Below that, `null` is shown as **Insufficient data / データ不足**, not zero, interpolated values, or fabricated readings. Some invalid/nonmonotonic/repeated samples are excluded; a partial tail section is labeled.
- Additional analysis is **optional** and must never change the result of saving a base run. The wording does **not** imply optional analysis is currently available in production.
- Analysis is **private to its owner**, is deleted when the run is deleted, and is purged on Garmin local disconnect, disabled intake, or authoritative loss of required permission. **Saved runs remain on Garmin disconnect**. Loss of permission is worded as **confirmed** to avoid suggesting a webhook hint immediately revokes verified state.
- Not an official race result or guaranteed sensor measurement.

## Integration boundaries (future)
This is proposed wording, not a display implementation. Before turning on:
1. Audit final English/Japanese meaning and any confusing wording with Muse.
2. Bind keys into the existing i18n mechanism on a separate reviewed implementation change, preserving the actual method of switching languages. Avoid introducing an unsolicited public UI or any optional data fetch in existing run views.
3. Handle `null` and quality flags safely; show 1km rows with a shorter final distance and stop-inclusive time. Keep the source distinction explicit.
4. During staged rollout: approved migration and actual Supabase role probes, owner-only access test, opt-in/permission check and edge ACK/CPU observation before turning on Garmin activityDetails reception.

**Caveat:** Existing Garmin receive/permissions flow is not modified. UI copy approval does not authorize a merge/deploy.
