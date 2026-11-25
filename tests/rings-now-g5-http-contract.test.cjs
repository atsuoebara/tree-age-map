'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildG5H2Request,buildG5GetRequest,checkG5H2Response,checkG5GetResponse,assertNoGlobalGuard,parseG5ExpiredResponse}=require('./rings-now-g5-http-contract.cjs');
const {buildH2Request,CASES}=require('./rings-now-p2-h2-postgrest-http.cjs');
const nowSeconds=1800000000;
const subject='00000000-0000-4000-8000-000000000001';
const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const token=(exp,role='authenticated',sub=subject)=>encode({alg:'HS256'})+'.'+encode({sub,exp,role})+'.synthetic';
const options={ownerA:token(nowSeconds+100),ownerB:token(nowSeconds+100,'authenticated','00000000-0000-4000-8000-000000000002'),expired:token(nowSeconds-1),denied:token(nowSeconds+100,'p2_h2_no_rpc'),nowSeconds};
test('all seven fixed H2 envelopes change only the endpoint',()=>{
 for(const caseId of CASES){
  const o={...options,caseId};
  const old=buildH2Request(o),next=buildG5H2Request(o);
  assert.equal(next,old.replace('candidate_v01 HTTP/1.1','candidate_v02 HTTP/1.1'));
 }
});
test('GET uses fixed case credentials, no body or body headers',()=>{
 const req=buildG5GetRequest({...options,caseId:'h2_owner_a'});
 assert.ok(req.startsWith('GET /rpc/rings_now_snapshot_candidate_v02 HTTP/1.1\r\n'));
 assert.ok(req.includes('Authorization: Bearer '+options.ownerA+'\r\n'));
 assert.ok(req.endsWith('\r\n\r\n'));
 assert.doesNotMatch(req,/Content-(Type|Length):/i);
 assert.doesNotMatch(buildG5GetRequest({...options,caseId:'h2_anonymous'}),/Authorization:/i);
 for(const caseId of CASES)assert.ok(buildG5GetRequest({...options,caseId}).startsWith('GET '));
});
test('HTTP status checks reject false success',()=>{
 for(const status of [200,405,500])assert.throws(()=>checkG5GetResponse('h2_anonymous',{status}));
 checkG5GetResponse('h2_anonymous',{status:401});
 checkG5GetResponse('h2_expired_token',{status:401,rpcExpiryConfirmed:true});
 assert.throws(()=>checkG5GetResponse('h2_expired_token',{status:401}));
 checkG5H2Response('h2_expired_token',{status:401,rpcExpiryConfirmed:true});
 assert.throws(()=>checkG5H2Response('h2_expired_token',{status:401}));
 for(const status of [200,403,404,500])assert.throws(()=>checkG5H2Response('h2_expired_token',{status}));
});
test('global environment guard must be absent',()=>{
 assertNoGlobalGuard('PGRST_DB_SCHEMAS=public\n');
 for(const env of ['PGRST_DB_PRE_REQUEST=p2_guard.strict_jwt_expiry','PGRST_DB_PRE_REQUEST=','  PGRST_DB_PRE_REQUEST =x\r\n'])assert.throws(()=>assertNoGlobalGuard(env));
});

test('only exact framed PT401 is accepted and no body is retained',()=>{
 const body={code:'PT401',message:'Invalid or expired token',details:null,hint:null};
 const wire=(payload,status=401)=>{
  const json=JSON.stringify(payload);
  return 'HTTP/1.1 '+status+' Response\r\nContent-Type: application/json\r\nContent-Length: '+Buffer.byteLength(json)+'\r\n\r\n'+json;
 };
 assert.deepEqual(parseG5ExpiredResponse(wire(body)),{status:401,rpcExpiryConfirmed:true});
 for(const bad of [wire({...body,code:'PGRST301'}),wire({...body,message:'different'}),wire({...body,details:'unexpected'}),wire(body,200),wire(body).slice(0,-1),wire({...body,extra:true})]){
  assert.throws(()=>parseG5ExpiredResponse(bad),/G5_RPC_EXPIRY_EVIDENCE_REJECTED/);
 }
});
