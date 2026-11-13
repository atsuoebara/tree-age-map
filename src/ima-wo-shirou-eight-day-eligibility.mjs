// ISOLATED / REVIEW ONLY. No production imports, network, storage or database writes.
// Caller must explicitly provide maxAgeSeconds=691200 and the rollout boundary.
// Timestamp inputs are UTC Unix epoch milliseconds, not calendar activity_date.
export const EIGHT_DAYS_SECONDS = 691200;
const validEpoch = value => Number.isSafeInteger(value) && value >= 0;
const deny = reason => ({eligible:false,reason,analysisAllowed:false});
export function assessImaWoShirouEligibility({
  selectedAsGachiRun = false,
  startedAtMs,
  nowMs,
  featureStartedAtMs,
  maxAgeSeconds,
} = {}) {
  if (maxAgeSeconds !== EIGHT_DAYS_SECONDS) return deny('explicit_eight_day_policy_required');
  if (!selectedAsGachiRun) return deny('user_selection_required');
  if (![startedAtMs,nowMs,featureStartedAtMs].every(validEpoch)) return deny('timestamp_missing_or_invalid');
  if (startedAtMs < featureStartedAtMs) return deny('pre_feature_activity_not_eligible');
  if (nowMs < startedAtMs) return deny('future_activity_not_eligible');
  const ageMs = nowMs - startedAtMs;
  // Millisecond comparison preserves the exact inclusive 691,200s boundary.
  if (ageMs > maxAgeSeconds * 1000) return deny('eight_day_window_expired');
  return {eligible:true,reason:'within_eight_day_window',analysisAllowed:false,
    // False until independently certified real-data quality and production wiring.
    windowSeconds:maxAgeSeconds};
}
