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
      payload.source_external_id !== run.source_external_id)
    return {ok:false, reason:"source_mismatch"};
  if (!payload.connection_version || !payload.active_connection_version ||
      payload.connection_version !== payload.active_connection_version)
    return {ok:false, reason:"stale_connection"};
  if (!payload.started_at || payload.started_at !== run.started_at)
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
