'use strict';
// Pure, dormant H2 contract. No I/O, no JWT signature verification or proof.
const assert=require('node:assert/strict');
const {buildProbeRequest}=require('./rings-now-p2-docker-internal-http.cjs');
const {assertSnapshotRpcResult}=require('./rings-now-p2-loopback-transport.cjs');
const {recordIsolatedHttpObservation,summarizeIsolatedHttpEvidence}=require('./rings-now-p2-h1-h2-evidence.cjs');
const CASES=Object.freeze(['h2_anonymous','h2_owner_a','h2_foreign_a','h2_owner_b','h2_bad_signature','h2_expired_token','h2_no_rpc_grant']);
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function claimsOf(token){
 assert.match(token||'',/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
 const parts=token.split('.');assert.ok(parts.every(x=>x.length<=8192));
 const obj=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
 assert.ok(obj&&typeof obj==='object'&&!Array.isArray(obj));return obj;
}
function badSignature(token){
 claimsOf(token);const parts=token.split('.');
 parts[2]=(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);return parts.join('.');
}
function tokenForCase({caseId,ownerA,ownerB,expired,denied,nowSeconds}={}){
 assert.ok(CASES.includes(caseId));
 if(caseId==='h2_anonymous')return null;
 const token=caseId==='h2_owner_b'?ownerB:caseId==='h2_expired_token'?expired:caseId==='h2_no_rpc_grant'?denied:ownerA;
 const claims=claimsOf(token);
 assert.match(claims.sub||'',UUID);assert.ok(Number.isSafeInteger(claims.exp));
 assert.ok(Number.isSafeInteger(nowSeconds)&&nowSeconds>0);
 if(caseId==='h2_expired_token')assert.ok(claims.exp<nowSeconds,'needs genuinely expired, signature-intact token');
 else assert.ok(claims.exp>nowSeconds,'valid token must not be expired');
 if(caseId==='h2_no_rpc_grant')assert.ok(!['authenticated','anon','service_role'].includes(claims.role),'dedicated ungranted role required');
 return caseId==='h2_bad_signature'?badSignature(token):token;
}
function buildH2Request(options){
 const token=tokenForCase(options);
 if(token!==null)return buildProbeRequest(token);
 return ['POST /rpc/rings_now_snapshot_candidate_v01 HTTP/1.1','Host: postgrest:3000','Accept: application/json','Content-Type: application/json','Content-Length: 2','Connection: close','','{}'].join('\r\n');
}
function checkH2Response(caseId,response,{subject,expectedRows=0}={}){
 assert.ok(CASES.includes(caseId));assert.ok(response&&Number.isInteger(response.status));
 if(['h2_owner_a','h2_owner_b','h2_foreign_a'].includes(caseId)){
  assert.match(subject||'',UUID);
  assertSnapshotRpcResult(response,{subject,expectedCount:expectedRows});
 }else assert.ok([401,403,404].includes(response.status),'negative case must be denied');
 return recordIsolatedHttpObservation({caseId,service:'POSTGREST',httpStatus:response.status});
}
function summarizeH2Observations(observations){
 const report=summarizeIsolatedHttpEvidence(observations);
 assert.ok(report.observations.every(x=>CASES.includes(x.caseId)));
 return Object.freeze({schema:'rings-now-p2-h2-v1',observations:report.observations,
  missingCases:Object.freeze(CASES.filter(x=>!report.observations.some(y=>y.caseId===x))),
  h2Verified:false,g4Verified:false});
}
module.exports={CASES,claimsOf,badSignature,tokenForCase,buildH2Request,checkH2Response,summarizeH2Observations};
