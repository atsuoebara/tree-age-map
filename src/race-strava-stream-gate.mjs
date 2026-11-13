// Review-only synthetic Strava stream shape gate.
// Never used by production, no API access, no split calculations or data storage.
// IMPORTANT: API Policy (2026) §5.4 restricts analytics and combining Strava Data.
// Technical availability DOES NOT imply permission to run 1km analysis.
const types=['time','distance','heartrate','cadence','watts'];
const isNumber=x=>typeof x==='number'&&Number.isFinite(x);
export function checkStravaStreamShape({streams,scope=[],visibility='everyone',ownerVerified=false,explicitConsent=false,policyApproval=false}={}){
 const no=(reason,extra={})=>({status:'blocked',reason,analysisAllowed:false,fetchAllowed:false,storageAllowed:false, ...extra});
 if(!ownerVerified||!explicitConsent)return no('owner_or_consent_missing');
 const required=visibility==='only_me'?'activity:read_all':'activity:read';
 if(!Array.isArray(scope)||!scope.includes(required))return no('required_scope_missing',{requiredScope:required});
 if(!streams||typeof streams!=='object'||Array.isArray(streams))return no('malformed_streams');
 const invalid=types.filter(k=>streams[k]!=null&&(!Array.isArray(streams[k].data)||streams[k].data.length>100000||
   !streams[k].data.every(isNumber)));
 if(invalid.length)return no('invalid_stream_data',{invalid});
 const time=streams.time?.data, distance=streams.distance?.data;
 const lengths=types.filter(k=>streams[k]?.data).map(k=>[k,streams[k].data.length]);
 const missing=types.filter(k=>!streams[k]?.data);
 if(!time||!distance||time.length<2||distance.length<2)return no('distance_time_missing',{missing});
 if(time.length!==distance.length||lengths.some(([,length])=>length!==time.length))
   return no('sample_lengths_mismatch',{lengths});
 if(time.some((v,i)=>i&&v<=time[i-1])||distance.some((v,i)=>i&&v<distance[i-1]))
   return no('non_monotonic_distance_or_time');
 const available=types.filter(k=>streams[k]?.data);
 const unavailable=types.filter(k=>!streams[k]?.data);
 // Even fully usable synthetic streams have no product authorization. The
 // compliance gate is intentionally NOT activated by policyApproval=true:
 // explicit provider permission/contract review requires another implementation.
 return {status:'shape_only',reason:policyApproval?'provider_policy_review_still_required':'api_policy_analytics_prohibited_until_review',
   technicalFields:available,missingFields:unavailable,sampleCount:time.length,requiredScope:required,
   analysisAllowed:false,fetchAllowed:false,storageAllowed:false};
}
