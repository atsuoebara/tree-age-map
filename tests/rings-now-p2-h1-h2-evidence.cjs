'use strict';
// H1/H2 non-secret evidence shape, NOT an execution path or proof of issuance.
// No I/O, HTTP, Docker, or credentials. All inputs are untrusted observations.
const assert=require('node:assert/strict');
const CASES=Object.freeze({
 'h1_signup_a':'GOTRUE',
 'h1_signin_a':'GOTRUE',
 'h1_signup_b':'GOTRUE',
 'h1_signin_b':'GOTRUE',
 'h1_bad_password':'GOTRUE',
 'h2_anonymous':'POSTGREST',
 'h2_owner_a':'POSTGREST',
 'h2_foreign_a':'POSTGREST',
 'h2_owner_b':'POSTGREST',
 'h2_bad_signature':'POSTGREST',
 'h2_expired_token':'POSTGREST',
 'h2_no_rpc_grant':'POSTGREST'
});
const JWT=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
function recordIsolatedHttpObservation({caseId,service,httpStatus,token,body}={}){
 assert.equal(CASES[caseId],service,'case/service mismatch or unknown case');
 assert.ok(Number.isInteger(httpStatus)&&httpStatus>=100&&httpStatus<=599,'invalid status');
 // Never record the token or response body. The caller may inspect them in
 // confined memory, but this module only emits a fixed, non-secret allowlist.
 let tokenShape='NOT_INSPECTED';
 if(token!==undefined){
  assert.equal(service,'GOTRUE','do not supply Authorization token to recorder');
  assert.equal(typeof token,'string');
  tokenShape=JWT.test(token)?'THREE_SEGMENTS':'INVALID_SHAPE';
 }
 if(body!==undefined)assert.ok(body!==null&&typeof body==='object','invalid body');
 return Object.freeze({
  caseId,service,httpStatus,tokenShape,
  source:'CALLER_REPORTED_NOT_INDEPENDENTLY_VERIFIED',
  h1Verified:false,h2Verified:false
 });
}
function summarizeIsolatedHttpEvidence(observations){
 assert.ok(Array.isArray(observations)&&observations.length<=Object.keys(CASES).length);
 const found=new Set(),safe=[];
 for(const item of observations){
  assert.ok(item&&typeof item==='object');
  const {caseId,service,httpStatus,tokenShape,source,h1Verified,h2Verified}=item;
  assert.equal(CASES[caseId],service,'unknown case or service');
  assert.ok(!found.has(caseId),'duplicate case');found.add(caseId);
  assert.ok(Number.isInteger(httpStatus)&&httpStatus>=100&&httpStatus<=599);
  assert.ok(['NOT_INSPECTED','THREE_SEGMENTS','INVALID_SHAPE'].includes(tokenShape));
  assert.equal(source,'CALLER_REPORTED_NOT_INDEPENDENTLY_VERIFIED');
  assert.equal(h1Verified,false);assert.equal(h2Verified,false);
  safe.push(Object.freeze({caseId,service,httpStatus,tokenShape,
   source:'CALLER_REPORTED_NOT_INDEPENDENTLY_VERIFIED'}));
 }
 const missing=Object.keys(CASES).filter(x=>!found.has(x));
 return Object.freeze({
  schema:'rings-now-p2-h1-h2-observation-v1',
  observations:Object.freeze(safe),missingCases:Object.freeze(missing),
  completeCaseList:missing.length===0,
  h1Verified:false,h2Verified:false,g4Verified:false
 });
}
module.exports={CASES,recordIsolatedHttpObservation,summarizeIsolatedHttpEvidence};
