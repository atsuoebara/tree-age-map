'use strict';
// H1 GoTrue HTTP-only candidate, no I/O on import and no network on construction.
// Actual transport must be the audited internal Docker adapter in a future runner PR.
const assert=require('node:assert/strict');
const {recordIsolatedHttpObservation,summarizeIsolatedHttpEvidence}=
 require('./rings-now-p2-h1-h2-evidence.cjs');
const ORDER=Object.freeze(['h1_signup_a','h1_signin_a','h1_signup_b','h1_signin_b','h1_bad_password']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JWT=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const MAIL=/^rn-p2-[a-f0-9]{24}-(a|b)@example\.invalid$/;
const PW=/^[a-f0-9]{64}$/;
function buildGoTrueRequest(caseId,users){
 assert.ok(ORDER.includes(caseId),'unapproved H1 case');
 assert.ok(users&&typeof users==='object');
 const who=caseId.endsWith('_b')?'b':'a';
 const u=users[who];
 assert.ok(u&&MAIL.test(u.email)&&u.email.endsWith('-'+who+'@example.invalid'));
 assert.match(u.password||'',PW);
 const bad=caseId==='h1_bad_password';
 const path=caseId.startsWith('h1_signup_')?'/signup':'/token?grant_type=password';
 const body=JSON.stringify({email:u.email,password:bad?'0'.repeat(64):u.password});
 const request=[
  'POST '+path+' HTTP/1.1','Host: gotrue:9999',
  'Content-Type: application/json','Accept: application/json',
  'Content-Length: '+Buffer.byteLength(body),'Connection: close','',''+body
 ].join('\r\n');
 assert.ok(Buffer.byteLength(request)<=2048);
 return request;
}
function inspectGoTrueResponse(caseId,response){
 assert.ok(ORDER.includes(caseId));
 assert.ok(response&&typeof response==='object');
 const status=response.status;
 assert.ok(Number.isInteger(status)&&status>=100&&status<=599);
 const isSignup=caseId.startsWith('h1_signup_');
 const isBad=caseId==='h1_bad_password';
 if(isBad)assert.ok(status===400||status===401||status===422,'bad password must be denied');
 else if(isSignup)assert.ok(status===200||status===201,'signup must succeed');
 else assert.equal(status,200,'signin must succeed');
 let token;
 let userId;
 if(!isBad&&status===200){
  const body=response.body;
  assert.ok(body&&typeof body==='object'&&!Array.isArray(body));
  const user=body.user||body;
  if(user.id!==undefined){assert.match(user.id,UUID);userId=user.id;}
  if(!isSignup){
   token=body.access_token;
   assert.match(token||'',JWT);
   assert.ok(userId,'signin user ID must exist');
   const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));
   assert.equal(claims.sub,userId);
   assert.equal(claims.role,'authenticated');
   assert.equal(claims.aud,'authenticated');
   assert.ok(Number.isSafeInteger(claims.exp)&&Number.isSafeInteger(claims.iat)&&claims.exp>claims.iat);
  }
 }
 const observation=recordIsolatedHttpObservation({
  caseId,service:'GOTRUE',httpStatus:status,token
 });
 return Object.freeze({observation,token:token||null,userId:userId||null,
  provenance:'GOTRUE_HTTP_RESPONSE_CLAIM_NOT_SIGNATURE_PROVEN'});
}
async function collectH1OverTransport({transport,users}={}){
 assert.equal(typeof transport,'function');
 const observations=[],tokens={},ids={};
 for(const caseId of ORDER){
  const request=buildGoTrueRequest(caseId,users);
  // Transport MUST be the audited run-owned private Docker-network path.
  // No response body, request, password or JWT appears in evidence output.
  const response=await transport({caseId,request});
  const checked=inspectGoTrueResponse(caseId,response);
  observations.push(checked.observation);
  if(checked.token){
   const who=caseId.endsWith('_a')?'a':'b';
   tokens[who]=checked.token;
   ids[who]=checked.userId;
  }
 }
 assert.ok(tokens.a&&tokens.b&&ids.a&&ids.b&&ids.a!==ids.b,'independent users required');
 return Object.freeze({
  evidence:summarizeIsolatedHttpEvidence(observations),
  // SECRET: never JSON stringify or log this return object. Use only to
  // prepare private PostgREST requests, then release.
  privateTokens:Object.freeze(tokens),
  privateIds:Object.freeze(ids),
  h1Verified:false
 });
}
module.exports={ORDER,buildGoTrueRequest,inspectGoTrueResponse,collectH1OverTransport};
