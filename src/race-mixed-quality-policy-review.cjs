'use strict';
// Draft policy comparison. SYNTHETIC SCENARIO LABELS ONLY, not certified quality.
// No real Garmin input, no network, no production imports, no training advice for mixed data.
const ALLOWED=new Set(['simulated_clean','plateau_ambiguous','gps_gap','clock_gap','unknown']);
function fail(reason){return {status:'invalid_scenario',reason,trainingEligible:false,recommendationsAllowed:false,policyDecision:'undecided'};}
function compareMixedQualityScenario(input){
 if(!input||!Array.isArray(input.intervals)||input.intervals.length===0||input.intervals.length>251)return fail('invalid_intervals');
 const rows=[];let partialSeen=false;
 for(let i=0;i<input.intervals.length;i++){
  const x=input.intervals[i];
  if(!x||typeof x!=='object'||Array.isArray(x)||!Number.isFinite(x.distanceKm)||!Number.isFinite(x.elapsedSeconds)||x.elapsedSeconds<=0)return fail('invalid_interval');
  const partial=x.distanceKm!==1;
  if(partial&&(partialSeen||i!==input.intervals.length-1||x.distanceKm<=0||x.distanceKm>=1))return fail('invalid_partial_position');
  if(partial)partialSeen=true;
  if(typeof x.simulatedObservation!=='string'||!ALLOWED.has(x.simulatedObservation))return fail('unknown_observation');
  rows.push({index:i+1,distanceKm:x.distanceKm,elapsedSeconds:x.elapsedSeconds,simulatedObservation:x.simulatedObservation,
   eligibleForCertifiedAnalysis:false,observationOnly:true});
 }
 const full=rows.filter(x=>x.distanceKm===1);
 const clean=full.filter(x=>x.simulatedObservation==='simulated_clean');
 const concern=full.filter(x=>x.simulatedObservation!=='simulated_clean');
 const plateau=full.filter(x=>x.simulatedObservation==='plateau_ambiguous');
 const goodBlocks=[];let block=[];
 for(const item of full){
  if(item.simulatedObservation==='simulated_clean'){block.push(item.index);}
  else if(block.length){goodBlocks.push(block);block=[];}
 }
 if(block.length)goodBlocks.push(block);
 const count=full.length,uncertain=concern.length;
 // This is a policy comparison, not a live eligibility decision. No interval is certified by the fixture.
 const policies={
  whole_activity_reject:{wouldAnalyze:false,reason:uncertain?'some_intervals_uncertain':'no_verified_provenance'},
  display_all_flagged:{wouldDisplay:true,wouldRecommend:false,reason:'show_elapsed_with_uncertainty_labels_without_training'},
  drop_bad_then_compare:{wouldAnalyze:false,allowed:false,reason:'selection_bias_and_lost_original_order'},
  contiguous_windows:{wouldAnalyze:false,allowed:false,largestSimulatedCleanBlock:goodBlocks.reduce((m,b)=>Math.max(m,b.length),0),
   reason:'requires_new_estimand_validation_and_user_approval'},
 };
 return {status:'synthetic_policy_comparison',policyDecision:'undecided',
  trainingEligible:false,recommendationsAllowed:false,sourceQualityCertified:false,
  counts:{fullKm:count,partialKm:rows.length-count,simulatedCleanKm:clean.length,uncertainKm:uncertain,
   ambiguousPlateauKm:plateau.length},rows,policies,simulatedCleanBlocks:goodBlocks,
  noticeJa:'架空データによる方針比較です。品質認定や練習提案ではありません。',
  noticeEn:'Synthetic policy comparison only. No certified quality or training recommendations.'};
}
if(typeof module!=='undefined'&&module.exports)module.exports={compareMixedQualityScenario};
