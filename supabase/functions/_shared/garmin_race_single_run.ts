/**
 * "今を知ろう": single-run, opt-in eligibility for isolated pre-release analysis.
 * No DB reads/writes, authentication, inferred race detection or history lookup.
 * Callers MUST verify run ownership and source provenance separately.
 * This module is NOT connected to the production Garmin receiver or website.
 */
import { previewGarminSensors } from "./garmin_race_optional.ts";
import { summarizeRace, type Summary } from "./garmin_race_segments.ts";

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
  | { ok: false; reason: "not_selected" | "not_race_effort" | "invalid_date" | "pre_activation" | "missing_samples" | "unreliable_samples" | "unverified_continuity" | "invalid_laps" }
  | { ok: true; runId: string; provisional: true; basis: "one_run_clock_elapsed"; summary: Summary };

// Conservative PR #91 proposal; these thresholds are not validated on real race data.
const MAX_DISTANCE_GAP_M = 250;
const MAX_TIME_GAP_S = 120;

function parseStrictInstant(value: string): number | null {
  if (typeof value !== "string") return null;
  const m = /^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2}):(\\d{2})(?:\\.(\\d+))?(Z|([+-])(\\d{2}):(\\d{2}))$/.exec(value);
  if (!m) return null;
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number);
  const offsetHour = m[10] ? Number(m[10]) : 0;
  const offsetMinute = m[11] ? Number(m[11]) : 0;
  if (year < 100 || month < 1 || month > 12 || day < 1 || day > 31 ||
      hour > 23 || minute > 59 || second > 59 || offsetHour > 23 || offsetMinute > 59) return null;
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month ||
      date.getUTCDate() !== day || date.getUTCHours() !== hour ||
      date.getUTCMinutes() !== minute || date.getUTCSeconds() !== second) return null;
  const fraction = m[7] ? Number("0." + m[7]) * 1000 : 0;
  const sign = m[9] === "-" ? -1 : 1;
  return date.getTime() + fraction - sign * (offsetHour * 60 + offsetMinute) * 60_000;
}

export function previewSingleRaceRun(request: Request): Result {
  if (!request || typeof request.runId !== "string" || !request.runId.trim() ||
      request.confirmed !== true) return { ok: false, reason: "not_selected" };
  if (!["race", "time_trial", "record_attempt"].includes(request.intent))
    return { ok: false, reason: "not_race_effort" };
  const activity = parseStrictInstant(request.activityStartedAt);
  const activation = parseStrictInstant(request.activatedAt);
  if (activity === null || activation === null)
    return { ok: false, reason: "invalid_date" };
  if (activity < activation) return { ok: false, reason: "pre_activation" };
  const extraction = previewGarminSensors(request.detail);
  if (!extraction.ok) return { ok: false, reason: "missing_samples" };
  for (let i = 1; i < extraction.samples.length; i++) {
    const prev = extraction.samples[i - 1], next = extraction.samples[i];
    if (next.totalDistanceInMeters - prev.totalDistanceInMeters > MAX_DISTANCE_GAP_M ||
        next.startTimeInSeconds - prev.startTimeInSeconds > MAX_TIME_GAP_S)
      return { ok: false, reason: "unverified_continuity" };
  }
  const laps = summarizeRace(extraction.samples);
  if (!laps.ok || laps.summary.segments.length < 1) return { ok: false, reason: "invalid_laps" };
  // Do not certify laps derived by silently dropping suspect samples.
  if (laps.summary.quality_flags.length || laps.summary.excluded_samples > 0)
    return { ok: false, reason: "unreliable_samples" };
  return { ok: true, runId: request.runId, provisional: true,
    basis: "one_run_clock_elapsed", summary: laps.summary };
}
