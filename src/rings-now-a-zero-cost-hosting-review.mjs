// Isolated options review: never contacts a provider, requests FIT, or authorizes production.
// Free-plan marketing is not proof of project-level zero incremental cost.
export const CANDIDATES=Object.freeze({
 GITHUB_PAGES_STATIC:Object.freeze({type:'static',dynamicRevocation:false,remoteExecution:false}),
 CLOUDFLARE_WORKERS_FREE:Object.freeze({type:'edge',dynamicRevocation:true,remoteExecution:true}),
 SUPABASE_EDGE_EXISTING:Object.freeze({type:'edge',dynamicRevocation:true,remoteExecution:true})
});
export function evaluateSyntheticHosting({candidate,actualPlanVerified=false,hardZeroOverageVerified=false,privacyAndLogsVerified=false,cacheAndAuthenticityVerified=false,oldTabLimitationAcknowledged=false,iphoneSafariVerified=false}={}){
 const c=CANDIDATES[candidate];
 if(!c)throw new TypeError('unknown hosting candidate');
 const gaps=[];
 if(!c.dynamicRevocation)gaps.push('static_pages_cannot_guarantee_fresh_revocation');
 if(!actualPlanVerified)gaps.push('actual_plan_unverified');
 if(!hardZeroOverageVerified)gaps.push('hard_zero_overage_unverified');
 if(!privacyAndLogsVerified)gaps.push('request_metadata_and_logs_unverified');
 if(!cacheAndAuthenticityVerified)gaps.push('freshness_and_authenticity_unverified');
 if(!oldTabLimitationAcknowledged)gaps.push('old_tab_limitation_unacknowledged');
 if(!iphoneSafariVerified)gaps.push('iphone_safari_unverified');
 return Object.freeze({candidate,classification:c.type,reviewStatus:gaps.length?'blocked':'requires_independent_external_verification',
  gaps:Object.freeze(gaps),selfAttestationOnly:true,verifiedZeroIncrementalCost:false,
  privacyVerified:false,oldTabsGuaranteedStopped:false,optionAAdopted:false,
  realFitAllowed:false,productionAllowed:false});
}
