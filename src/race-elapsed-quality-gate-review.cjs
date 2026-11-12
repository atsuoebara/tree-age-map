'use strict';
// Isolated review candidate only. Real Garmin/DB data must NOT be wired to this module.
// Conservative, provisional continuity thresholds are safety gates, not clinical cutoffs.
const PROVISIONAL_GAP_METERS=250;
const PROVISIONAL_GAP_SECONDS=120;
const ALLOWED_SEGMENT_FLAGS=new Set(['sensor_missing','partial_segment']);
function fail(reason){return {elapsedQualityOk:false,reason};}
function checkElapsedQuality(summary,segment,index){
 if(!summary||typeof summary!=='object'||!segment||typeof segment!=='object')return fail('missing_source');
 if(summary.analysis_version!=='garmin-activity-details-v1'||summary.distance_basis!=='device_cumulative_m'||summary.time_basis!=='clock_elapsed_seconds')return fail('unsupported_basis');
 if(!Array.isArray(summary.quality_flags)||!Array.isArray(summary.segments)||!Array.isArray(segment.quality_flags))return fail('missing_flags');
 if(summary.quality_flags.length!==0)return fail('unverified_global_quality');
 // No summary-level excluded samples: unknown positions cannot be assigned to a safe split.
 if(!Number.isSafeInteger(summary.excluded_samples)||summary.excluded_samples!==0)return fail('excluded_samples');
 if(!Number.isSafeInteger(index)||index<0||index>=summary.segments.length||summary.segments[index]!==segment)return fail('segment_identity');
 const partial=segment.quality_flags.includes('partial_segment');
 if(segment.quality_flags.some(f=>typeof f!=='string'||!ALLOWED_SEGMENT_FLAGS.has(f)))return fail('unverified_segment_flag');
 if(partial&&index!==summary.segments.length-1)return fail('nonterminal_partial');
 if(!Number.isFinite(segment.distance_m)||segment.distance_m<=0)return fail('invalid_distance');
 if(!partial&&segment.distance_m!==1000)return fail('not_complete_1km');
 if(partial&&segment.distance_m>=1000)return fail('invalid_partial');
 if(!Number.isFinite(segment.clock_elapsed_s)||segment.clock_elapsed_s<=0)return fail('invalid_elapsed');
 // This evidence is NOT present in the current PR #67 output: real records MUST fail closed.
 // It must be produced from source samples by a separately audited, deterministic upstream pass.
 const ev=segment.elapsed_continuity_evidence;
 if(!ev||ev.version!=='race-continuity-proof-v0-synthetic'||ev.fromOriginalSamples!==true)return fail('continuity_not_proven');
 if(!Number.isSafeInteger(ev.samplesInSegment)||ev.samplesInSegment<5)return fail('sparse_samples');
 if(!Number.isFinite(ev.maxDistanceGapM)||ev.maxDistanceGapM<0||ev.maxDistanceGapM>PROVISIONAL_GAP_METERS)return fail('distance_gap');
 if(!Number.isFinite(ev.maxClockGapS)||ev.maxClockGapS<0||ev.maxClockGapS>PROVISIONAL_GAP_SECONDS)return fail('clock_gap');
 return {elapsedQualityOk:true,reason:'synthetic_continuity_verified'};
}
function mapSummaryToTrainingInput(summary){
 if(!summary||!Array.isArray(summary.segments)||summary.segments.length===0)return {splits:[null]};
 const splits=summary.segments.map((segment,index)=>{
  const check=checkElapsedQuality(summary,segment,index);
  // Deliberately retain invalid full splits as qualityOk:false; #86 must reject, not cherry-pick.
  const isPartial=segment&&Array.isArray(segment.quality_flags)&&segment.quality_flags.includes('partial_segment');
  return {distanceKm:segment?.distance_m===1000?1:Number(segment?.distance_m)/1000,
   elapsedSeconds:segment?.clock_elapsed_s,qualityOk:check.elapsedQualityOk,qualityReason:check.reason,partial:isPartial};
 });
 return {splits};
}
if(typeof module!=='undefined'&&module.exports)module.exports={checkElapsedQuality,mapSummaryToTrainingInput,PROVISIONAL_GAP_METERS,PROVISIONAL_GAP_SECONDS};
