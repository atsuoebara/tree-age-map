/**
 * "今を知ろう": single-run, opt-in eligibility for isolated pre-release analysis.
 * No DB reads/writes, authentication, inferred race detection or history lookup.
 * Callers MUST verify run ownership and source provenance separately.
 * This module is NOT connected to the production Garmin receiver or website.
 */
import { previewGarminSensors } from "./garmin_race_optional.ts";
import { summarizeRace } from "./garmin_race_segments.ts";

export type Intent = "race" | "time_trial" | "record_attempt" | "jog" | "recovery" | "other";
export type Request = {
  runId: string;
  // User explicitly chooses this run and affirms it was a continuous effort.
  confirmed: boolean;
  intent: Intent;
  activityStartedAt: string;
  // Release activation instant, supplied by trusted application configuration.
  activatedAt: string;
  // Authenticated owner checks are outside this pure module.
  detail: unknown;
};
export type Result =
  | { ok: false; reason: "not_selected" | "not_race_effort" | "invalid_date" | "pre_activation" | "missing_samples" | "unreliable_samples" | "invalid_laps" }
  | { ok: true; runId: string; provisional: true; basis: "one_run_clock_elapsed"; summary: NonNullable<ReturnType<typeof summarizeRace> extends infer T ? T extends {ok:true;summary:infer S} ? S : never : never> };

export function previewSingleRaceRun(request: Request): Result {
  if (!request || typeof request.runId !== "string" || !request.runId.trim() ||
      !request.confirmed) return { ok: false, reason: "not_selected" };
  if (!["race", "time_trial", "record_attempt"].includes(request.intent))
    return { ok: false, reason: "not_race_effort" };
  // Strict RFC3339 offset/Z instants, not ambiguous local dates.
  const iso = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/;
  if (!iso.test(request.activityStartedAt) || !iso.test(request.activatedAt))
    return { ok: false, reason: "invalid_date" };
  const activity = Date.parse(request.activityStartedAt);
  const activation = Date.parse(request.activatedAt);
  if (!Number.isFinite(activity) || !Number.isFinite(activation))
    return { ok: false, reason: "invalid_date" };
  if (activity < activation) return { ok: false, reason: "pre_activation" };
  const extraction = previewGarminSensors(request.detail);
  if (!extraction.ok) return { ok: false, reason: "missing_samples" };
  const laps = summarizeRace(extraction.samples);
  if (!laps.ok || laps.summary.segments.length < 1) return { ok: false, reason: "invalid_laps" };
  // Do not certify laps derived by silently dropping suspect samples.
  if (laps.summary.quality_flags.length || laps.summary.excluded_samples > 0)
    return { ok: false, reason: "unreliable_samples" };
  return { ok: true, runId: request.runId, provisional: true,
    basis: "one_run_clock_elapsed", summary: laps.summary };
}
