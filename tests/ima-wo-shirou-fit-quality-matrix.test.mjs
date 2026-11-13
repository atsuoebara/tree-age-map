import test from 'node:test';
import assert from 'node:assert/strict';
import {Encoder} from '../fit-sdk/src/index.js';
import {reviewSingleUserFitBuffer} from '../src/race-fit-local-file-review.mjs';

const options={confirmedOwner:true,confirmedRace:true};
const start=new Date('2026-11-14T00:00:00Z');
const at=seconds=>new Date(start.getTime()+seconds*1000);
function makeFit({times,distances,totalDistance,events=[]}){
 assert.equal(times.length,distances.length);
 const e=new Encoder();
 e.writeMesg({mesgNum:18,sport:'running',startTime:start,timestamp:at(times.at(-1)),totalDistance});
 for(let i=0;i<times.length;i++)
   e.writeMesg({mesgNum:20,timestamp:at(times[i]),distance:distances[i]});
 for(const event of events)
   e.writeMesg({mesgNum:21,event:'timer',eventType:event.kind,timestamp:at(event.at)});
 const bytes=e.close();
 return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
}
function assertReviewOnly(result){
 assert.equal(result.qualityCertified,false);
 assert.equal(result.analysisAllowed,false);
 assert.equal(result.writeAllowed,false);
 assert.equal(result.providerDataCombined,false);
 assert.ok(!('heartRate' in result));
 assert.ok(!('gps' in result));
}
test('uninterrupted synthetic FIT produces only candidate full-km clock segments',()=>{
 const times=Array.from({length:11},(_,i)=>i*60);
 const distances=times.map((_,i)=>i*200);
 const r=reviewSingleUserFitBuffer(makeFit({times,distances,totalDistance:2000}),options);
 assert.equal(r.status,'candidate_unverified',JSON.stringify(r));
 assert.deepEqual(r.segments.map(s=>Math.round(s.clockElapsedS)),[300,300]);
 assertReviewOnly(r);
});
test('traffic light / restroom-like pause does not automatically exclude a run or subtract time',()=>{
 const times=Array.from({length:11},(_,i)=>i*60);
 const distances=[0,200,400,600,800,800,1000,1200,1400,1600,1800];
 const r=reviewSingleUserFitBuffer(makeFit({
  times,distances,totalDistance:1800,
  events:[{kind:'stop',at:240},{kind:'start',at:300}],
 }),options);
 assert.equal(r.status,'candidate_unverified',JSON.stringify(r));
 assert.ok(r.flags.includes('distance_plateau_elapsed_kept'));
 assert.ok(r.flags.some(x=>x.includes('timer')),'pause remains evidence, not an exclusion rule');
 assert.equal(Math.round(r.segments[0].clockElapsedS),360,'the 60-second plateau stays in elapsed time');
 assert.equal(Math.round(r.segments[1].clockElapsedS),240);
 assertReviewOnly(r);
});
test('large record gap is flagged, not silently interpolated into certified data',()=>{
 const times=[0,60,240,300,360,420,480,540,600];
 const distances=[0,250,500,750,1000,1250,1500,1750,2000];
 const r=reviewSingleUserFitBuffer(makeFit({times,distances,totalDistance:2000}),options);
 assert.equal(r.status,'candidate_unverified',JSON.stringify(r));
 assert.ok(r.flags.includes('long_record_clock_gap'));
 assert.ok(r.flags.includes('unverified_sample_gap'));
 assertReviewOnly(r);
});
test('delayed first point blocks instead of inferring start time from another source',()=>{
 const times=[3,63,123,183,243,303,363,423,483,543,603];
 const distances=times.map((_,i)=>i*200);
 const r=reviewSingleUserFitBuffer(makeFit({times,distances,totalDistance:2000}),options);
 assert.equal(r.status,'blocked');
 assert.equal(r.reason,'record_and_session_start_must_match');
 assert.equal(r.segments.length,0);
 assertReviewOnly(r);
});
test('session/record mismatch is flagged, never silently repaired',()=>{
 const times=Array.from({length:11},(_,i)=>i*60);
 const distances=times.map((_,i)=>i*200);
 const r=reviewSingleUserFitBuffer(makeFit({times,distances,totalDistance:2300}),options);
 assert.equal(r.status,'candidate_unverified',JSON.stringify(r));
 assert.ok(r.flags.includes('session_vs_last_record_distance_mismatch'));
 assertReviewOnly(r);
});
