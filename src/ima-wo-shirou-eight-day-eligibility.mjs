// ISOLATED / REVIEW ONLY. No production imports, network, storage or database writes.
// Caller must explicitly provide maxAgeSeconds=691200 and the rollout boundary.
// Clock and rollout are integer epoch ms; optional exact start is epoch microseconds.
// No calendar activity_date or import timestamp may substitute for run start.
export const EIGHT_DAYS_SECONDS = 691200;
const validEpoch = value => Number.isSafeInteger(value) && value >= 0;
const deny = reason => ({eligible:false,reason,analysisAllowed:false});
export function assessImaWoShirouEligibility({
  selectedAsGachiRun = false,
  startedAtMs,
  startedAtMicros,
  nowMs,
  featureStartedAtMs,
  maxAgeSeconds,
} = {}) {
  if (maxAgeSeconds !== EIGHT_DAYS_SECONDS) return deny('explicit_eight_day_policy_required');
  if (!selectedAsGachiRun) return deny('user_selection_required');
  if (![startedAtMs,nowMs,featureStartedAtMs].every(validEpoch)) return deny('timestamp_missing_or_invalid');
  // If a six-digit timestamp was supplied, compare the original start in
  // microseconds. The caller's clock/rollout remain integer milliseconds.
  // This never promotes a partial millisecond into a whole millisecond.
  if (startedAtMicros !== undefined) {
    if (typeof startedAtMicros !== 'bigint' || startedAtMicros < 0n ||
        startedAtMicros / 1000n !== BigInt(startedAtMs))
      return deny('timestamp_missing_or_invalid');
    const rolloutMicros = BigInt(featureStartedAtMs) * 1000n;
    const nowMicros = BigInt(nowMs) * 1000n;
    if (startedAtMicros < rolloutMicros) return deny('pre_feature_activity_not_eligible');
    if (nowMicros < startedAtMicros) return deny('future_activity_not_eligible');
    if (nowMicros - startedAtMicros > BigInt(maxAgeSeconds) * 1000000n)
      return deny('eight_day_window_expired');
  } else {
    // Preserve the pre-existing milliseconds-only behavior for legacy callers.
    if (startedAtMs < featureStartedAtMs) return deny('pre_feature_activity_not_eligible');
    if (nowMs < startedAtMs) return deny('future_activity_not_eligible');
    if (nowMs - startedAtMs > maxAgeSeconds * 1000)
      return deny('eight_day_window_expired');
  }
  return {eligible:true,reason:'within_eight_day_window',analysisAllowed:false,
    // False until independently certified real-data quality and production wiring.
    windowSeconds:maxAgeSeconds};
}
