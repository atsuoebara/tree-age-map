// REVIEW-ONLY: compare FIT session totals against actual decoded record endpoints.
// Never repair a source file, infer missing points, emit certified splits, or write data.
// No GPS, external provider or server access.
const deny=(reason,flags=[])=>({status:'blocked',reason,flags,qualityCertified:false,analysisAllowed:false,writeAllowed:false,providerDataCombined:false});
const validDate=v=>v instanceof Date&&Number.isFinite(v.getTime());
export function reviewFitSessionRecordTotals(messages,{userConfirmedFile=false,privateView=false,confirmRunning=false,sourceProvenance='user_uploaded_fit'}={}){
 if(!userConfirmedFile||!privateView||!confirmRunning||sourceProvenance!=='user_uploaded_fit')return deny('owner_consent_or_provenance_missing');
 const sessions=messages?.sessionMesgs,records=messages?.recordMesgs;
 if(!Array.isArray(sessions)||sessions.length!==1||sessions[0]?.sport!=='running')return deny('single_running_session_required');
 if(!Array.isArray(records)||records.length<2||records.length>200000)return deny('record_count_invalid');
 const session=sessions[0],first=records[0],last=records.at(-1);
 if(!validDate(session.startTime)||!validDate(first.timestamp)||!validDate(last.timestamp))return deny('clock_bounds_missing');
 if(typeof first.distance!=='number'||!Number.isFinite(first.distance)||typeof last.distance!=='number'||!Number.isFinite(last.distance))return deny('record_distance_missing');
 if(first.distance<0||last.distance<first.distance)return deny('record_distance_bounds_invalid');
 if(last.timestamp.getTime()<first.timestamp.getTime()||first.timestamp.getTime()<session.startTime.getTime())return deny('clock_order_invalid');
 const flags=[];
 const total=session.totalDistance;
 const recordDistanceM=last.distance-first.distance;
 const clockElapsedSeconds=(last.timestamp.getTime()-session.startTime.getTime())/1000;
 if(first.distance!==0)flags.push('record_distance_origin_nonzero');
 if(first.timestamp.getTime()!==session.startTime.getTime())flags.push('first_record_delayed');
 if(total==null){flags.push('session_total_distance_missing');}
 else if(typeof total!=='number'||!Number.isFinite(total)||total<0)return deny('session_total_distance_invalid');
 else if(Math.abs(total-last.distance)>Math.max(20,total*.005))flags.push('session_vs_last_record_distance_mismatch');
 // End time can be absent in FIT; do not infer it or replace the record clock.
 const sessionEnd=session.timestamp;
 if(sessionEnd!=null){
  if(!validDate(sessionEnd))return deny('session_end_clock_invalid',flags);
  const delta=(last.timestamp.getTime()-sessionEnd.getTime())/1000;
  if(delta>0)flags.push('record_after_session_end');
  if(delta< -120)flags.push('last_record_far_before_session_end');
 }
 return {status:'diagnostic_only',reason:'session_record_consistency_not_quality_certification',flags,
  recordDistanceM,sessionTotalDistanceM:total??null,clockElapsedSeconds,
  qualityCertified:false,analysisAllowed:false,writeAllowed:false,providerDataCombined:false};
}
