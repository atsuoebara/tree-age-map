// ISOLATED / REVIEW ONLY. Never silently link a saved calendar run to a FIT file.
// No raw FIT, location, GPS, user identifiers, timestamps, network or persistence in outputs.
const deny = reason => ({status:'blocked',reason,linkVerified:false,analysisAllowed:false,writeAllowed:false});
export function reviewFitLinkForSelectedRun({
  calendarEligibility,fitReview,
  userConfirmedSameActivity=false,selectedRunId,
}={}) {
  if(calendarEligibility?.status!=='eligible_window_only' ||
     calendarEligibility.eligible!==true ||
     calendarEligibility.analysisAllowed!==false)return deny('calendar_window_not_eligible');
  if(typeof selectedRunId!=='string'||!/^[1-9]\d*$/.test(selectedRunId) ||
     calendarEligibility.runId!==selectedRunId)return deny('selection_changed_or_invalid');
  if(fitReview?.status!=='candidate_unverified' ||
     fitReview.qualityCertified!==false ||
     fitReview.analysisAllowed!==false ||
     fitReview.writeAllowed!==false)return deny('fit_candidate_not_safe');
  if(!userConfirmedSameActivity)
    return {status:'requires_same_activity_confirmation',reason:'calendar_row_and_fit_not_proven_same_run',
      linkVerified:false,analysisAllowed:false,writeAllowed:false};
  // Human confirmation permits only LOCAL PREVIEW; it does NOT establish identity
  // cryptographically or certify quality. No cross-source matching or persistence.
  return {status:'local_preview_only',reason:'user_confirmed_same_activity_unverified',
    linkVerified:false,analysisAllowed:false,writeAllowed:false,
    cautionJa:'信号待ちやトイレ休憩、自動ポーズなどの影響により、正しく分析できない場合があります。',
    cautionEn:'Traffic lights, restroom breaks, and auto-pause may affect the accuracy of this analysis.'};
}
