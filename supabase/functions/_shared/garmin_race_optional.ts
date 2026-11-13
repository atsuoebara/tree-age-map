/**
 * Optional, isolated Garmin activityDetails sensor preview.
 * NOT imported by the production receiver. Never determines import acceptance.
 * Input already passed the receiver's strict 8,000,000-byte raw HTTP guard.
 */
export type PreviewSample = {
  startTimeInSeconds: number;
  totalDistanceInMeters: number;
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
 * Nonthrowing optional transformation. A bad sensor value is null.
 * Missing/non-finite timestamp or cumulative distance makes the optional
 * preview unavailable, but MUST NOT affect the original GPS-only importer.
 * Nonmonotonic samples are *not* silently fixed here: split algorithm
 * will flag/discard them at a separately audited stage.
 */
export function previewGarminSensors(
  detail: unknown, maxSamples = MAX_PREVIEW_SAMPLES,
  maxBytes = MAX_PREVIEW_BYTES,
): PreviewResult {
  try {
    if (!detail || typeof detail !== "object" || Array.isArray(detail)) return { ok: false, reason: "invalid" };
    const samples = (detail as Record<string, unknown>).samples;
    if (!Array.isArray(samples) || samples.length < 2) return { ok: false, reason: "invalid" };
    if (!Number.isSafeInteger(maxSamples) || maxSamples < 2 ||
        !Number.isSafeInteger(maxBytes) || maxBytes < 1) return { ok: false, reason: "invalid" };
    if (samples.length > maxSamples) return { ok: false, reason: "too_many_samples" };
    const out: PreviewSample[] = [];
    for (const sample of samples) {
      if (!sample || typeof sample !== "object" || Array.isArray(sample)) return { ok: false, reason: "invalid" };
      const point = sample as Record<string, unknown>;
      const time = finite(point.startTimeInSeconds);
      const distance = finite(point.totalDistanceInMeters);
      if (time === null || distance === null || distance < 0) return { ok: false, reason: "invalid" };
      out.push({
        startTimeInSeconds: time,
        totalDistanceInMeters: distance,
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
