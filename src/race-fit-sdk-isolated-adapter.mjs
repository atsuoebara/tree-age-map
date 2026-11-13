// ISOLATED ONLY. Reads an athlete-provided FIT ArrayBuffer via the same
// repository FIT SDK imported by fit_importer.js; never touches app imports,
// Strava, Supabase, network, existing runs or GPS map behavior.
import {Decoder,Stream} from '../fit-sdk/src/index.js';
import {probeFitOnlyKilometres} from './race-fit-only-split-probe.mjs';
const refuse=reason=>({status:'blocked',reason,writeAllowed:false,analysisAllowed:false,providerDataCombined:false});
const seconds=v=>v instanceof Date&&Number.isFinite(v.getTime())?v.getTime()/1000:null;
export function normalizeDecodedFitForOfflineProbe(messages,{userConfirmedFile=false,privateView=false,confirmRunning=false,sourceProvenance='user_uploaded_fit'}={}){
 if(!userConfirmedFile||!privateView||sourceProvenance!=='user_uploaded_fit')return refuse('owner_or_provenance_missing');
 if(!confirmRunning||!messages||!Array.isArray(messages.sessionMesgs)||messages.sessionMesgs.length!==1||messages.sessionMesgs[0]?.sport!=='running')return refuse('single_running_session_required');
 const raw=messages.recordMesgs;
 if(!Array.isArray(raw)||raw.length<2||raw.length>200000)return refuse('record_count_invalid');
 const first=seconds(raw[0]?.timestamp),start=seconds(messages.sessionMesgs[0].startTime);
 if(first===null||start===null||Math.abs(first-start)>0.001)return refuse('record_and_session_start_must_match');
 const records=[];
 for(const row of raw){
  const time=seconds(row?.timestamp);
  if(time===null||typeof row.distance!=='number'||!Number.isFinite(row.distance))return refuse('timestamp_or_cumulative_distance_missing');
  records.push({elapsedS:time-first,distanceM:row.distance,
   ...(row.heartRate==null?{}:{heartRate:row.heartRate}),
   ...(row.cadence==null?{}:{cadence:row.cadence}),
   ...(row.power==null?{}:{power:row.power})});
 }
 if(records[0].distanceM!==0)return refuse('cumulative_distance_origin_not_zero');
 return probeFitOnlyKilometres({userConfirmedFile,privateView,confirmRunning,sourceProvenance,session:{sport:'running'},records});
}
export function decodeAthleteFitArrayBufferForOfflineProbe(arrayBuffer,options={}){
 if(!(arrayBuffer instanceof ArrayBuffer)||arrayBuffer.byteLength<16||arrayBuffer.byteLength>16*1024*1024)return refuse('fit_buffer_invalid_or_oversize');
 try{
  const decoder=new Decoder(Stream.fromArrayBuffer(arrayBuffer));
  if(!decoder.isFIT())return refuse('not_valid_fit_file');
  const {messages,errors}=decoder.read();
  if(errors?.length)return refuse('fit_sdk_decode_errors');
  return normalizeDecodedFitForOfflineProbe(messages,options);
 }catch{return refuse('fit_sdk_decode_failed');}
}
