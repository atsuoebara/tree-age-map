'use strict';
// DORMANT real-clock bridge. No timer, disk or Docker activity on import.
// This is NOT called by any runner until separately reviewed and authorized.
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const {setTimeout:delay}=require('node:timers/promises');
const {awaitOriginalGoTrueExpiry,CHUNK_MS}=
 require('./rings-now-p2-h2-gotrue-monotonic-wait.cjs');
function validFiniteMs(n){return typeof n==='number'&&Number.isFinite(n)&&n>=0;}
function createRealExpiryClock({executeDeadlineMs}={}){
 assert.ok(validFiniteMs(executeDeadlineMs),'explicit monotonic execution deadline required');
 const start=performance.now();
 assert.ok(executeDeadlineMs>start,'execution deadline already passed');
 const readMonotonicMs=()=>performance.now();
 const readWallSeconds=()=>Math.floor(Date.now()/1000);
 async function sleepMs(ms){
  assert.ok(Number.isSafeInteger(ms)&&ms>0&&ms<=CHUNK_MS,'bounded sleep only');
  const before=readMonotonicMs();
  assert.ok(before<executeDeadlineMs&&ms<=executeDeadlineMs-before,
   'sleep would trespass execution deadline');
  // Actual Node timer, no clock adjustment, no synthetic promise resolution.
  await delay(ms,undefined,{ref:true});
  assert.ok(readMonotonicMs()<=executeDeadlineMs,
   'sleep overshot execution deadline; no token release');
 }
 return Object.freeze({readMonotonicMs,readWallSeconds,sleepMs,
  source:'NODE_PERFORMANCE_AND_DATE_AND_TIMER',executeDeadlineMs,
  realElapsedTimeVerified:false,g4Verified:false});
}
async function waitForOriginalGoTrueJwtInExecuteStage({
 receipt,executeDeadlineMs,cleanupReserveMs,verifyReserveMs
}={}){
 // The parent shared-budget coordinator already carved out cleanup reserve
 // BEFORE entering execute. Do not subtract cleanup a second time.
 // Existing pure wait planner subtracts its cleanupReserveMs parameter, so
 // include the same reserve once in the supplied total remaining budget.
 assert.ok(Number.isSafeInteger(cleanupReserveMs)&&cleanupReserveMs>0);
 assert.ok(Number.isSafeInteger(verifyReserveMs)&&verifyReserveMs>0&&
  verifyReserveMs<cleanupReserveMs);
 const clock=createRealExpiryClock({executeDeadlineMs});
 const remaining=Math.floor(executeDeadlineMs-clock.readMonotonicMs());
 assert.ok(Number.isSafeInteger(remaining)&&remaining>0,'no execute stage budget');
 const total=remaining+cleanupReserveMs;
 assert.ok(Number.isSafeInteger(total)&&total>cleanupReserveMs);
 const outcome=await awaitOriginalGoTrueExpiry({
  receipt,readWallSeconds:clock.readWallSeconds,
  readMonotonicMs:clock.readMonotonicMs,sleepMs:clock.sleepMs,
  remainingExecutionMs:total,cleanupReserveMs,verifyReserveMs
 });
 // Signature, secure time provenance, and PostgREST HTTP denial are NOT
 // independently proven here. Do not upgrade existing flags.
 assert.equal(outcome.g4Verified,false);
 assert.equal(outcome.realElapsedTimeVerified,false);
 assert.ok(clock.readMonotonicMs()<=executeDeadlineMs,'execute stage overran');
 return outcome;
}
module.exports={createRealExpiryClock,waitForOriginalGoTrueJwtInExecuteStage};
