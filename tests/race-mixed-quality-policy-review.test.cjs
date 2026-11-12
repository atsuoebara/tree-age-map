'use strict';
const assert=require('node:assert/strict');
const {compareMixedQualityScenario}=require('../src/race-mixed-quality-policy-review.cjs');
const {suggestTraining}=require('../src/race-training-suggestions.cjs');
const {checkElapsedQuality}=require('../src/race-elapsed-quality-gate-review.cjs');
const clean=Array.from({length:8},()=>({distanceKm:1,elapsedSeconds:300,simulatedObservation:'simulated_clean'}));
const run=x=>compareMixedQualityScenario({intervals:x});
const c=run(clean);
assert.equal(c.status,'synthetic_policy_comparison');assert.equal(c.counts.simulatedCleanKm,8);
assert.equal(c.policies.whole_activity_reject.wouldAnalyze,false);
assert.equal(c.trainingEligible,false);assert.equal(c.recommendationsAllowed,false);assert.equal(c.sourceQualityCertified,false);
assert.deepEqual(c.simulatedCleanBlocks,[[1,2,3,4,5,6,7,8]]);
for(const [index,kind] of [[2,'plateau_ambiguous'],[3,'gps_gap'],[5,'clock_gap'],[6,'unknown']]){
 const rows=clean.map(x=>({...x}));rows[index].simulatedObservation=kind;
 const r=run(rows);
 assert.equal(r.counts.uncertainKm,1,kind);
 assert.equal(r.policies.whole_activity_reject.wouldAnalyze,false);
 assert.equal(r.policies.drop_bad_then_compare.allowed,false);
 assert.equal(r.policies.contiguous_windows.allowed,false);
 assert.equal(r.policies.display_all_flagged.wouldRecommend,false);
 assert.equal(r.trainingEligible,false);
 assert.ok(r.simulatedCleanBlocks.length>=1);
}
const after=run([...clean.slice(0,3),{...clean[3],simulatedObservation:'plateau_ambiguous'},...clean.slice(4),{distanceKm:.42,elapsedSeconds:160,simulatedObservation:'unknown'}]);
assert.equal(after.counts.fullKm,8);
assert.equal(after.counts.partialKm,1);
assert.equal(after.counts.uncertainKm,1);
assert.deepEqual(after.simulatedCleanBlocks,[[1,2,3],[5,6,7,8]]);
const gaps=run([...clean.slice(0,3),{...clean[3],simulatedObservation:'gps_gap'},...clean.slice(4)]);
assert.equal(gaps.policies.contiguous_windows.largestSimulatedCleanBlock,4);
const noPartial=run(clean.slice(0,5));assert.equal(noPartial.counts.fullKm,5);assert.equal(noPartial.trainingEligible,false);
const invalid=[
 null,{}, {intervals:[]}, {intervals:[null]},
 {intervals:[{...clean[0],simulatedObservation:'real_verified'}]},
 {intervals:[{...clean[0],elapsedSeconds:0}]},
 {intervals:[{...clean[0],distanceKm:2}]},
 {intervals:[{...clean[0],distanceKm:.42},...clean]},
 {intervals:[...clean,{distanceKm:.42,elapsedSeconds:160,simulatedObservation:'unknown'},{distanceKm:.2,elapsedSeconds:70,simulatedObservation:'unknown'}]},
 {intervals:[...clean,{distanceKm:1,elapsedSeconds:Infinity,simulatedObservation:'simulated_clean'}]}
];
for(const val of invalid){const r=compareMixedQualityScenario(val);assert.equal(r.status,'invalid_scenario');assert.equal(r.trainingEligible,false);}
const genuineGate={analysis_version:'garmin-activity-details-v1',distance_basis:'device_cumulative_m',time_basis:'clock_elapsed_seconds',
 quality_flags:[],excluded_samples:0,segments:[{distance_m:1000,clock_elapsed_s:300,quality_flags:[]}]};
assert.equal(checkElapsedQuality(genuineGate,genuineGate.segments[0],0).elapsedQualityOk,false);
assert.equal(suggestTraining({splits:clean.map(x=>({distanceKm:x.distanceKm,elapsedSeconds:x.elapsedSeconds,qualityOk:false}))}).status,'insufficient_data');
// Even a source fixture whose name says "clean" cannot create passing proof or recommendations.
assert.equal(c.rows.every(r=>r.eligibleForCertifiedAnalysis===false),true);
console.log('Mixed-quality policy synthetic-only checks PASSED');
