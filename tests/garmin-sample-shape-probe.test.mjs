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
console.log('Garmin one-shot pure shape probe synthetic tests PASS');
