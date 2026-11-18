'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {CASES,recordIsolatedHttpObservation,summarizeIsolatedHttpEvidence}=
 require('./rings-now-p2-h1-h2-evidence.cjs');
const fakeJwt='eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJub3QtdmVyaWZpZWQifQ.fake';
test('token, user data and response bodies never appear in evidence',()=>{
 const email='secret@example.test',password='not-a-password-to-log';
 const observation=recordIsolatedHttpObservation({
  caseId:'h1_signup_a',service:'GOTRUE',httpStatus:200,token:fakeJwt,
  body:{access_token:fakeJwt,email,password,user:{email}}});
 const text=JSON.stringify(summarizeIsolatedHttpEvidence([observation]));
 for(const secret of [fakeJwt,email,password,'access_token'])assert.equal(text.includes(secret),false);
 assert.equal(observation.tokenShape,'THREE_SEGMENTS');
 assert.equal(observation.h1Verified,false);
});
test('foreign, anonymous and bad-signature cases cannot be forged as proof',()=>{
 const cases=['h2_anonymous','h2_foreign_a','h2_bad_signature'];
 const report=summarizeIsolatedHttpEvidence(cases.map(caseId=>
  recordIsolatedHttpObservation({caseId,service:'POSTGREST',httpStatus:200})));
 assert.equal(report.h2Verified,false);assert.equal(report.completeCaseList,false);
 assert.ok(report.missingCases.includes('h2_owner_a'));
});
test('even complete synthetic cases cannot claim H1/H2/G4 verification',()=>{
 const all=Object.entries(CASES).map(([caseId,service])=>
  recordIsolatedHttpObservation({caseId,service,httpStatus:200}));
 const report=summarizeIsolatedHttpEvidence(all);
 assert.equal(report.completeCaseList,true);
 assert.equal(report.h1Verified,false);assert.equal(report.h2Verified,false);
 assert.equal(report.g4Verified,false);
});
test('unknown cases, mismatched services and duplicate observations are rejected',()=>{
 assert.throws(()=>recordIsolatedHttpObservation({caseId:'h1_fake',service:'GOTRUE',httpStatus:200}));
 assert.throws(()=>recordIsolatedHttpObservation({caseId:'h1_signup_a',service:'POSTGREST',httpStatus:200}));
 assert.throws(()=>recordIsolatedHttpObservation({caseId:'h2_owner_a',service:'POSTGREST',httpStatus:200,token:fakeJwt}));
 const one=recordIsolatedHttpObservation({caseId:'h2_owner_a',service:'POSTGREST',httpStatus:200});
 assert.throws(()=>summarizeIsolatedHttpEvidence([one,one]));
});
test('untrusted records are allowlisted and cannot inject proof or extra fields',()=>{
 const observation=recordIsolatedHttpObservation({caseId:'h1_signin_b',service:'GOTRUE',httpStatus:200});
 const extra={...observation,authorization:'Bearer secret',secret:'PRIVATE_SENTINEL_3F8'};
 const report=summarizeIsolatedHttpEvidence([extra]);
 assert.ok(!JSON.stringify(report).includes('PRIVATE_SENTINEL_3F8'));
 assert.ok(!JSON.stringify(report).includes('Bearer'));
 assert.throws(()=>summarizeIsolatedHttpEvidence([{...observation,h1Verified:true}]));
 assert.throws(()=>summarizeIsolatedHttpEvidence([{...observation,source:'PROVEN'}]));
});
