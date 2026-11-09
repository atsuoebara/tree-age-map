/**
 * Garmin race analysis optional sensor preview, NOT connected to production.
 * Never use this function to decide whether an activity may be imported.
 *
 * This module is intentionally side-effect free: no network, DB, logs or tokens.
 * R1: operates only after an entire HTTP request has passed the existing 8MB guard.
 * R2: malformed optional data becomes null; mandatory importer remains unchanged.
 */
export type PreviewSample = {
  startTimeInSeconds: number | null;
  totalDistanceInMeters: number | null;
  heartRate: number | null;
  stepsPerMinute: number | null;
  powerInWatts: number | null;
};
export type PreviewResult =
  | { ok: true; source: "garmin_activity_details"; samples: PreviewSample[]; bytes: number }
  | { ok: false; reason: "invalid" | "too_many_samples" | "too_many_bytes" };
export const MAX_PREVIEW_SAMPLES = 20000;
export const MAX_PREVIEW_BYTES = 5_000_000;
const finite = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/**
 * Bounded, no-throw sensor extraction. Call only inside optional analysis path.
 * Rejects invalid required time/distance sample shapes rather than treating
 * them as zeros; null sensor values remain null.
 */
export function previewGarminSensors(
  detail: unknown, maxSamples = MAX_PREVIEW_SAMPLES,
  maxBytes = MAX_PREVIEW_BYTES,
): PreviewResult {
  try {
    if (!detail || typeof detail !== "object" || Array.isArray(detail)) return { ok: false, reason: "invalid" };
    const samples = (detail as Record<string, unknown>).samples;
    if (!Array.isArray(samples)) return { ok: false, reason: "invalid" };
    if (samples.length < 2) return { ok: false, reason: "invalid" };
    if (samples.length > maxSamples) return { ok: false, reason: "too_many_samples" };
    const out: PreviewSample[] = [];
    for (const sample of samples) {
      if (!sample || typeof sample !== "object" || Array.isArray(sample)) {
        return { ok: false, reason: "invalid" };
      }
      const point = sample as Record<string, unknown>;
      out.push({
        startTimeInSeconds: finite(point.startTimeInSeconds),
        totalDistanceInMeters: finite(point.totalDistanceInMeters),
        heartRate: finite(point.heartRate),
        stepsPerMinute: finite(point.stepsPerMinute),
        powerInWatts: finite(point.powerInWatts),
      });
    }
    const bytes = new TextEncoder().encode(JSON.stringify(out)).byteLength;
    if (bytes > maxBytes) return { ok: false, reason: "too_many_bytes" };
    return { ok: true, source: "garmin_activity_details", samples: out, bytes };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}
