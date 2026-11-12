/**
 * C4 candidate ONLY: verify the internal linkage of one authorized Garmin run.
 * Isolated pure function, not a trust boundary or authentication implementation.
 * The SERVER must load all records from authenticated, owner-scoped DB queries.
 * Never construct "trusted" records from client JSON. No live imports/calls.
 */
import { previewSingleRaceRun, type Intent, type Result } from "./garmin_race_single_run.ts";

export type AuthenticatedContext = {
  userId: string; // from validated server session
  requestedAt: string; // server clock; never device time
  maxAgeSeconds: number; // server config (owner's current decision: 8 * 86400)
  activatedAt: string; // server config
};
export type OwnedRun = {
  id: string;
  user_id: string;
  source: string;
  source_external_id: string;
  started_at: string;
  ingested_at: string;
  deleted_at: string | null;
};
export type TrustedGarminPayload = {
  // Provenance verified by the server at receipt/connection transaction.
  user_id: string;
  run_id: string;
  source_external_id: string;
  started_at: string;
  connection_version: string;
  active_connection_version: string;
  samples: unknown;
};
export type UserChoice = {
  selectedRunId: string;
  intent: Intent;
  confirmed: boolean;
};
export type C4Result =
  | { ok: false; reason: "unauthorized" | "run_mismatch" | "source_mismatch" | "stale_connection" | "payload_mismatch" }
  | Result;

// Parse RFC3339 only after checking its civil date is real. Do not trust Date.parse
// normalization of dates such as February 30 or locale-specific timestamp strings.
function strictInstant(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = /^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2}):(\\d{2})(?:\\.(\\d+))?(Z|([+-])(\\d{2}):(\\d{2}))$/.exec(value);
  if (!m) return null;
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number);
  const tzHour = m[10] ? Number(m[10]) : 0;
  const tzMinute = m[11] ? Number(m[11]) : 0;
  if (year < 100 || month < 1 || month > 12 || day < 1 || day > 31 ||
      hour > 23 || minute > 59 || second > 59 || tzHour > 23 || tzMinute > 59) return null;
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month ||
      date.getUTCDate() !== day || date.getUTCHours() !== hour ||
      date.getUTCMinutes() !== minute || date.getUTCSeconds() !== second) return null;
  const ms = m[7] ? Number("0." + m[7]) * 1000 : 0;
  return date.getTime() + ms - (m[9] === "-" ? -1 : 1) * (tzHour * 60 + tzMinute) * 60000;
}

/**
 * Does not prove caller identity or packet origin: consumers must first verify
 * session, run ownership, Garmin receipt authenticity and database RLS.
 */
export function previewOwnedGarminRace(
  auth: AuthenticatedContext, run: OwnedRun, payload: TrustedGarminPayload,
  choice: UserChoice,
): C4Result {
  if (!auth || !run || !payload || !choice ||
      typeof auth.userId !== "string" || !auth.userId.trim() ||
      run.user_id !== auth.userId || payload.user_id !== auth.userId ||
      run.deleted_at !== null) return {ok:false, reason:"unauthorized"};
  if (!choice.selectedRunId || choice.selectedRunId !== run.id ||
      payload.run_id !== run.id) return {ok:false, reason:"run_mismatch"};
  if (run.source !== "garmin" || typeof run.source_external_id !== "string" ||
      !run.source_external_id.startsWith("garmin-api:") ||
      run.source_external_id.length <= "garmin-api:".length ||
      payload.source_external_id !== run.source_external_id)
    return {ok:false, reason:"source_mismatch"};
  if (typeof payload.connection_version !== "string" || !payload.connection_version.trim() ||
      typeof payload.active_connection_version !== "string" || !payload.active_connection_version.trim() ||
      payload.connection_version !== payload.active_connection_version)
    return {ok:false, reason:"stale_connection"};
  const runStart = strictInstant(run.started_at);
  const payloadStart = strictInstant(payload.started_at);
  if (runStart === null || payloadStart === null || runStart !== payloadStart)
    return {ok:false, reason:"payload_mismatch"};
  return previewSingleRaceRun({
    runId: run.id,
    confirmed: choice.confirmed,
    intent: choice.intent,
    activityStartedAt: run.started_at,
    ingestedAt: run.ingested_at,
    requestedAt: auth.requestedAt,
    activatedAt: auth.activatedAt,
    maxAgeSeconds: auth.maxAgeSeconds,
    detail: {samples: payload.samples},
  });
}
