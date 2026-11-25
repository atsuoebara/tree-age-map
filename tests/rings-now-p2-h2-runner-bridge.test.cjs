'use strict';
// All transport callbacks below are offline stubs. No Docker, SQL or network.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const {refreshOriginalOwners}=require('./rings-now-p2-h2-runner-bridge.cjs');
const {collectH2OverTransport}=require('./rings-now-p2-h2-sequence.cjs');
const A='12345678-1234-4234-8234-123456789abc';
const B='87654321-4321-4321-8321-abcdef123456';
function jwt(sub,exp,role='authenticated'){
 const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const bytes=enc({alg:'HS256'})+'.'+enc({
  sub,role,aud:'authenticated',iat:1999999900,exp
 });
 return bytes+'.'+createHmac('sha256','OFFLINE_ONLY').update(bytes).digest('base64url');
}
const users={
 a:{email:'rn-p2-'+'a'.repeat(24)+'-a@example.invalid',password:'a'.repeat(64)},
 b:{email:'rn-p2-'+'b'.repeat(24)+'-b@example.invalid',password:'b'.repeat(64)}
};
test('refresh performs only signin A/B and privately preserves original IDs',async()=>{
 const calls=[];
 const h1=await refreshOriginalOwners({users,transport:async({caseId,request})=>{
  calls.push(caseId);
  assert.ok(request.startsWith('POST /token?grant_type=password HTTP/1.1'));
  const who=caseId.endsWith('_a')?'a':'b',id=who==='a'?A:B;
  return {status:200,body:{access_token:jwt(id,2000000200),user:{id}}};
 }});
 assert.deepEqual(calls,['h1_signin_a','h1_signin_b']);
 assert.equal(h1.privateIds.a,A);assert.equal(h1.privateIds.b,B);
 assert.equal(h1.h1Verified,false);
 assert.ok(!JSON.stringify(h1).includes(h1.privateTokens.a));
});
test('refresh rejects failed signin without generating signup requests',async()=>{
 const calls=[];
 await assert.rejects(()=>refreshOriginalOwners({users,transport:async({caseId})=>{
  calls.push(caseId);return {status:401};
 }}));
 assert.deepEqual(calls,['h1_signin_a']);
});
function fresh(){
 const x={h1Verified:false};
 Object.defineProperties(x,{
  privateTokens:{value:{a:jwt(A,2000000200),b:jwt(B,2000000200)},enumerable:false},
  privateIds:{value:{a:A,b:B},enumerable:false}
 });return x;
}
function scenario(readNowSeconds){
 let requests=0;
 const args={h1:fresh(),nowSeconds:2000000000,readNowSeconds,
  seedDisposableSql:async()=>({status:'ISOLATED_TWO_OWNERS_CLI_REPORTED'}),
  provideExpiredToken:async()=>jwt(A,1999999999),
  provideDeniedToken:async()=>jwt(A,2000000200,'p2_h2_no_rpc'),
  transport:async()=>{requests++;return {status:403};}
 };
 return {args,requests:()=>requests};
}
test('clock regression rejects H2 transport before the first HTTP request',async()=>{
 const x=scenario(()=>1999999999);
 await assert.rejects(()=>collectH2OverTransport(x.args));
 assert.equal(x.requests(),0);
});
test('late expiry of refreshed JWT rejects further H2 transport',async()=>{
 let count=0;
 const x=scenario(()=>++count===1?2000000000:2000000200);
 await assert.rejects(()=>collectH2OverTransport(x.args));
 assert.equal(x.requests(),1);
});
test('malformed current wall clock rejects before any H2 HTTP',async()=>{
 const x=scenario(()=>NaN);
 await assert.rejects(()=>collectH2OverTransport(x.args));
 assert.equal(x.requests(),0);
});

test('refresh marks failing A/B response without raw body',async()=>{
 const marks=[];await assert.rejects(()=>refreshOriginalOwners({users,mark:(...x)=>marks.push(x),transport:async()=>({status:500,body:{secret:'private'}})}));assert.deepEqual(marks.at(-1),['RESPONSE','h1_signin_a',500]);assert.ok(!JSON.stringify(marks).includes('private'));
});
