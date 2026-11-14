// Review-only synthetic contract. No network, FIT, browser integration or production activation.
// This module must never be imported by public pages.
const KEYS=Object.freeze(['protocol','build']);
const OWN=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
export function proposeAnonymousCheck(build){
 if(typeof build!=='string'||!/^v[0-9]{1,4}$/.test(build))throw new TypeError('synthetic build required');
 return Object.freeze({protocol:'rings-now-review-v1',build});
}
export function inspectSyntheticRequest(request){
 const reasons=[];
 if(!request||typeof request!=='object'||Array.isArray(request))reasons.push('invalid_request');
 else {
  const keys=Object.keys(request);
  if(keys.length!==KEYS.length||keys.some(k=>!KEYS.includes(k)))reasons.push('unexpected_request_fields');
  if(request.protocol!=='rings-now-review-v1')reasons.push('protocol_mismatch');
  if(typeof request.build!=='string'||!/^v[0-9]{1,4}$/.test(request.build))reasons.push('invalid_build');
 }
 // No content here can prevent IP, headers or access logs at a real endpoint.
 return Object.freeze({contractValid:reasons.length===0,reasons:Object.freeze(reasons),
  privacyVerified:false,transportVerified:false,costVerified:false,realFitAllowed:false,productionAllowed:false});
}
export function reviewSyntheticSignal({request,response,signalVerified=false,networkAvailable=false,offline=false}={}){
 const inspection=inspectSyntheticRequest(request);
 const reasons=[...inspection.reasons];
 if(offline||!networkAvailable)reasons.push('network_unavailable');
 if(!signalVerified)reasons.push('signal_not_verified');
 if(!response||typeof response!=='object'||Array.isArray(response))reasons.push('invalid_response');
 else {
  if(Object.keys(response).sort().join(',')!=='build,enabled,protocol')reasons.push('unexpected_response_fields');
  if(response.protocol!=='rings-now-review-v1')reasons.push('response_protocol_mismatch');
  if(response.enabled!==true)reasons.push('disabled_or_unknown');
  if(response.build!==request?.build)reasons.push('build_mismatch');
 }
 return Object.freeze({reviewStatus:reasons.length?'blocked':'requires_manual_review',
  reasons:Object.freeze(reasons),verifiedSafe:false,oldTabGuaranteedStopped:false,
  realFitAllowed:false,productionAllowed:false,adopted:false});
}
