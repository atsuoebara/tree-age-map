// ISOLATED, REVIEW-ONLY architecture decision gate. Not a browser sandbox,
// authentication, security certification or permission to read real FIT.
// Do NOT import this from production HTML.
export const FIT_HTTPS_DELIVERY_REQUIREMENTS=Object.freeze([
 'sourceGraphReviewed',
 'allDependenciesPinnedAndReviewed',
 'zeroRealFitUploadPath',
 'noBinaryOrMetadataEgress',
 'noPersistentFitStorage',
 'cspAndNavigationReviewed',
 'httpCacheAndServiceWorkerReviewed',
 'iosSafariLifecycleTested',
 'explicitOwnerCalendarSelection',
 'eightDayAndRolloutBoundaryReviewed',
 'realFitAndSelectedRunIdentityPolicy',
 'incidentRollbackAndOldTabPlan',
 'independentAuditPassed',
 'ownerExplicitDeliveryConsent'
]);
const BLOCKED=Object.freeze(['public_real_fit_html_now','automatic_fit_run_matching','prod_on','unsafe_unknown']);
export function assessRingsNowHttpsDeliveryEvidence({
 candidate='A_PUBLIC_HTTPS_LOCAL_ANALYSIS',
 evidence={},
 forbiddenActions=[],
}={}){
 const failures=[];
 if(candidate!=='A_PUBLIC_HTTPS_LOCAL_ANALYSIS')failures.push('candidate_not_selected');
 if(!evidence||typeof evidence!=='object'||Array.isArray(evidence))failures.push('invalid_evidence');
 const missing=FIT_HTTPS_DELIVERY_REQUIREMENTS.filter(key=>evidence?.[key]!==true);
 for(const key of missing)failures.push('evidence_missing:'+key);
 if(!Array.isArray(forbiddenActions))failures.push('invalid_forbidden_actions');
 else for(const action of forbiddenActions)
  if(BLOCKED.includes(action))failures.push('forbidden_action:'+action);
 // No fully automatic authorization: even when all booleans are true, the
 // caller MUST obtain and separately document actual human authorization.
 return {
  status:failures.length?'blocked':'requires_explicit_final_authorization',
  failures,
  mayPublishRealFitPage:false,
  mayReadRealFit:false,
  mayEnableProduction:false,
  method:'manual_evidence_and_independent_review_only'
 };
}
