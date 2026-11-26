'use strict';
// Dormant pure G5 contract; no I/O, no Docker, no dispatch, no proof.
const assert=require('node:assert/strict');
const {buildH2Request,checkH2Response,CASES}=require('./rings-now-p2-h2-postgrest-http.cjs');
const {parseInternalHttpResponse}=require('./rings-now-p2-docker-internal-http.cjs');
const V01='POST /rpc/rings_now_snapshot_candidate_v01 HTTP/1.1';
const V03='POST /rpc/rings_now_snapshot_candidate_v03 HTTP/1.1';
function buildV03H2Request(options){
 const raw=buildH2Request(options);
 assert.ok(raw.startsWith(V01+'\r\n'),'unexpected original request');
 return V03+raw.slice(V01.length);
}
function buildV03GetRequest(options){
 assert.ok(CASES.includes(options.caseId));
 const raw=buildV03H2Request(options);
 const headers=raw.split('\r\n\r\n')[0].split('\r\n');
 assert.equal(headers.shift(),V03);
 return ['GET /rpc/rings_now_snapshot_candidate_v03 HTTP/1.1',...headers.filter(x=>!/^Content-(Type|Length):/i.test(x)),'',''].join('\r\n');
}
function checkV03H2Response(caseId,response,expected){
 assert.ok(CASES.includes(caseId));
 if(caseId==='h2_expired_token'){
  assert.equal(response.status,401,'strict expiry requires HTTP 401');
  assert.equal(response.rpcExpiryConfirmed,true,'v03 PT401 evidence required');
 }
 if(['h2_owner_a','h2_owner_b','h2_foreign_a'].includes(caseId)){
  assert.deepEqual(Object.keys(response.body).sort(),['rows','status']);
  for(const row of response.body.rows)assert.deepEqual(Object.keys(row).sort(),['activity_date','deleted_at','distance_km','id','started_at','user_id']);
 }
 return checkH2Response(caseId,response,expected);
}
// Only inspect a bounded, framed 401 JSON response in confined memory.
// Reuse the existing parser's success JSON validation, without exposing its body.
// Never promote the normalized status or arbitrary server text to evidence.
function parseV03ExpiredResponse(wire){
 try{
  assert.equal(typeof wire,'string');
  assert.match(wire,/^HTTP\/1\.[01] 401(?: [^\r\n]*)?\r\n/);
  const normalized=wire.replace(/^HTTP\/1\.[01] 401(?: [^\r\n]*)?\r\n/,'HTTP/1.1 200 OK\r\n');
  const parsed=parseInternalHttpResponse(normalized);
  assert.equal(parsed.body.code,'PT401');
  assert.equal(parsed.body.message,'Invalid or expired token');
  assert.equal(parsed.body.details,null);
  assert.equal(parsed.body.hint,null);
  assert.deepEqual(Object.keys(parsed.body).sort(),['code','details','hint','message']);
  return Object.freeze({status:401,rpcExpiryConfirmed:true});
 }catch{throw Error('V03_RPC_EXPIRY_EVIDENCE_REJECTED');}
}
function checkV03GetResponse(caseId,response,expected){
 const result=checkV03H2Response(caseId,response,expected);
 if(['h2_owner_a','h2_owner_b','h2_foreign_a'].includes(caseId)){
  assert.deepEqual(Object.keys(response.body).sort(),['rows','status']);
  for(const row of response.body.rows)assert.deepEqual(Object.keys(row).sort(),['activity_date','deleted_at','distance_km','id','started_at','user_id']);
 }
 return result;
}
function assertNoGlobalGuard(envText){
 assert.equal(typeof envText,'string');
 assert.ok(!envText.split(/\r?\n/).some(line=>/^\s*PGRST_DB_PRE_REQUEST\s*=/.test(line)),'global guard masks v03 evidence');
}
module.exports={buildV03H2Request,buildV03GetRequest,checkV03H2Response,checkV03GetResponse,assertNoGlobalGuard,parseV03ExpiredResponse};
