import assert from 'node:assert/strict';
import {inspectActivityShape} from '../scripts/inspect-garmin-activity-shape.mjs';
const fixture={activityDetails:[{userId:'must-not-leak',userAccessToken:'PRIVATE',summary:{},samples:[
 {startTimeInSeconds:1700000000,totalDistanceInMeters:1,heartRate:141,longitudeInDegree:139,latitudeInDegree:36},
 {startTimeInSeconds:1700000001,totalDistanceInMeters:5,heartrate:143,stepsPerMinute:80},
 {startTimeInSeconds:1700000002,totalDistanceInMeters:7,heartRate:null,heartrate:144,extraSecret:'PRIVATE'},
 null,
 {startTimeInSeconds:'1700000003',totalDistanceInMeters:8,heartRate:'x'}
]}]};
const report=inspectActivityShape(fixture);
assert.equal(report.ok,true);
assert.equal(report.activities,1);
assert.equal(report.sampleCount,5);
assert.equal(report.fields.heartRate.present,3);
assert.equal(report.fields.heartRate.finite_number,1);
assert.equal(report.fields.heartrate.present,2);
assert.equal(report.duplicateHeartRateAlias,1);
assert.equal(report.sampleNonObject,1);
assert.equal(report.missingRequiredPair,1);
assert.equal(JSON.stringify(report).includes('PRIVATE'),false);
assert.equal(JSON.stringify(report).includes('must-not-leak'),false);
assert.equal(JSON.stringify(report).includes('extraSecret'),false);
assert.deepEqual(inspectActivityShape({samples:[]}).ok,true);
assert.equal(inspectActivityShape({wrong:true}).ok,false);
assert.equal(inspectActivityShape({samples:Array.from({length:20001},()=>null)}).reason,'too_many_samples');
console.log('Garmin offline shape inspector synthetic tests passed.');
