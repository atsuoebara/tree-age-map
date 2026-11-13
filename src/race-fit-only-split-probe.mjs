// ISOLATED REVIEW-ONLY: synthetic decoded-FIT-shaped records, not FIT decoding.
// Pure calculation of candidate 1km clock-elapsed intervals. No GPS/HR merging,
// Strava data, network, DB, storage or production imports.
// A calculated candidate is NOT a quality-certified race split.
import {assessOwnFitForOfflineReview} from './race-user-fit-only-gate.mjs';
const MAX_BOUNDARIES=251;
export function probeFitOnlyKilometres(input={}){
 const gate=assessOwnFitForOfflineReview(input);
 const deny=(reason,extra={})=>({status:'blocked',reason,writeAllowed:false,analysisAllowed:false,providerDataCombined:false,...extra});
 if(gate.status!=='offline_shape_review')return deny(gate.reason);
 const r=input.records;
 // Requiring distance 0 at clock 0 prevents silently dropping pre-first-record
 // elapsed time. The synthetic input must be normalized *by a separate,
 // independently audited decoder* before integration.
 if(r[0].elapsedS!==0||r[0].distanceM!==0)return deny('zero_origin_required');
 const total=r.at(-1).distanceM;
 if(total>251000)return deny('distance_cap_exceeded');
 const flags=new Set();
 let plateauCount=0;
 const boundaries=[{distanceM:0,elapsedS:0}];
 let target=1000;
 for(let i=1;i<r.length;i++){
  const p=r[i-1],q=r[i];
  const dm=q.distanceM-p.distanceM,dt=q.elapsedS-p.elapsedS;
  if(dm===0){plateauCount++;flags.add('distance_plateau_elapsed_kept');continue;}
  if(dm>250||dt>120)flags.add('unverified_sample_gap');
  while(target<=q.distanceM&&boundaries.length<=MAX_BOUNDARIES){
   if(target>=p.distanceM){
    const fraction=(target-p.distanceM)/dm;
    boundaries.push({distanceM:target,elapsedS:p.elapsedS+dt*fraction});
   }
   target+=1000;
  }
 }
 if(boundaries.length>MAX_BOUNDARIES)return deny('segment_cap_exceeded');
 if(plateauCount>0)flags.add('plateau_cause_unknown');
 const segments=[];
 for(let i=1;i<boundaries.length;i++){
  const start=boundaries[i-1],end=boundaries[i];
  segments.push({index:i,distanceM:1000,clockElapsedS:end.elapsedS-start.elapsedS,partial:false});
 }
 if(total>boundaries.at(-1).distanceM){
  const end=r.at(-1);
  segments.push({index:segments.length+1,distanceM:total-boundaries.at(-1).distanceM,
   clockElapsedS:end.elapsedS-boundaries.at(-1).elapsedS,partial:true});
 }
 // Neither an apparently smooth stream nor a sensor reading proves continuity:
 // keep all output marked unverified until separate provenance/quality auditing.
 return {status:'synthetic_candidate_only',source:'user_fit_only',timeBasis:'clock_elapsed_seconds',
  distanceBasis:'reported_cumulative_m',segments,qualityFlags:[...flags],
  sensorsCalculated:false,qualityCertified:false,writeAllowed:false,
  analysisAllowed:false,providerDataCombined:false};
}
