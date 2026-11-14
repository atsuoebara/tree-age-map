// Synthetic comparison only. No real FIT, browser network, or production integration.
// Neither a positive local evaluation nor a simulated signal authorizes processing.
export const MODES = Object.freeze(['A_NETWORK','B_OFFLINE','C_NO_REAL_FIT_PUBLICATION']);
export function compareRetirementOption({mode,loadedBuild='v1',remoteBuild='v1',signal='missing',withdrawn=false,ageMs=0,ttlMs=60000,clockReliable=true,lifecycleRevoked=false}={}){
 if(!MODES.includes(mode)) throw new TypeError('unknown mode');
 if(!Number.isFinite(ageMs)||!Number.isFinite(ttlMs)||ttlMs<=0)throw new TypeError('invalid synthetic duration');
 const reasons=[];
 if(lifecycleRevoked)reasons.push('lifecycle_revoked');
 if(mode==='A_NETWORK'){
  if(signal!=='verified')reasons.push('fresh_signal_unavailable');
  else if(withdrawn)reasons.push('withdrawn');
  else if(remoteBuild!==loadedBuild)reasons.push('build_mismatch');
 }
 if(mode==='B_OFFLINE'){
  if(!clockReliable||ageMs<0)reasons.push('clock_unreliable');
  if(ageMs>=ttlMs)reasons.push('local_ttl_expired');
  // A valid TTL cannot establish that the public deployment has not been withdrawn.
  reasons.push('remote_withdrawal_unknown');
 }
 if(mode==='C_NO_REAL_FIT_PUBLICATION')reasons.push('real_fit_publication_not_available');
 return Object.freeze({
  mode,status:reasons.length?'blocked':'requires_manual_review',
  reasons:Object.freeze(reasons),
  verifiedSafe:false,realFitAllowed:false,productionAllowed:false,
  oldTabGuaranteedStopped:false,chosen:false
 });
}
export function compareAllOptions(scenario={}){
 return Object.freeze(MODES.map(mode=>compareRetirementOption({...scenario,mode})));
}
