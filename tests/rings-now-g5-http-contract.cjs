'use strict';
// Dormant pure G5 contract; no I/O, no Docker, no dispatch, no proof.
const assert=require('node:assert/strict');
const {buildH2Request,checkH2Response,CASES}=require('./rings-now-p2-h2-postgrest-http.cjs');
const V01='POST /rpc/rings_now_snapshot_candidate_v01 HTTP/1.1';
const V02='POST /rpc/rings_now_snapshot_candidate_v02 HTTP/1.1';
function buildG5H2Request(options){
 const raw=buildH2Request(options);
 assert.ok(raw.startsWith(V01+'\r\n'),'unexpected original request');
 return V02+raw.slice(V01.length);
}
function buildG5GetRequest(options){
 assert.equal(options.caseId,'h2_owner_a');
 const raw=buildG5H2Request(options);
 const headers=raw.split('\r\n\r\n')[0].split('\r\n');
 assert.equal(headers.shift(),V02);
 return ['GET /rpc/rings_now_snapshot_candidate_v02 HTTP/1.1',...headers.filter(x=>!/^Content-(Type|Length):/i.test(x)),'',''].join('\r\n');
}
function checkG5H2Response(caseId,response,expected){
 assert.ok(CASES.includes(caseId));
 if(caseId==='h2_expired_token')assert.equal(response.status,401,'strict expiry requires HTTP 401');
 return checkH2Response(caseId,response,expected);
}
function checkG5GetResponse(response){
 assert.equal(response.status,405,'VOLATILE RPC must reject GET');
}
function assertNoGlobalGuard(envText){
 assert.equal(typeof envText,'string');
 assert.ok(!envText.split(/\r?\n/).some(line=>/^\s*PGRST_DB_PRE_REQUEST\s*=/.test(line)),'global guard masks v02 evidence');
}
module.exports={buildG5H2Request,buildG5GetRequest,checkG5H2Response,checkG5GetResponse,assertNoGlobalGuard};
