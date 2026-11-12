import assert from 'node:assert/strict';
import {countGarminSampleShape} from '../src/garmin-sample-shape-probe.mjs';
const secret='PRIVATE-TOKEN-UNIQUE';
const good={activityDetails:[{userId:'private-user',summaryId:'private-run',userAccessToken:secret,samples:[
  {startTimeInSeconds:1700000000,totalDistanceInMeters:10,heartRate:140,latitudeInDegree:36.1,longitudeInDegree:139},
  {startTimeInSeconds:1700000001,totalDistanceInMeters:20,heartrate:150,secret},
  {startTimeInSeconds:'broken',totalDistanceInMeters:30,heartRate:null,heartrate:150},
  null
]}]};
const x=countGarminSampleShape(good);
assert.equal(x.ok,true);assert.equal(x.activityCount,1);assert.equal(x.sampleCount,4);
assert.equal(x.missingTimeDistancePair,1);assert.equal(x.nonObjectSamples,1);
assert.equal(x.fields.heartRate.present,2);assert.equal(x.fields.heartRate.null,1);
assert.equal(x.fields.heartrate.number,2);assert.equal(x.bothHeartRateNames,1);
for(const forbidden of [secret,'private-user','private-run','1700000000','139','36.1'])assert.ok(!JSON.stringify(x).includes(forbidden));
assert.equal(countGarminSampleShape({activityDetails:[{samples:[null]}]}).ok,true);
assert.equal(countGarminSampleShape({activityDetails:[{samples:[]}]}).sampleCount,0);
assert.equal(countGarminSampleShape({activityDetails:[{samples:Array.from({length:20001},()=>null)}]}).reason,'too_many_samples');
assert.equal(countGarminSampleShape({activityDetails:[null]}).reason,'invalid_activity');
assert.equal(countGarminSampleShape({activityDetails:[{samples:[]} ]},{maxActivities:0}).reason,'invalid_limits');
assert.equal(countGarminSampleShape({activityDetails:[]}).reason,'invalid_activities');
assert.equal(countGarminSampleShape({activityDetails:[{samples:[]} ,{samples:[]}]},{maxActivities:1}).reason,'invalid_activities');
assert.equal(countGarminSampleShape({activityDetails:[{samples:Array.from({length:2},()=>null)},{samples:[null]}]},{maxSamples:2}).reason,'too_many_samples');
assert.equal(countGarminSampleShape({activityDetails:[{samples:[]}], foo:secret}).ok,true);

const boundaries=[
  [{activityDetails:[{samples:[{startTimeInSeconds:0,totalDistanceInMeters:0,heartRate:0,heartrate:120}]}]},true],
  [{activityDetails:[{samples:[{startTimeInSeconds:null,totalDistanceInMeters:'1',heartRate:'PRIVATE'}]}]},true],
  [{activityDetails:[{samples:[1,'PRIVATE',{},null]}]},true],
  [{activityDetails:[{samples:[{startTimeInSeconds:Infinity,totalDistanceInMeters:NaN}]}]},true],
  [{activityDetails:'invalid'},false],
  [{activityDetails:[{samples:[{userAccessToken:'PRIVATE'}]}]},true],
];
for(const [input,expected] of boundaries){
  const r=countGarminSampleShape(input);
  assert.equal(r.ok,expected);
  assert.equal(JSON.stringify(r).includes('PRIVATE'),false);
}
const maxValid={activityDetails:[{samples:Array.from({length:20000},()=>({heartRate:120,startTimeInSeconds:1,totalDistanceInMeters:2}))}]};
assert.equal(countGarminSampleShape(maxValid).sampleCount,20000);
assert.equal(countGarminSampleShape({activityDetails:[{samples:Array.from({length:20001},()=>null)}]}).reason,'too_many_samples');
console.log('Additional Garmin privacy and boundary cases PASS');


const maxBatch={activityDetails:Array.from({length:100},(_,a)=>({
  userId:'sensitive-account-'+a,
  samples:Array.from({length:200},(_,i)=>({
    startTimeInSeconds:1700000000+i,
    totalDistanceInMeters:a*2000+i*10,
    heartRate:140,
    userAccessToken:'TOP-SECRET-'+a
  }))
}))};
const maxStart=performance.now();
const maxReport=countGarminSampleShape(maxBatch);
const maxDuration=performance.now()-maxStart;
assert.equal(maxReport.ok,true);
assert.equal(maxReport.activityCount,100);
assert.equal(maxReport.sampleCount,20000);
assert.equal(maxReport.fields.heartRate.number,20000);
assert.ok(maxDuration<2500,'20k sample smoke test is unexpectedly slow');
assert.ok(!JSON.stringify(maxReport).includes('sensitive-account'));
assert.ok(!JSON.stringify(maxReport).includes('TOP-SECRET'));
// A second call currently succeeds: the pure function DOES NOT enforce "one shot".
// The one-shot gate MUST be atomic, external, server-owned and time-limited before use in production.
assert.deepEqual(countGarminSampleShape(maxBatch),maxReport);
console.log('Garmin max-batch synthetic shape probe PASS');

console.log('Garmin one-shot pure shape probe synthetic tests PASS');
