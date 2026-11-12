'use strict';
const assert=require('node:assert/strict');
const {analyzeSampleContinuity}=require('../src/race-source-continuity-diagnostic.cjs');
const {checkElapsedQuality}=require('../src/race-elapsed-quality-gate-review.cjs');
const {suggestTraining}=require('../src/race-training-suggestions.cjs');
function run(points){const result=analyzeSampleContinuity(points);assert.ok(result&&typeof result==='object');return result;}
function build(steps=200,meters=10,seconds=2){
 return Array.from({length:steps+1},(_,i)=>({startTimeInSeconds:i*seconds,totalDistanceInMeters:i*meters,heartRate:null,powerInWatts:0}));
}
let result=run(build(700));
assert.equal(result.ok,true);
assert.equal(result.segments.length,7);
assert.ok(result.segments.every(s=>s.flags.length===0));
assert.ok(result.segments.every(s=>s.certification==='NOT_CERTIFIED'&&s.elapsedQualityOk===false));
assert.equal(result.events.length,700);
assert.equal(result.totalDistanceM,7000);
const stationary=build(700);
const anchor=stationary[200].startTimeInSeconds;
const plateau=Array.from({length:180},(_,j)=>({startTimeInSeconds:anchor+j+1,totalDistanceInMeters:stationary[200].totalDistanceInMeters,heartRate:null}));
stationary.splice(201,0,...plateau);
for(let k=381;k<stationary.length;k++)stationary[k].startTimeInSeconds+=180;
result=run(stationary);
assert.equal(result.ok,true);
assert.equal(result.events.filter(e=>e.kind==='distance_plateau_candidate').length,180);
assert.equal(result.segments[2].stationaryCandidateSeconds,180);
assert.ok(result.segments[2].flags.includes('distance_plateau_observed'));
assert.equal(result.segments[2].elapsedQualityOk,false);
assert.ok(result.warning.includes('GPS freeze'));
const freeze=build(700);
for(let j=201;j<=206;j++)freeze[j].totalDistanceInMeters=freeze[200].totalDistanceInMeters;
// No certainty that this was an intentional stop.
result=run(freeze);
assert.equal(result.ok,true);
assert.ok(result.events.some(e=>e.kind==='distance_plateau_candidate'));
assert.equal(result.segments[2].certification,'NOT_CERTIFIED');
const gap=build(700);
gap.splice(191,28); // 290m missing movement record (raw pair distance=290m)
result=run(gap);
assert.equal(result.ok,true);
assert.ok(result.segments[1].flags.includes('large_distance_gap'));
assert.equal(result.segments[1].maxObservedMovingDistanceGapM,290);
const clockGap=build(700);
for(let i=251;i<clockGap.length;i++)clockGap[i].startTimeInSeconds+=150;
result=run(clockGap);
assert.equal(result.ok,true);
assert.ok(result.segments[2].flags.includes('large_clock_gap'));
const partial=run(build(642));
assert.equal(partial.ok,true);
assert.equal(partial.segments.length,7);
assert.equal(partial.segments.at(-1).distanceM,420);
assert.ok(partial.segments.at(-1).flags.includes('partial_segment'));
for(const data of [null,[],[{}],build(1).map((x,i)=>({...x,startTimeInSeconds:0})),build(1).map((x,i)=>({...x,totalDistanceInMeters:i? -1:0}))]){
 assert.equal(run(data).ok,false);
}
const reversed=build(5);
reversed[3].totalDistanceInMeters=0;
assert.equal(run(reversed).reason,'nonmonotonic_distance');
const evidence=run(build(700));
// PR #91 must remain closed even if diagnostic evidence is attached (different version, no provenance).
const summary={analysis_version:'garmin-activity-details-v1',distance_basis:'device_cumulative_m',time_basis:'clock_elapsed_seconds',quality_flags:[],excluded_samples:0,segments:[{distance_m:1000,clock_elapsed_s:300,quality_flags:[],elapsed_continuity_evidence:evidence.segments[0]}]};
assert.equal(checkElapsedQuality(summary,summary.segments[0],0).reason,'continuity_not_proven');
assert.equal(suggestTraining({splits:evidence.segments.slice(0,6).map(s=>({distanceKm:1,elapsedSeconds:300,qualityOk:s.elapsedQualityOk}))}).status,'insufficient_data');
console.log('Source continuity diagnostic: clean, pause candidate, freeze, gaps, partial, hostile data, fail closed PASS');
