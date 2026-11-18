'use strict';
// Offline scheduling-contract tests. Do not invoke real Docker, SQL or Actions.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {runWithSharedTimeBudget,JOB_LIMIT_MS}=
 require('./rings-now-p2-shared-time-budget.cjs');
const {checkIsolatedGoTrueTtl}=
 require('./rings-now-p2-h2-isolated-gotrue-ttl.cjs');
const {POST_WAIT_RESERVE_MS}=
 require('./rings-now-p2-h2-runner-bridge.cjs');
const {
 P2_TOTAL_MS,P2_CLEANUP_RESERVE_MS,P2_VERIFY_RESERVE_MS
}=require('./rings-now-p2-real-docker-runner.cjs');
const env={GOTRUE_JWT_EXP:'300',GOTRUE_JWT_AUD:'authenticated'};
const required=301000+POST_WAIT_RESERVE_MS;

test('real runner defaults respect the shared 600s ceiling and 120s cleanup reserve',()=>{
 assert.equal(P2_TOTAL_MS,JOB_LIMIT_MS);
 assert.equal(P2_TOTAL_MS,600000);
 assert.equal(P2_CLEANUP_RESERVE_MS,120000);
 assert.equal(P2_VERIFY_RESERVE_MS,30000);
 assert.ok(P2_VERIFY_RESERVE_MS<P2_CLEANUP_RESERVE_MS);
 assert.equal(POST_WAIT_RESERVE_MS,60000);
 assert.equal(required,361000);
});
test('shared coordinator grants at most 480 seconds to execute and still runs cleanup/verify',async()=>{
 const stages=[];
 const fakeClock=()=>1000; // no actual elapsed time; NOT a runtime measurement
 const out=await runWithSharedTimeBudget({
  runStage:async(name,{timeoutMs})=>{
   stages.push([name,timeoutMs]);
   return name==='execute'?{status:'PASS'}:
    name==='cleanup'?{status:'CLEAN'}:{verified:true};
  },
  nowMs:fakeClock,totalMs:P2_TOTAL_MS,
  reserveMs:P2_CLEANUP_RESERVE_MS,
  verifyReserveMs:P2_VERIFY_RESERVE_MS
 });
 assert.deepEqual(stages.map(x=>x[0]),['execute','cleanup','verify']);
 assert.equal(stages[0][1],480000);
 assert.equal(out.status,'PASS');
 assert.equal(out.resourceTerminationProven,false);
});
test('H2 pre-wait budget boundary is 119 seconds nominally, not a measured guarantee',()=>{
 const execute=P2_TOTAL_MS-P2_CLEANUP_RESERVE_MS;
 const maxSetupMs=execute-required;
 assert.equal(maxSetupMs,119000);
 for(const [preMs,allowed] of [[118999,true],[119000,true],[119001,false]]){
  const decision=checkIsolatedGoTrueTtl({
   env,executeRemainingMs:execute-preMs,
   setupReserveMs:POST_WAIT_RESERVE_MS
  });
  assert.equal(decision.status==='TTL_BUDGET_FEASIBLE_NOT_REALTIME_PROOF',
   allowed);
  assert.equal(decision.g4Verified,false);
  assert.equal(decision.realElapsedTimeVerified,false);
 }
});
test('prior 540s configuration remains too narrow: only 59s nominal setup room',()=>{
 const oldExecute=540000-P2_CLEANUP_RESERVE_MS;
 assert.equal(oldExecute-required,59000);
 const insufficient=checkIsolatedGoTrueTtl({
  env,executeRemainingMs:oldExecute-59001,
  setupReserveMs:POST_WAIT_RESERVE_MS
 });
 assert.equal(insufficient.status,'BLOCKED_TTL_EXCEEDS_EXECUTE_BUDGET');
});
