'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const {CASES}=require('./rings-now-p2-h2-postgrest-http.cjs');
const {validateH1,collectH2OverTransport}=require('./rings-now-p2-h2-sequence.cjs');
const A='12345678-1234-4234-8234-123456789abc';
const B='87654321-4321-4321-8321-abcdef123456';
function jwt(sub,role='authenticated',exp=2000000200){
 const e=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const p=e({alg:'HS256'})+'.'+e({sub,role,aud:'authenticated',iat:1900000000,exp});
 return p+'.'+createHmac('sha256','OFFLINE_TEST_ONLY').update(p).digest('base64url');
}
function h1(){
 const x={h1Verified:false};
 Object.defineProperties(x,{
  privateTokens:{value:{a:jwt(A),b:jwt(B)},enumerable:false},
  privateIds:{value:{a:A,b:B},enumerable:false}
 });return x;
}
const row=(id,user_id)=>({id,user_id,activity_date:'2026-11-18',started_at:'2026-11-18T00:00:00Z',distance_km:5,deleted_at:null});
function fixture(overrides={}){
 const events=[];
 const args={
  h1:h1(),nowSeconds:2000000000,
  seedDisposableSql:async({sql,ownerA,ownerB})=>{
   events.push('seed');assert.match(sql,/CREATE ROLE p2_h2_no_rpc/);
   assert.ok(sql.includes("'"+ownerA+"'::uuid"));assert.ok(sql.includes("'"+ownerB+"'::uuid"));
   return {status:'ISOLATED_TWO_OWNERS_CLI_REPORTED'};
  },
  provideExpiredToken:async()=>{events.push('expired');return jwt(A,'authenticated',1999999990);},
  provideDeniedToken:async()=>{events.push('denied');return jwt(A,'p2_h2_no_rpc');},
  transport:async({caseId,request})=>{
   events.push(caseId);
   assert.ok(request.startsWith('POST /rpc/rings_now_snapshot_candidate_v01 HTTP/1.1'));
   if(['h2_owner_a','h2_foreign_a','h2_owner_b'].includes(caseId))
    return {status:200,body:{status:'candidate_snapshot',
     rows:[row(caseId==='h2_owner_b'?2:1,caseId==='h2_owner_b'?B:A)]}};
   return {status:403};
  },
  ...overrides
 };
 return {args,events};
}
test('seven fixed H2 cases run in order AFTER isolated seeding and token prerequisites',async()=>{
 const x=fixture(),result=await collectH2OverTransport(x.args);
 assert.deepEqual(x.events,['seed','expired','denied',...CASES]);
 assert.equal(result.summary.observations.length,7);
 assert.equal(result.h2Verified,false);assert.equal(result.g4Verified,false);
 assert.ok(!JSON.stringify(result).includes(jwt(A)));
 assert.ok(!JSON.stringify(result).includes('OFFLINE_TEST_ONLY'));
});
test('H1 identity mismatch and expired login fail before any external callback',async()=>{
 for(const edit of [
  o=>o.privateIds.a=B,
  o=>o.privateTokens.a=jwt(A,'authenticated',1999999990),
  o=>o.privateTokens.b=jwt(A)
 ]){
  const h=h1(),mutable={h1Verified:false,privateTokens:{...h.privateTokens},
   privateIds:{...h.privateIds}};
  edit(mutable);
  const x=fixture({h1:mutable});
  await assert.rejects(()=>collectH2OverTransport(x.args));
  assert.equal(x.events.length,0);
 }
});
test('missing seed and wrong expiry or role block every PostgREST request',async()=>{
 for(const patch of [
  {seedDisposableSql:async()=>({status:'FAIL'})},
  {provideExpiredToken:async()=>jwt(A)},
  {provideExpiredToken:async()=>jwt(A,'service_role',1999999990)},
  {provideExpiredToken:async()=>jwt(B,'authenticated',1999999990)},
  {provideDeniedToken:async()=>jwt(A)},
  {provideDeniedToken:async()=>jwt(A,'service_role')},
  {provideDeniedToken:async()=>jwt(A,'p2_h2_no_rpc',1999999990)},
  {provideDeniedToken:async()=>jwt(B,'p2_h2_no_rpc')}
 ]){
  const x=fixture(patch);
  await assert.rejects(()=>collectH2OverTransport(x.args));
  assert.equal(x.events.some(s=>s.startsWith('h2_')),false);
 }
});
test('foreign row leak or wrong count causes H2 failure',async()=>{
 const x=fixture({transport:async({caseId})=>caseId==='h2_owner_a'
  ?{status:200,body:{status:'candidate_snapshot',rows:[row(1,B)]}}:{status:403}});
 await assert.rejects(()=>collectH2OverTransport(x.args));
});
test('negative-case HTTP 200 cannot pass',async()=>{
 const x=fixture({transport:async()=>({status:200,body:{status:'candidate_snapshot',rows:[]}})});
 await assert.rejects(()=>collectH2OverTransport(x.args));
});
test('callbacks mandatory; pure validation generates SQL without running it',async()=>{
 const x=fixture();
 await assert.rejects(()=>collectH2OverTransport({h1:x.args.h1,nowSeconds:2000000000}));
 assert.ok(validateH1(h1(),2000000000).seedSql.includes('H2_REQUIRES_EMPTY_DISPOSABLE_TABLE'));
});

test('H2 diagnostic identifies seed and each response without retaining raw body',async()=>{
 const marks=[];const mark=(...x)=>marks.push(x);
 const seed=fixture({mark,seedDisposableSql:async()=>{throw Error('private');}});
 await assert.rejects(()=>collectH2OverTransport(seed.args));assert.deepEqual(marks.at(-1),['SEED']);
 for(const target of CASES){marks.length=0;const x=fixture();const original=x.args.transport;x.args.mark=mark;x.args.transport=async q=>q.caseId===target?{status:500,body:{secret:'private'}}:original(q);
 await assert.rejects(()=>collectH2OverTransport(x.args));assert.deepEqual(marks.at(-1),['RESPONSE',target,500]);assert.ok(!JSON.stringify(marks).includes('private'));}
 const {safeH2Diagnostic}=require('./rings-now-p2-h2-diagnostic.cjs');assert.equal(safeH2Diagnostic({phase:'private'}),null);assert.deepEqual(safeH2Diagnostic({phase:'RESPONSE',caseId:'private',httpStatus:'secret'}),{phase:'RESPONSE',caseId:null,httpStatus:null});
});
