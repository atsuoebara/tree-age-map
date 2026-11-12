'use strict';
// Offline research prototype. SOURCE SAMPLES ONLY; does not attest fitness for production.
// A constant-distance interval is an OBSERVATION, never proof of intentional stopping.
const REVIEW_DISTANCE_GAP_M=250;
const REVIEW_CLOCK_GAP_S=120;
function reject(reason){return {ok:false,reason};}
function analyzeSampleContinuity(samples){
 if(!Array.isArray(samples)||samples.length<2||samples.length>20000)return reject('invalid_size');
 const normalized=[];
 for(const p of samples){
  if(!p||typeof p!=='object'||!Number.isFinite(p.startTimeInSeconds)||!Number.isFinite(p.totalDistanceInMeters)||p.totalDistanceInMeters<0)return reject('invalid_sample');
  normalized.push({t:p.startTimeInSeconds,d:p.totalDistanceInMeters});
 }
 for(let i=1;i<normalized.length;i++){
  if(normalized[i].t<=normalized[i-1].t)return reject('nonincreasing_time');
  if(normalized[i].d<normalized[i-1].d)return reject('nonmonotonic_distance');
 }
 const start=normalized[0].d,end=normalized.at(-1).d;
 if(!(end>start)||end-start>250000)return reject('invalid_distance');
 const segments=[];const total=end-start;
 const n=Math.ceil(total/1000);
 for(let k=0;k<n;k++){
  const left=start+1000*k,right=Math.min(start+1000*(k+1),end);
  segments.push({segmentIndex:k+1,startM:left-start,endM:right-start,distanceM:right-left,samplesInSegment:0,
   maxObservedMovingDistanceGapM:0,maxObservedMovingClockGapS:0,stationaryCandidateSeconds:0,
   stationaryIntervals:0,movingGapIntervals:0,flags:[]});
 }
 const events=[];
 for(let i=1;i<normalized.length;i++){
  const a=normalized[i-1],b=normalized[i],deltaD=b.d-a.d,deltaT=b.t-a.t;
  if(deltaD===0){
   events.push({kind:'distance_plateau_candidate',fromIndex:i-1,toIndex:i,seconds:deltaT,distanceM:a.d-start});
   // Assign plateau to adjacent segment(s); boundaries are ambiguous by design.
   const idx=Math.min(segments.length-1,Math.floor(Math.max(0,a.d-start)/1000));
   segments[idx].stationaryCandidateSeconds+=deltaT;
   segments[idx].stationaryIntervals++;
   continue;
  }
  const event={kind:'distance_increase',fromIndex:i-1,toIndex:i,distanceM:deltaD,seconds:deltaT};
  events.push(event);
  for(let k=0;k<segments.length;k++){
   const s=segments[k],overlap=Math.min(b.d,start+s.endM)-Math.max(a.d,start+s.startM);
   if(overlap<=0)continue;
   s.maxObservedMovingDistanceGapM=Math.max(s.maxObservedMovingDistanceGapM,deltaD);
   s.maxObservedMovingClockGapS=Math.max(s.maxObservedMovingClockGapS,deltaT);
   s.movingGapIntervals++;
  }
 }
 for(let k=0;k<segments.length;k++){
  const s=segments[k],left=start+s.startM,right=start+s.endM;
  s.samplesInSegment=normalized.filter((p,i)=>p.d>=left&&p.d<=right && (i===0||p.d!==normalized[i-1].d)).length;
  if(s.samplesInSegment<5)s.flags.push('sparse_source_points');
  if(s.maxObservedMovingDistanceGapM>REVIEW_DISTANCE_GAP_M)s.flags.push('large_distance_gap');
  if(s.maxObservedMovingClockGapS>REVIEW_CLOCK_GAP_S)s.flags.push('large_clock_gap');
  if(s.stationaryIntervals>0)s.flags.push('distance_plateau_observed');
  if(s.distanceM<1000)s.flags.push('partial_segment');
  // No segment here is certified for PR #91, even when no flags exist.
  s.elapsedQualityOk=false;
  s.certification='NOT_CERTIFIED';
 }
 return {ok:true,version:'race-source-evidence-v0-diagnostic',source:'direct_input_samples_untrusted',
  basis:{distance:'device_cumulative_m',time:'clock_elapsed_seconds'},
  totalDistanceM:total,segments,events,
  warning:'Distance plateaus may reflect a stop, GPS freeze, or recording behavior. No certified elapsed-quality flag is produced.'};
}
if(typeof module!=='undefined'&&module.exports)module.exports={analyzeSampleContinuity,REVIEW_DISTANCE_GAP_M,REVIEW_CLOCK_GAP_S};
