'use strict';
// DORMANT pure coordinator; no own clock, sleep, I/O, Docker or network.
// Injected callbacks cannot prove that wall/monotonic clocks are authentic.
const assert=require('node:assert/strict');
const {planGoTrueExpiry,releaseExpiredOriginalJwt}=
 require('./rings-now-p2-h2-gotrue-expiry-receipt.cjs');
const MAX_WAIT_MS=540000;
const CHUNK_MS=30000;
function safeMs(x,label){
 assert.ok(Number.isSafeInteger(x)&&x>=0,label+' must be nonnegative integer ms');
 return x;
}
function boundedExpiryPlan({receipt,readWallSeconds,readMonotonicMs,
 remainingExecutionMs,cleanupReserveMs,verifyReserveMs}={}){
 assert.equal(typeof readWallSeconds,'function');
 assert.equal(typeof readMonotonicMs,'function');
 const wall=readWallSeconds(),mono=readMonotonicMs();
 assert.ok(Number.isSafeInteger(wall)&&wall>=receipt?.observedAtSeconds,
  'wall time invalid or before H1 observation');
 safeMs(mono,'monotonic time');
 const available=safeMs(remainingExecutionMs,'remaining execution');
 const cleanup=safeMs(cleanupReserveMs,'cleanup reserve');
 const verify=safeMs(verifyReserveMs,'verification reserve');
 assert.ok(cleanup>verify&&available>cleanup,
  'cleanup and verification reserves required');
 assert.ok(wall<receipt.expiresAtSeconds,
  'already expired before monotonic observation cannot prove elapsed waiting');
 const requiredMs=(receipt.expiresAtSeconds+1-wall)*1000;
 assert.ok(Number.isSafeInteger(requiredMs)&&requiredMs>0);
 const permittedMs=Math.min(MAX_WAIT_MS,available-cleanup);
 const plan=planGoTrueExpiry({
  receipt,nowSeconds:wall,budgetSeconds:Math.floor(permittedMs/1000)
 });
 const status=requiredMs<=permittedMs&&plan.status==='WAIT_WITHIN_REMAINING_BUDGET'
  ?'WAIT_APPROVED_BY_BUDGET_NOT_REALTIME_PROOF'
  :'BLOCKED_EXPIRY_EXCEEDS_BUDGET';
 return Object.freeze({status,requiredMs,permittedMs,observedWallSeconds:wall,
  observedMonotonicMs:mono,cleanupReserveMs:cleanup,verifyReserveMs:verify,
  realElapsedTimeVerified:false,g4Verified:false});
}
async function awaitOriginalGoTrueExpiry({
 receipt,readWallSeconds,readMonotonicMs,sleepMs,
 remainingExecutionMs,cleanupReserveMs,verifyReserveMs
}={}){
 assert.equal(typeof sleepMs,'function','explicit bounded waiting callback required');
 const plan=boundedExpiryPlan({receipt,readWallSeconds,readMonotonicMs,
  remainingExecutionMs,cleanupReserveMs,verifyReserveMs});
 if(plan.status!=='WAIT_APPROVED_BY_BUDGET_NOT_REALTIME_PROOF')
  return Object.freeze({status:'BLOCKED_EXPIRY_EXCEEDS_BUDGET',
   attempted:false,realElapsedTimeVerified:false,g4Verified:false});
 let spent=0,lastMono=plan.observedMonotonicMs,lastWall=plan.observedWallSeconds;
 // Limit both total requested waiting and number of calls. Every step checks
 // real monotonic readings and wall regressions. No clock manipulation.
 for(let step=0;step<20&&spent<plan.requiredMs;step++){
  const chunk=Math.min(CHUNK_MS,plan.requiredMs-spent);
  assert.ok(chunk>0&&spent+chunk<=plan.permittedMs);
  await sleepMs(chunk);
  spent+=chunk;
  const mono=readMonotonicMs(),wall=readWallSeconds();
  safeMs(mono,'monotonic time');
  assert.ok(mono>=lastMono,'monotonic clock reversed');
  assert.ok(Number.isSafeInteger(wall)&&wall>=lastWall,'wall clock reversed');
  assert.ok(mono-plan.observedMonotonicMs<=plan.permittedMs,
   'elapsed monotonic time exhausted the cleanup reserve');
  lastMono=mono;lastWall=wall;
 }
 assert.equal(spent,plan.requiredMs,'wait was incomplete');
 const measured=lastMono-plan.observedMonotonicMs;
 assert.ok(measured>=plan.requiredMs,'monotonic elapsed time insufficient');
 assert.ok(lastWall>receipt.expiresAtSeconds,'wall clock expiry not reached');
 const released=releaseExpiredOriginalJwt({
  receipt,observedAtSeconds:lastWall
 });
 const result={status:'ORIGINAL_JWT_RELEASED_AFTER_INJECTED_CLOCKS_NOT_G4_PROOF',
  waitedMs:spent,measuredMonotonicMs:measured,
  originalTokenPreserved:true,signatureVerified:false,
  realElapsedTimeVerified:false,g4Verified:false};
 Object.defineProperty(result,'privateExpiredJwt',{
  value:released.privateExpiredJwt,enumerable:false
 });
 return Object.freeze(result);
}
module.exports={boundedExpiryPlan,awaitOriginalGoTrueExpiry,MAX_WAIT_MS,CHUNK_MS};
