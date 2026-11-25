'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {collectG5OverTransport}=require('./rings-now-g5-h2-sequence.cjs');
const now=1800000000;
const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
const token=(sub,role,exp)=>'e30.'+Buffer.from(JSON.stringify({sub,role,exp})).toString('base64url')+'.synthetic';
function fixture(){
 const cases=[];
 const h1={h1Verified:false,privateIds:{a,b},privateTokens:{a:token(a,'authenticated',now+100),b:token(b,'authenticated',now+100)}};
 const options={h1,nowSeconds:now,readNowSeconds:()=>now,
 seedDisposableSql:async()=>({status:'ISOLATED_TWO_OWNERS_CLI_REPORTED'}),
 provideExpiredToken:async()=>token(a,'authenticated',now-1),
 provideDeniedToken:async()=>token(a,'p2_h2_no_rpc',now+100),
 transport:async({caseId,request})=>{
 cases.push(caseId);
 assert.ok(request.includes('candidate_v02 HTTP/1.1'));
 if(caseId==='h2_expired_token')return {status:401,rpcExpiryConfirmed:true};
 if(caseId==='g5_get_owner_a')return {status:405};
 if(['h2_owner_a','h2_foreign_a','h2_owner_b'].includes(caseId))
 return {status:200,body:{status:'candidate_snapshot',rows:[{id:1,user_id:caseId==='h2_owner_b'?b:a,activity_date:'2026-11-25',started_at:'2026-11-25T00:00:00Z',distance_km:5,deleted_at:null}]}};
 return {status:403};
 }};
 return {options,cases};
}
test('synthetic complete sequence visits eight cases and does not claim proof',async()=>{
 const {options,cases}=fixture();const r=await collectG5OverTransport(options);
 assert.equal(cases.length,8);assert.equal(cases[0],'h2_expired_token');assert.equal(cases.at(-1),'g5_get_owner_a');
 assert.equal(r.rpcExpiryConfirmed,true);assert.equal(r.getRejected,true);assert.equal(r.g4Verified,false);
});
test('late expiry evidence fails closed before HTTP',async()=>{
 const {options,cases}=fixture();options.provideExpiredToken=async()=>token(a,'authenticated',now-30);
 await assert.rejects(collectG5OverTransport(options));assert.equal(cases.length,0);
});
test('upstream-only 401 and successful GET each fail closed',async()=>{
 for(const target of ['h2_expired_token','g5_get_owner_a']){
 const {options}=fixture();const original=options.transport;
 options.transport=async x=>x.caseId===target?{status:target==='h2_expired_token'?401:200}:original(x);
 await assert.rejects(collectG5OverTransport(options));
 }
});
