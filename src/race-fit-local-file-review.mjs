// ISOLATED BROWSER-LOCAL REVIEW ONLY. User-picked FIT bytes never leave this function.
// Decodes once, reuses existing strict 1km probe + independent FIT diagnostics.
// No fetch, storage, DB, Garmin OAuth, Strava or production import.
import {Decoder,Stream} from '../fit-sdk/src/index.js';
import {normalizeDecodedFitForOfflineProbe} from './race-fit-sdk-isolated-adapter.mjs';
import {reviewFitSessionRecordTotals} from './race-fit-session-total-review.mjs';
import {reviewFitClockAnomalies} from './race-fit-clock-anomaly-review.mjs';
import {inspectFitTimerEvents} from './race-fit-timer-event-review.mjs';
const no=(reason)=>({status:'blocked',reason,segments:[],flags:[],qualityCertified:false,analysisAllowed:false,writeAllowed:false,providerDataCombined:false});
const opts={userConfirmedFile:true,privateView:true,confirmRunning:true,sourceProvenance:'user_uploaded_fit'};
export function reviewSingleUserFitBuffer(buffer,{confirmedOwner=false,confirmedRace=false}={}){
 if(!confirmedOwner||!confirmedRace)return no('owner_or_race_confirmation_missing');
 if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<16||buffer.byteLength>16*1024*1024)return no('file_size_or_type_invalid');
 try{
  const decoder=new Decoder(Stream.fromArrayBuffer(buffer));
  if(!decoder.isFIT()||!decoder.checkIntegrity())return no('fit_integrity_invalid');
  const {messages,errors}=decoder.read();
  if(errors?.length)return no('fit_decode_error');
  const split=normalizeDecodedFitForOfflineProbe(messages,opts);
  const totals=reviewFitSessionRecordTotals(messages,opts);
  const clock=reviewFitClockAnomalies(messages,opts);
  const timer=inspectFitTimerEvents(messages,opts);
  const flagged=new Set([...(split.qualityFlags||[]),...(totals.flags||[]),...(clock.flags||[]),...(timer.flags||[])]);
  if(split.status!=='synthetic_candidate_only'||totals.status==='blocked'||clock.status==='blocked'||timer.status==='blocked'){
   return {status:'blocked',reason:split.status!=='synthetic_candidate_only'?split.reason:totals.status==='blocked'?totals.reason:clock.status==='blocked'?clock.reason:timer.reason,
    segments:[],flags:[...flagged],qualityCertified:false,analysisAllowed:false,writeAllowed:false,providerDataCombined:false};
  }
  const segments=split.segments.map(s=>({index:s.index,distanceM:s.distanceM,clockElapsedS:s.clockElapsedS,partial:s.partial}));
  // Do NOT include raw FIT messages, GPS samples, identifiers or sensor values in output.
  return {status:'candidate_unverified',reason:'fit_local_review_only',segments,flags:[...flagged],
   distanceM:totals.recordDistanceM,sessionTotalDistanceM:totals.sessionTotalDistanceM,
   clockElapsedS:totals.clockElapsedSeconds,qualityCertified:false,analysisAllowed:false,
   writeAllowed:false,providerDataCombined:false};
 }catch{return no('fit_decoding_failed');}
}
