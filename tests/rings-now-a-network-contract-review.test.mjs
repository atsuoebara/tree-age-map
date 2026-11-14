import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {proposeAnonymousCheck,inspectSyntheticRequest,reviewSyntheticSignal} from '../src/rings-now-a-network-contract-review.mjs';
const request=proposeAnonymousCheck('v1');
const response={protocol:'rings-now-review-v1',build:'v1',enabled:true};
test('minimal synthetic contract contains only protocol and build, never FIT or identifiers',()=>{
 assert.deepEqual(Object.keys(request).sort(),['build','protocol']);
 assert.equal(inspectSyntheticRequest(request).contractValid,true);
 for(const extra of ['fit','gps','heartRate','userId','email','activityId','token','distance','time','deviceId']){
  assert.equal(inspectSyntheticRequest({...request,[extra]:'x'}).contractValid,false,extra);
 }
});
test('missing network, offline and unverifiable signal all block',()=>{
 for(const options of [{},{networkAvailable:true},{networkAvailable:true,offline:true,signalVerified:true}]){
  assert.equal(reviewSyntheticSignal({request,response,...options}).reviewStatus,'blocked');
 }
});
test('fresh synthetic matching signal can reach manual review only, not permission',()=>{
 const r=reviewSyntheticSignal({request,response,signalVerified:true,networkAvailable:true});
 assert.equal(r.reviewStatus,'requires_manual_review');
 assert.equal(r.verifiedSafe,false);
 assert.equal(r.realFitAllowed,false);
 assert.equal(r.productionAllowed,false);
 assert.equal(r.adopted,false);
 assert.equal(r.oldTabGuaranteedStopped,false);
});
test('withdrawal, version mismatch, malformed response and extra response fields block',()=>{
 for(const r of [{...response,enabled:false},{...response,build:'v2'},null,{...response,tracking:'x'}]){
  assert.equal(reviewSyntheticSignal({request,response:r,signalVerified:true,networkAvailable:true}).reviewStatus,'blocked');
 }
});
test('invalid request and unknown fields block',()=>{
 assert.equal(reviewSyntheticSignal({request:{...request,fit:'secret'},response,networkAvailable:true,signalVerified:true}).reviewStatus,'blocked');
 assert.throws(()=>proposeAnonymousCheck('user-123'));
});
test('model stays isolated from public pages and cannot claim transport or cost assurance',()=>{
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 const source=readFileSync(new URL('../src/rings-now-a-network-contract-review.mjs',import.meta.url),'utf8');
 assert.match(index,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
 assert.doesNotMatch(index,/rings-now-a-network-contract-review/);
 assert.doesNotMatch(sw,/rings-now-a-network-contract-review/);
 for(const re of [/\bfetch\s*\(/,/\bXMLHttpRequest\b/,/\bWebSocket\b/,/\bFileReader\b/,/\blocalStorage\b/,/\bindexedDB\b/])assert.doesNotMatch(source,re);
 const audit=inspectSyntheticRequest(request);
 assert.equal(audit.privacyVerified,false);
 assert.equal(audit.transportVerified,false);
 assert.equal(audit.costVerified,false);
});
