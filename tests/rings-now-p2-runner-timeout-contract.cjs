'use strict';
// Offline, dependency-injected timeout contract for an isolated FUTURE P2 runner.
// Does not start any process, request, database, Docker, Actions or network.
// A Promise timeout cannot kill an uncooperative operation or process.
const assert=require('node:assert/strict');
const {runWithVerifiedCleanup}=require('./rings-now-p2-cleanup-contract.cjs');
const MAX_DEADLINE_MS=600000;
function isValidDeadline(ms) {
 return Number.isSafeInteger(ms) && ms>0 && ms<=MAX_DEADLINE_MS;
}
async function runWithExecutionDeadline({execute,cleanup,verifyCleanup,deadlineMs}) {
 assert.equal(typeof execute,'function');
 assert.equal(typeof cleanup,'function');
 assert.equal(typeof verifyCleanup,'function');
 assert.ok(isValidDeadline(deadlineMs),'deadline must be 1..600000 ms');
 const controller=new AbortController();
 let timer;
 let expired=false;
 let completed=false;
 // Promise.race reports synthetic operation status; it DOES NOT terminate work.
 const run=async()=>{
  const op=Promise.resolve().then(()=>execute({signal:controller.signal}));
  // Always observe the rejected op even if the deadline won the race.
  const deadline=new Promise(resolve=>{
   timer=setTimeout(()=>{
    if(completed)return;
    expired=true;
    controller.abort();
    resolve({status:'FAIL',reason:'deadline_exceeded'});
   },deadlineMs);
  });
  try {
   const observation=await Promise.race([op,deadline]);
   if(expired)return {status:'FAIL',reason:'deadline_exceeded'};
   return observation;
  } finally {
   completed=true;
   clearTimeout(timer);
  }
 };
 const result=await runWithVerifiedCleanup({execute:run,cleanup,verifyCleanup});
 return Object.freeze({
  ...result,
  deadlineExceeded:expired,
  // A timed-out operation may still be running when cleanup is attempted.
  // Even cleanup VERIFIED from injected callbacks cannot prove hard termination.
  operationTerminationProven:!expired && !result.executionError
 });
}
module.exports={runWithExecutionDeadline,isValidDeadline,MAX_DEADLINE_MS};
