'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {runWithSharedTimeBudget}=require('./rings-now-p2-shared-time-budget.cjs');
function setup(outcomes={},durations={}) {
 let now=0;const calls=[];
 const nowMs=()=>now;
 const runStage=async(name,{timeoutMs})=>{
  calls.push({name,timeoutMs});
  now+=durations[name]??1;
  if(outcomes[name] instanceof Error)throw outcomes[name];
  return outcomes[name]??(name==='execute'?{status:'PASS'}:name==='cleanup'?{status:'CLEAN'}:{verified:true});
 };
 return {nowMs,runStage,calls};
}
const base={totalMs:100,reserveMs:40,verifyReserveMs:10};
test('normal success: three stages, positive budgets, no resource proof',async()=>{
 const x=setup();const r=await runWithSharedTimeBudget({...base,...x});
 assert.equal(r.status,'PASS');assert.deepEqual(x.calls.map(c=>c.name),['execute','cleanup','verify']);
 assert.deepEqual(x.calls.map(c=>c.timeoutMs),[60,89,98]);
 assert.equal(r.resourceTerminationProven,false);
});
test('execute FAIL still attempts cleanup and verification',async()=>{
 const x=setup({execute:{status:'FAIL'}});const r=await runWithSharedTimeBudget({...base,...x});
 assert.equal(r.status,'FAIL');assert.equal(r.cleanup.status,'CLEAN');assert.equal(r.verification.status,'VERIFIED');
});
test('cleanup FAIL cannot be hidden by valid verification',async()=>{
 const x=setup({cleanup:{status:'FAIL'}});const r=await runWithSharedTimeBudget({...base,...x});
 assert.equal(r.status,'FAIL');
});
test('verification missing means NOT_PROVEN, never PASS',async()=>{
 const x=setup({verify:{verified:false}});const r=await runWithSharedTimeBudget({...base,...x});
 assert.equal(r.status,'NOT_PROVEN');
});
test('execute uses only total minus reserved cleanup/verify time',async()=>{
 const x=setup({}, {execute:61,cleanup:1,verify:1});const r=await runWithSharedTimeBudget({...base,...x});
 assert.equal(r.execution.overran,true);assert.equal(r.status,'FAIL');
 assert.deepEqual(x.calls.map(c=>c.name),['execute','cleanup','verify']);
});
test('delayed execution cannot steal cleanup reserve without failure',async()=>{
 const x=setup({}, {execute:97,cleanup:1,verify:1});const r=await runWithSharedTimeBudget({...base,...x});
 assert.equal(r.status,'FAIL');assert.equal(r.cleanup.attempted,false);
 assert.equal(r.verification.attempted,true);
});
test('clock expiry prevents fabricated cleanup PASS',async()=>{
 const x=setup({}, {execute:100,cleanup:0,verify:0});const r=await runWithSharedTimeBudget({...base,...x});
 assert.equal(r.status,'FAIL');assert.equal(r.cleanup.attempted,false);assert.equal(r.verification.attempted,false);
});
test('exceptions in execute or cleanup do not skip later stage',async()=>{
 for(const name of ['execute','cleanup','verify']){
  const x=setup({[name]:new Error('synthetic')});const r=await runWithSharedTimeBudget({...base,...x});
  assert.equal(r.status,'FAIL');
  assert.deepEqual(x.calls.map(c=>c.name),['execute','cleanup','verify']);
 }
});
test('unknown callback result cannot count as success',async()=>{
 for(const [name,result] of [['execute',{}],['cleanup',{status:'UNKNOWN'}],['verify',{}]]){
  const x=setup({[name]:result});const r=await runWithSharedTimeBudget({...base,...x});
  assert.equal(r.status,'NOT_PROVEN');
 }
});
test('reject invalid budgets and nonmonotonic clock',async()=>{
 const x=setup();
 for(const v of [{totalMs:600001},{reserveMs:100},{verifyReserveMs:40},{totalMs:2},{totalMs:4,reserveMs:3,verifyReserveMs:3}])
  await assert.rejects(()=>runWithSharedTimeBudget({...base,...x,...v}));
 let n=0;
 await assert.rejects(()=>runWithSharedTimeBudget({...base,
  nowMs:()=>--n,runStage:x.runStage
 }));
});
