// Review-only evidence gate. No actual network, FIT processing, or production connection.
// Assertions are synthetic declarations, not verified real-world evidence.
const REQUIREMENTS=Object.freeze([
 'endpointDocumented','requestMetadataReviewed','ipAndAccessLogsReviewed',
 'retentionReviewed','cookiesAndReferrerReviewed','tlsAndCacheReviewed',
 'freeTierReviewed','hardCostCapVerified','abuseAndRateLimitReviewed',
 'offlineFailClosedReviewed','oldTabLimitDocumented','iphoneSafariVerified'
]);
export const A_EVIDENCE_REQUIREMENTS=REQUIREMENTS;
export function reviewADeploymentEvidence(evidence={}){
 if(evidence===null||typeof evidence!=='object'||Array.isArray(evidence))throw new TypeError('evidence object required');
 const missing=REQUIREMENTS.filter(k=>evidence[k]!==true);
 const unexpected=Object.keys(evidence).filter(k=>!REQUIREMENTS.includes(k));
 return Object.freeze({
  status:missing.length||unexpected.length?'blocked':'requires_independent_external_verification',
  missing:Object.freeze(missing),unexpected:Object.freeze(unexpected),
  selfReportedOnly:true,privacyVerified:false,costZeroVerified:false,
  networkVerified:false,oldTabsGuaranteedStopped:false,
  realFitAllowed:false,productionAllowed:false,optionAAdopted:false
 });
}
