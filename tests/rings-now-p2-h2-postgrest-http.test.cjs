'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const {CASES,badSignature,tokenForCase,buildH2Request,checkH2Response,summarizeH2Observations}=require('./rings-now-p2-h2-postgrest-http.cjs');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
function jwt(sub,role='authenticated',exp=2000000200){
 const e=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const data=e({alg:'HS256'})+'.'+e({sub,role,aud:'authenticated',iat:1900000000,exp});
 return data+'.'+createHmac('sha256','OFFLINE_ONLY').update(data).digest('base64url');
}
const options={ownerA:jwt(A),ownerB:jwt(B),expired:jwt(A,'authenticated',1999999990),denied:jwt(A,'p2_no_rpc'),nowSeconds:2000000000};
const empty={status:200,body:{status:'candidate_snapshot',rows:[]}};
function row(user_id){return {id:1,user_id,activity_date:'2026-11-18',started_at:'2026-11-18T00:00:00Z',distance_km:5,deleted_at:null};}
test('fixed H2 targets; anonymous contains no Authorization header',()=>{
 assert.equal(CASES.length,7);
 for(const caseId of CASES){const r=buildH2Request({...options,caseId});
  assert.ok(r.startsWith('POST /rpc/rings_now_snapshot_candidate_v01 HTTP/1.1\r\n'));
  assert.ok(r.includes('Host: postgrest:3000'));assert.ok(r.endsWith('\r\n\r\n{}'));
 }
 assert.ok(!buildH2Request({...options,caseId:'h2_anonymous'}).includes('Authorization:'));
 assert.throws(()=>buildH2Request({...options,caseId:'invalid'}));
});
test('bad signature changes signature only, not claims',()=>{
 const a=options.ownerA.split('.'),b=badSignature(options.ownerA).split('.');
 assert.deepEqual(a.slice(0,2),b.slice(0,2));assert.notEqual(a[2],b[2]);
});
test('expired token must already be expired; no mutation of exp claim',()=>{
 assert.equal(tokenForCase({...options,caseId:'h2_expired_token'}),options.expired);
 assert.throws(()=>buildH2Request({...options,caseId:'h2_expired_token',expired:options.ownerA}));
 assert.throws(()=>buildH2Request({...options,caseId:'h2_owner_a',ownerA:options.expired}));
});
test('no-grant cannot reuse authenticated or service role',()=>{
 assert.throws(()=>buildH2Request({...options,caseId:'h2_no_rpc_grant',denied:options.ownerA}));
 assert.throws(()=>buildH2Request({...options,caseId:'h2_no_rpc_grant',denied:jwt(A,'service_role')}));
 assert.ok(buildH2Request({...options,caseId:'h2_no_rpc_grant'}).startsWith('POST'));
});
test('owner response requires exact user id and count; foreign rows rejected',()=>{
 const ok={status:200,body:{status:'candidate_snapshot',rows:[row(A)]}};
 assert.equal(checkH2Response('h2_owner_a',ok,{subject:A,expectedRows:1}).httpStatus,200);
 assert.throws(()=>checkH2Response('h2_foreign_a',{status:200,body:{status:'candidate_snapshot',rows:[row(B)]}},{subject:A,expectedRows:1}));
 assert.throws(()=>checkH2Response('h2_owner_b',empty,{subject:B,expectedRows:1}));
});
test('negative cases refuse 200 and redirects',()=>{
 for(const c of ['h2_anonymous','h2_bad_signature','h2_expired_token','h2_no_rpc_grant']){
  assert.equal(checkH2Response(c,{status:403}).httpStatus,403);
  assert.throws(()=>checkH2Response(c,empty));assert.throws(()=>checkH2Response(c,{status:302}));
 }
});
test('evidence is sanitized and never promotes a fake HTTP report into G4 proof',()=>{
 const obs=checkH2Response('h2_anonymous',{status:401,body:{token:options.ownerA,email:'private@example.invalid'}});
 const report=summarizeH2Observations([obs]);const s=JSON.stringify(report);
 assert.ok(!s.includes(options.ownerA));assert.ok(!s.includes('private@example.invalid'));
 assert.equal(report.h2Verified,false);assert.equal(report.g4Verified,false);
 assert.throws(()=>summarizeH2Observations([obs,obs]));
});
