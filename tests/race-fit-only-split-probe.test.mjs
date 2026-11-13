import assert from 'node:assert/strict';
import {probeFitOnlyKilometres as probe} from '../src/race-fit-only-split-probe.mjs';
const records=Array.from({length:11},(_,i)=>({elapsedS:i*60,distanceM:i*200}));
const base={userConfirmedFile:true,privateView:true,sourceProvenance:'user_uploaded_fit',confirmRunning:true,session:{sport:'running'},records};
const result=probe(base);
assert.equal(result.status,'synthetic_candidate_only');
assert.equal(result.source,'user_fit_only');
assert.equal(result.timeBasis,'clock_elapsed_seconds');
assert.deepEqual(result.segments,[
 {index:1,distanceM:1000,clockElapsedS:300,partial:false},
 {index:2,distanceM:1000,clockElapsedS:300,partial:false}
]);
assert.equal(result.analysisAllowed,false);
assert.equal(result.writeAllowed,false);
assert.equal(result.providerDataCombined,false);
assert.equal(result.sensorsCalculated,false);
assert.equal(result.qualityCertified,false);
// Plateau: 60 seconds with no accumulated distance must remain in clock time.
const plateau=records.slice(0,4).concat([{elapsedS:240,distanceM:600}],
 records.slice(4).map(p=>({...p,elapsedS:p.elapsedS+60})));
const paused=probe({...base,records:plateau});
assert.equal(paused.status,'synthetic_candidate_only');
assert.deepEqual(paused.segments.map(x=>x.clockElapsedS),[360,300]);
assert.ok(paused.qualityFlags.includes('distance_plateau_elapsed_kept'));
assert.ok(paused.qualityFlags.includes('plateau_cause_unknown'));
const partial=probe({...base,records:[...records,{elapsedS:630,distanceM:2100}]});
assert.equal(partial.status,'synthetic_candidate_only');
assert.deepEqual(partial.segments.at(-1),{index:3,distanceM:100,clockElapsedS:30,partial:true});
// Sparse samples can be interpolated arithmetically but NOT quality certified.
const sparse=probe({...base,records:[{elapsedS:0,distanceM:0},{elapsedS:350,distanceM:1100}]});
assert.equal(sparse.status,'synthetic_candidate_only');
assert.ok(sparse.qualityFlags.includes('unverified_sample_gap'));
assert.equal(sparse.qualityCertified,false);
assert.equal(probe({...base,records:[{elapsedS:15,distanceM:0},{elapsedS:315,distanceM:1000}]}).reason,'zero_origin_required');
const nonzero=probe({...base,records:[{elapsedS:0,distanceM:10},{elapsedS:300,distanceM:1010}]});
assert.equal(nonzero.status,'synthetic_candidate_only');
assert.equal(nonzero.initialIntervalOmitted,true);
assert.equal(nonzero.firstObservedDistanceM,10);
assert.equal(nonzero.segments.length,1);
assert.equal(nonzero.segments[0].partial,true);
assert.equal(nonzero.segments[0].distanceM,10);
assert.equal(nonzero.qualityCertified,false);
const knownLater=probe({...base,records:[{elapsedS:0,distanceM:12},{elapsedS:100,distanceM:1012},{elapsedS:200,distanceM:2012}]});
assert.equal(knownLater.segments[0].index,2);
assert.equal(knownLater.segments[0].distanceM,1000);
assert.ok(Math.abs(knownLater.segments[0].clockElapsedS-100)<1e-9);
assert.equal(knownLater.segments.at(-1).distanceM,12);
assert.equal(knownLater.initialIntervalOmitted,true);
assert.equal(probe({...base,records:[{elapsedS:0,distanceM:12},{elapsedS:40,distanceM:500}]}).reason,'no_observed_kilometre_boundary');
assert.equal(probe({...base,sourceProvenance:'strava_stream'}).status,'blocked');
assert.equal(probe({...base,sourceProvenance:'garmin_api'}).status,'blocked');
assert.equal(probe({...base,userConfirmedFile:false}).status,'blocked');
assert.equal(probe({...base,privateView:false}).status,'blocked');
assert.equal(probe({...base,records:[{elapsedS:0,distanceM:0},{elapsedS:100,distanceM:900},{elapsedS:99,distanceM:1200}]}).status,'blocked');
assert.equal(probe({...base,records:[{elapsedS:0,distanceM:0},{elapsedS:60,distanceM:252000}]}).reason,'distance_cap_exceeded');
assert.deepEqual(records[5],{elapsedS:300,distanceM:1000},'never mutate input');
console.log('FIT-only synthetic clock elapsed kilometre candidates PASS: 1km, plateau, partial, gap flags, source and write fences');
