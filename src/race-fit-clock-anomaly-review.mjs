// ISOLATED / REVIEW ONLY. Inspection of decoded FIT SDK message shapes.
// No time inference, no synthetic timestamps, no production imports, no writes.
// A pause event is a signal to withhold quality approval, NOT proof of cause.
import {normalizeDecodedFitForOfflineProbe} from './race-fit-sdk-isolated-adapter.mjs';
const validDate=v=>v instanceof Date&&Number.isFinite(v.getTime());
const blocked=(reason,flags=[])=>({status:'blocked',reason,flags,qualityCertified:false,analysisAllowed:false,writeAllowed:false,providerDataCombined:false});
export function reviewFitClockAnomalies(messages,options={}){
 if(!options.userConfirmedFile||!options.privateView||!options.confirmRunning||options.sourceProvenance!=='user_uploaded_fit')
   return blocked('owner_consent_or_provenance_missing');
 const sessions=messages?.sessionMesgs, records=messages?.recordMesgs;
 if(!Array.isArray(sessions)||sessions.length!==1||sessions[0]?.sport!=='running')return blocked('single_running_session_required');
 if(!Array.isArray(records)||records.length<2||records.length>200000)return blocked('record_count_invalid');
 const flags=new Set();
 const start=sessions[0].startTime;
 if(!validDate(start))return blocked('session_start_missing');
 const first=records[0]?.timestamp;
 if(!validDate(first))return blocked('first_timestamp_missing');
 const initialDelayS=(first.getTime()-start.getTime())/1000;
 if(initialDelayS<0)return blocked('record_precedes_session');
 if(initialDelayS>0)flags.add('first_record_delayed_clock_unknown');
 let prevTime=null,prevDistance=null;
 for(const r of records){
  if(!validDate(r?.timestamp))return blocked('record_timestamp_missing',[...flags]);
  const ms=r.timestamp.getTime();
  if(prevTime!==null){
   if(ms<=prevTime)return blocked('timestamp_not_strictly_increasing',[...flags]);
   if((ms-prevTime)>120000)flags.add('long_record_clock_gap');
  }
  if(typeof r.distance!=='number'||!Number.isFinite(r.distance)||r.distance<0)return blocked('distance_invalid',[...flags]);
  if(prevDistance!==null){
   if(r.distance<prevDistance)return blocked('distance_reversal',[...flags]);
   if(r.distance===prevDistance)flags.add('distance_plateau_cause_unknown');
  }
  prevTime=ms;prevDistance=r.distance;
 }
 if(records[0].distance!==0)flags.add('first_distance_nonzero_origin_unknown');
 const events=messages.eventMesgs;
 if(events!=null){
  if(!Array.isArray(events))return blocked('event_messages_invalid',[...flags]);
  if(events.some(e=>e?.event==='timer'&&['stop','stopAll','stopDisable','stopDisableAll','start'].includes(e.eventType)))
    flags.add('timer_event_present_verify_pause');
 }
 // Guarded by the existing strict adapter: never promote incomplete data by
 // rebasing time to first sample, interpolating initial distance, or dropping gaps.
 const candidate=normalizeDecodedFitForOfflineProbe(messages,options);
 return {status:'diagnostic_only',strictProbeStatus:candidate.status,
  strictProbeReason:candidate.reason??null,flags:[...flags],
  firstRecordDelayS:initialDelayS,qualityCertified:false,analysisAllowed:false,
  writeAllowed:false,providerDataCombined:false};
}
