// Full marathon-scale synthetic FIT SDK roundtrip; NEVER an actual athlete's race data.
import assert from 'node:assert/strict';
import {Encoder} from '../fit-sdk/src/index.js';
import {reviewSingleUserFitBuffer} from '../src/race-fit-local-file-review.mjs';
const start=new Date('2020-01-01T00:00:00Z');
const at=(s)=>new Date(start.getTime()+1000*s);
const TOTAL_M=42195, ELAPSED_S=12600; // fictional 3h30m marathon, not an athlete FIT
const encoder=new Encoder();
encoder.writeMesg({mesgNum:18,sport:'running',startTime:start,timestamp:at(ELAPSED_S),totalDistance:TOTAL_M});
for(let m=0;m<=42100;m+=100){
 const seconds=Math.round(m/TOTAL_M*ELAPSED_S);
 encoder.writeMesg({mesgNum:20,timestamp:at(seconds),distance:m});
}
encoder.writeMesg({mesgNum:20,timestamp:at(ELAPSED_S),distance:TOTAL_M});
const bytes=encoder.close();
const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
const result=reviewSingleUserFitBuffer(buffer,{confirmedOwner:true,confirmedRace:true});
assert.equal(result.status,'candidate_unverified',JSON.stringify(result));
assert.equal(result.distanceM,TOTAL_M);
assert.equal(result.sessionTotalDistanceM,TOTAL_M);
assert.equal(result.clockElapsedS,ELAPSED_S);
assert.equal(result.segments.length,43);
assert.deepEqual(result.segments.slice(0,42).map(s=>s.distanceM),Array(42).fill(1000));
const tail=result.segments.at(-1);
assert.equal(tail.index,43);
assert.equal(tail.distanceM,195);
assert.equal(tail.partial,true);
assert.ok(tail.clockElapsedS>0&&tail.clockElapsedS<60);
assert.equal(result.segments.slice(0,42).every(x=>x.partial===false),true);
const summed=result.segments.reduce((n,s)=>n+s.clockElapsedS,0);
assert.ok(Math.abs(summed-ELAPSED_S)<0.00001,'clock elapsed must total 3:30:00 without drift');
assert.equal(result.qualityCertified,false);
assert.equal(result.writeAllowed,false);
assert.equal(result.analysisAllowed,false);
assert.equal(result.providerDataCombined,false);
assert.ok(!('messages' in result)&&!('positionLat' in result)&&!('positionLong' in result));
console.log('PASS synthetic 42.195km FIT: 42x1km + 195m, 3:30:00 complete, no save or certification');
