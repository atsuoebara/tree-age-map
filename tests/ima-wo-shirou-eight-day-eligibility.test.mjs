import test from 'node:test';
import assert from 'node:assert/strict';
import {assessImaWoShirouEligibility, EIGHT_DAYS_SECONDS} from '../src/ima-wo-shirou-eight-day-eligibility.mjs';

const start=1794560000000;
const feature=start-1000;
const base={selectedAsGachiRun:true,startedAtMs:start,featureStartedAtMs:feature,maxAgeSeconds:EIGHT_DAYS_SECONDS};
const check=(overrides={})=>assessImaWoShirouEligibility({...base,nowMs:start,...overrides});

test('requires caller to explicitly pass exactly 691200 seconds',()=>{
 assert.equal(check({maxAgeSeconds:undefined}).reason,'explicit_eight_day_policy_required');
 assert.equal(check({maxAgeSeconds:7*86400}).eligible,false);
});
test('boundary precisely 8 days inclusive',()=>{
 assert.equal(check({nowMs:start+691200000}).eligible,true);
 assert.equal(check({nowMs:start+691200001}).reason,'eight_day_window_expired');
 assert.equal(check({nowMs:start+691201000}).eligible,false);
});
test('no restart on late ingestion: ingestion timestamp is not read',()=>{
 assert.equal(check({nowMs:start+691201000,importedAtMs:start+691200999}).eligible,false);
});
test('no retrospective application before explicitly supplied rollout boundary',()=>{
 assert.equal(check({featureStartedAtMs:start+1}).reason,'pre_feature_activity_not_eligible');
});
test('only owner-selected gachi run, never automatic selection',()=>{
 assert.equal(check({selectedAsGachiRun:false}).reason,'user_selection_required');
});
test('missing, invalid or future timestamps do not invent dates',()=>{
 assert.equal(check({startedAtMs:undefined}).reason,'timestamp_missing_or_invalid');
 assert.equal(check({startedAtMs:NaN}).eligible,false);
 assert.equal(check({startedAtMs:'2026-11-13'}).eligible,false);
 assert.equal(check({featureStartedAtMs:undefined}).eligible,false);
 assert.equal(check({nowMs:start-1}).reason,'future_activity_not_eligible');
});
test('eligibility does not certify analysis or authorize writes',()=>{
 assert.equal(check().analysisAllowed,false);
});
