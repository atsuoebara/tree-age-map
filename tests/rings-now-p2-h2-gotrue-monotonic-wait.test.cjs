'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const {captureGoTrueH1Receipt}=
 require('./rings-now-p2-h2-gotrue-expiry-receipt.cjs');
const {boundedExpiryPlan,awaitOriginalGoTrueExpiry,MAX_WAIT_MS}=
 require('./rings-now-p2-h2-gotrue-monotonic-wait.cjs');
const A='12345678-1234-4234-8234-123456789abc';
const START=2000000000;
function jwt(){
 const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const raw=enc({alg:'HS256'})+'.'+enc({
  sub:A,role:'authenticated',aud:'authenticated',
  iat:START-1,exp:START+60
 });
 return raw+'.'+createHmac('sha256','TEST_NO_REAL_IO').update(raw).digest('base64url');
}
function receipt(){
 const token=jwt(),h={h1Verified:false,
  evidence:{observations:[1,2,3,4,5]}};
 Object.defineProperties(h,{privateTokens:{value:{a:token},enumerable:false},
  privateIds:{value:{a:A},enumerable:false}});
 return captureGoTrueH1Receipt({h1:h,observedAtSeconds:START});
}
function fakeTime({wall=START,mono=1000000,shortMs=0,wallFrozen=false,
 monoFrozen=false,reverse=false}={}){
 let elapsed=0;
 const logs=[];
 return {
  logs,clock:{
   readWallSeconds:()=>wall,
   readMonotonicMs:()=>mono,
   sleepMs:async ms=>{
    logs.push(ms);elapsed+=ms;
    if(!monoFrozen)mono+=(reverse?-ms:ms-shortMs);
    if(!wallFrozen)wall=START+Math.floor(elapsed/1000);
   }
  }
 };
}
const args=(x,more={})=>({
 receipt:receipt(),...x.clock,remainingExecutionMs:180000,
 cleanupReserveMs:60000,verifyReserveMs:10000,...more
});
test('one original token after strict exp+1 and >=61s monotonic time',async()=>{
 const x=fakeTime();
 const result=await awaitOriginalGoTrueExpiry(args(x));
 assert.equal(result.status,'ORIGINAL_JWT_RELEASED_AFTER_INJECTED_CLOCKS_NOT_G4_PROOF');
 assert.deepEqual(x.logs,[30000,30000,1000]);
 assert.equal(result.waitedMs,61000);
 assert.equal(result.measuredMonotonicMs,61000);
 assert.equal(result.privateExpiredJwt,jwt());
 assert.ok(!JSON.stringify(result).includes(jwt()));
 assert.equal(result.realElapsedTimeVerified,false);
 assert.equal(result.g4Verified,false);
});
test('insufficient execution time fails before sleeping or releasing token',async()=>{
 const x=fakeTime();
 const result=await awaitOriginalGoTrueExpiry(args(x,{remainingExecutionMs:120000,
  cleanupReserveMs:60000}));
 assert.equal(result.status,'BLOCKED_EXPIRY_EXCEEDS_BUDGET');
 assert.equal(result.attempted,false);
 assert.deepEqual(x.logs,[]);
});
test('wall clock forged forward without monotonic elapsed cannot release',async()=>{
 const x=fakeTime({monoFrozen:true});
 await assert.rejects(()=>awaitOriginalGoTrueExpiry(args(x)),/monotonic elapsed time insufficient/);
 assert.deepEqual(x.logs,[30000,30000,1000]);
});
test('monotonic time alone cannot bypass frozen wall expiry',async()=>{
 const x=fakeTime({wallFrozen:true});
 await assert.rejects(()=>awaitOriginalGoTrueExpiry(args(x)),/wall clock expiry not reached/);
});
test('clock reversals and short sleep must fail closed',async()=>{
 const x=fakeTime({reverse:true});
 await assert.rejects(()=>awaitOriginalGoTrueExpiry(args(x)),/monotonic clock reversed/);
 const y=fakeTime({shortMs:100});
 await assert.rejects(()=>awaitOriginalGoTrueExpiry(args(y)),/monotonic elapsed time insufficient/);
});
test('reject missing reserve, oversized wait, already expired before baseline',()=>{
 const x=fakeTime();
 const p=boundedExpiryPlan(args(x));
 assert.equal(p.requiredMs,61000);
 assert.equal(p.realElapsedTimeVerified,false);
 assert.equal(MAX_WAIT_MS,540000);
 for(const patch of [{cleanupReserveMs:0,verifyReserveMs:0},
  {cleanupReserveMs:10000,verifyReserveMs:10000},
  {remainingExecutionMs:50000},
  {readWallSeconds:()=>START+61},
  {readWallSeconds:()=>START-1}]){
  assert.throws(()=>boundedExpiryPlan(args(x,patch)));
 }
});
test('no sleep callback or arbitrary fake end timestamp is admissible',async()=>{
 const x=fakeTime();
 await assert.rejects(()=>awaitOriginalGoTrueExpiry(args(x,{sleepMs:null})));
 assert.equal(x.logs.length,0);
});
