'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const {createRealExpiryClock,waitForOriginalGoTrueJwtInExecuteStage}=
 require('./rings-now-p2-h2-real-clock-expiry-bridge.cjs');
const {captureGoTrueH1Receipt}=
 require('./rings-now-p2-h2-gotrue-expiry-receipt.cjs');
const {createHmac}=require('node:crypto');
const A='12345678-1234-4234-8234-123456789abc';
function receipt(expOffset=300){
 const now=Math.floor(Date.now()/1000);
 const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const input=encode({alg:'HS256'})+'.'+encode({
  sub:A,role:'authenticated',aud:'authenticated',iat:now-1,exp:now+expOffset
 });
 const jwt=input+'.'+createHmac('sha256','OFFLINE_ONLY').update(input).digest('base64url');
 const h={h1Verified:false,evidence:{observations:[1,2,3,4,5]}};
 Object.defineProperties(h,{privateTokens:{value:{a:jwt},enumerable:false},
  privateIds:{value:{a:A},enumerable:false}});
 return captureGoTrueH1Receipt({h1:h,observedAtSeconds:now});
}
test('real clock reads actual monotonic/wall sources and sleeps briefly',async()=>{
 const c=createRealExpiryClock({executeDeadlineMs:performance.now()+4000});
 const a=c.readMonotonicMs(),w=c.readWallSeconds();
 assert.ok(Math.abs(w-Math.floor(Date.now()/1000))<=1);
 await c.sleepMs(15);
 const b=c.readMonotonicMs();
 assert.ok(b-a>=10);
 assert.equal(c.realElapsedTimeVerified,false);
 assert.equal(c.g4Verified,false);
});
test('expired or insufficient execute budget blocks without a long sleep',async()=>{
 const rec=receipt(300);
 const result=await waitForOriginalGoTrueJwtInExecuteStage({
  receipt:rec,executeDeadlineMs:performance.now()+1000,
  cleanupReserveMs:120000,verifyReserveMs:30000
 });
 assert.equal(result.status,'BLOCKED_EXPIRY_EXCEEDS_BUDGET');
 assert.equal(result.attempted,false);
 assert.equal(result.g4Verified,false);
 assert.ok(!JSON.stringify(result).includes(rec.privateOriginalJwt));
});
test('runner bridge refuses absent and invalid reserves/deadlines',async()=>{
 const rec=receipt(300);
 for(const opts of [
  {executeDeadlineMs:performance.now()-1,cleanupReserveMs:120000,verifyReserveMs:30000},
  {executeDeadlineMs:performance.now()+5000,cleanupReserveMs:30000,verifyReserveMs:30000},
  {executeDeadlineMs:performance.now()+5000,cleanupReserveMs:0,verifyReserveMs:1},
  {executeDeadlineMs:performance.now()+5000,cleanupReserveMs:120000,verifyReserveMs:0}
 ])await assert.rejects(()=>waitForOriginalGoTrueJwtInExecuteStage({receipt:rec,...opts}));
});
test('real timer API denies arbitrary sleeps, or chunks beyond hard deadline',async()=>{
 const c=createRealExpiryClock({executeDeadlineMs:performance.now()+100});
 for(const ms of [0,-1,30001,1.5,10000])
  await assert.rejects(()=>c.sleepMs(ms));
 assert.ok(!JSON.stringify(c).includes('privateOriginalJwt'));
});
