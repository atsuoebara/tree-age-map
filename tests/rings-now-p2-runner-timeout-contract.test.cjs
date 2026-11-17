'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {runWithExecutionDeadline,isValidDeadline,MAX_DEADLINE_MS}=
 require('./rings-now-p2-runner-timeout-contract.cjs');
const good={
 cleanup:async()=>({status:'CLEAN'}),
 verifyCleanup:async()=>({verified:true})
};
test('deadline rejects invalid and above-job-limit values',async()=>{
 for(const ms of [0,-1,0.3,NaN,Infinity,600001,'30']) {
  assert.equal(isValidDeadline(ms),false);
  await assert.rejects(()=>runWithExecutionDeadline({...good,deadlineMs:ms,execute:async()=>({status:'PASS'})}));
 }
 assert.equal(isValidDeadline(MAX_DEADLINE_MS),true);
});
test('fast PASS requires verified cleanup',async()=>{
 const steps=[];
 const result=await runWithExecutionDeadline({
  deadlineMs:100,execute:async({signal})=>{assert.equal(signal.aborted,false);steps.push('execute');return {status:'PASS'};},
  cleanup:async()=>{steps.push('cleanup');return {status:'CLEAN'};},
  verifyCleanup:async()=>{steps.push('verify');return {verified:true};}
 });
 assert.deepEqual(steps,['execute','cleanup','verify']);
 assert.equal(result.status,'PASS');
 assert.equal(result.deadlineExceeded,false);
 assert.equal(result.operationTerminationProven,true);
});
test('never-settling execution triggers deadline and tries cleanup+verification',async()=>{
 let signal;
 const steps=[];
 const result=await runWithExecutionDeadline({
  deadlineMs:15,
  execute:async({signal:s})=>{signal=s;steps.push('start');return new Promise(()=>{});},
  cleanup:async()=>{steps.push('cleanup');return {status:'CLEAN'};},
  verifyCleanup:async()=>{steps.push('verify');return {verified:true};}
 });
 assert.equal(signal.aborted,true);
 assert.equal(result.deadlineExceeded,true);
 assert.equal(result.operationTerminationProven,false);
 assert.equal(result.status,'FAIL');
 assert.deepEqual(steps,['start','cleanup','verify']);
});
test('a timeout cannot be turned into PASS by fake CLEAN',async()=>{
 const r=await runWithExecutionDeadline({
  ...good,deadlineMs:10,execute:async()=>new Promise(()=>{})
 });
 assert.equal(r.status,'FAIL');
 assert.equal(r.cleanupVerified,true);
});
test('execute throw remains FAIL but cleanup proceeds',async()=>{
 let cleaned=false;
 const r=await runWithExecutionDeadline({
  ...good,deadlineMs:100,execute:async()=>{throw Error('synthetic');},
  cleanup:async()=>{cleaned=true;return {status:'CLEAN'};}
 });
 assert.equal(cleaned,true);
 assert.equal(r.status,'FAIL');
 assert.equal(r.deadlineExceeded,false);
});
test('cleanup throw after good execution remains FAIL',async()=>{
 const r=await runWithExecutionDeadline({
  ...good,deadlineMs:100,execute:async()=>({status:'PASS'}),
  cleanup:async()=>{throw Error('synthetic');}
 });
 assert.equal(r.status,'FAIL');
 assert.equal(r.cleanupError,true);
});
test('verification missing leaves NOT_PROVEN',async()=>{
 const r=await runWithExecutionDeadline({
  ...good,deadlineMs:100,execute:async()=>({status:'PASS'}),
  verifyCleanup:async()=>({verified:false})
 });
 assert.equal(r.status,'NOT_PROVEN');
 assert.equal(r.cleanupVerified,false);
});
test('unrecognized execution result cannot yield PASS',async()=>{
 const r=await runWithExecutionDeadline({
  ...good,deadlineMs:100,execute:async()=>({status:'UNKNOWN'})
 });
 assert.equal(r.status,'NOT_PROVEN');
});
test('abort signal alone never claims termination',async()=>{
 let signal;
 const r=await runWithExecutionDeadline({
  ...good,deadlineMs:10,execute:({signal:s})=>{signal=s;return new Promise(()=>{})}
 });
 assert.equal(signal.aborted,true);
 assert.equal(r.operationTerminationProven,false);
});
