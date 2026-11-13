// DRAFT REVIEW ONLY. Separate, synthetic FIT timer-event clock diagnostic.
// It never calculates moving time or removes stopped intervals from elapsed
// time. FIT event timestamps are evidence of ordering, not timer accuracy.
// No production imports, API calls, data persistence, or Strava measurements.
const validDate=v=>v instanceof Date&&Number.isFinite(v.getTime());
const STOP_TYPES=new Set(['stop','stopAll','stopDisable','stopDisableAll']);
const START_TYPES=new Set(['start']);
const deny=(reason,flags=[])=>({status:'blocked',reason,flags,qualityCertified:false,movingTimeCalculated:false,analysisAllowed:false,writeAllowed:false,providerDataCombined:false});
export function inspectFitTimerEvents(messages,{userConfirmedFile=false,privateView=false,confirmRunning=false,sourceProvenance='user_uploaded_fit'}={}){
 if(!userConfirmedFile||!privateView||!confirmRunning||sourceProvenance!=='user_uploaded_fit')return deny('owner_consent_or_provenance_missing');
 const session=messages?.sessionMesgs,records=messages?.recordMesgs,events=messages?.eventMesgs;
 if(!Array.isArray(session)||session.length!==1||session[0]?.sport!=='running'||!validDate(session[0]?.startTime))return deny('single_running_session_required');
 if(!Array.isArray(records)||records.length<2||!validDate(records[0]?.timestamp)||!validDate(records.at(-1)?.timestamp))return deny('record_clock_bounds_missing');
 const begin=session[0].startTime.getTime(),end=records.at(-1).timestamp.getTime();
 if(end<begin)return deny('clock_bounds_reversed');
 if(events==null||!Array.isArray(events)||events.length===0)
  return {status:'diagnostic_only',reason:'timer_events_absent_cannot_assume_continuous',flags:['no_timer_events'],clockElapsedSeconds:(end-begin)/1000,observedStopIntervals:[],unmatchedStopCount:0,qualityCertified:false,movingTimeCalculated:false,analysisAllowed:false,writeAllowed:false,providerDataCombined:false};
 if(events.length>100000)return deny('event_count_exceeded');
 const flags=new Set(),stops=[];
 let stoppedAt=null,prevEventTime=-Infinity,sawRelevant=false,unmatchedStopCount=0;
 for(const event of events){
  if(event?.event!=='timer')continue;
  sawRelevant=true;
  if(!validDate(event.timestamp))return deny('timer_event_timestamp_missing',[...flags]);
  const ms=event.timestamp.getTime(),kind=event.eventType;
  if(ms<begin||ms>end)return deny('timer_event_outside_record_bounds',[...flags]);
  if(ms<prevEventTime)return deny('timer_event_time_reversed',[...flags]);
  prevEventTime=ms;
  if(STOP_TYPES.has(kind)){
   if(stoppedAt!==null){flags.add('duplicate_stop_event');unmatchedStopCount++;continue;}
   stoppedAt=ms;
  }else if(START_TYPES.has(kind)){
   if(stoppedAt===null){flags.add('start_without_prior_stop');continue;}
   if(ms===stoppedAt){flags.add('zero_duration_stop_interval');}
   stops.push({startOffsetSeconds:(stoppedAt-begin)/1000,endOffsetSeconds:(ms-begin)/1000,durationSeconds:(ms-stoppedAt)/1000});
   stoppedAt=null;
  }else{
   flags.add('unknown_timer_event_type');
  }
 }
 if(stoppedAt!==null){flags.add('unmatched_stop_event');unmatchedStopCount++;}
 if(!sawRelevant)flags.add('no_timer_events');
 if(stops.length)flags.add('observed_timer_stop_resume');
 // Deliberately do NOT expose stoppedSeconds as a subtraction instruction:
 // clocks, device pause policy and gaps are unverified by these event hints.
 return {status:'diagnostic_only',reason:'event_timeline_not_moving_time',flags:[...flags],
  clockElapsedSeconds:(end-begin)/1000,observedStopIntervals:stops,
  unmatchedStopCount,qualityCertified:false,movingTimeCalculated:false,
  analysisAllowed:false,writeAllowed:false,providerDataCombined:false};
}
