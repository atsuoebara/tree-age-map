// Isolated options review: never contacts a provider, requests FIT, or authorizes production.
// Free-plan marketing is not proof of project-level zero incremental cost.
export const CANDIDATES=Object.freeze({
 GITHUB_PAGES_STATIC:Object.freeze({type:'static',dynamicRevocation:false,remoteExecution:false}),
 CLOUDFLARE_WORKERS_FREE:Object.freeze({type:'edge',dynamicRevocation:true,remoteExecution:true}),
 SUPABASE_EDGE_EXISTING:Object.freeze({type:'edge',dynamicRevocation:true,remoteExecution:true})
});
const EVIDENCE_FIELDS=Object.freeze(['actualPlanVerified','hardZeroOverageVerified','privacyAndLogsVerified','cacheAndAuthenticityVerified','oldTabLimitationAcknowledged','iphoneSafariVerified']);
export function evaluateSyntheticHosting(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('review input must be object');
 const {candidate}=input;
 const unknown=Object.keys(input).filter(k=>k!=='candidate'&&k!=='workersOverageFailClosedVerified'&&!EVIDENCE_FIELDS.includes(k));
 const evidence=EVIDENCE_FIELDS.filter(k=>input[k]!==true);
 const workerFailClosed=candidate!=='CLOUDFLARE_WORKERS_FREE'||input.workersOverageFailClosedVerified===true;
 const c=CANDIDATES[candidate];
 if(!c)throw new TypeError('unknown hosting candidate');
 const gaps=[...evidence.map(k=>'unverified_'+k),...unknown.map(k=>'unexpected_'+k)];
 if(!workerFailClosed)gaps.push('workers_overage_fail_closed_unverified');
 if(candidate!=='CLOUDFLARE_WORKERS_FREE'&&Object.hasOwn(input,'workersOverageFailClosedVerified'))gaps.push('unexpected_workers_setting');
 if(!c.dynamicRevocation)gaps.push('static_pages_cannot_guarantee_fresh_revocation');
 return Object.freeze({candidate,classification:c.type,reviewStatus:gaps.length?'blocked':'requires_independent_external_verification',
  gaps:Object.freeze(gaps),selfAttestationOnly:true,verifiedZeroIncrementalCost:false,
  privacyVerified:false,oldTabsGuaranteedStopped:false,optionAAdopted:false,
  realFitAllowed:false,productionAllowed:false});
}
