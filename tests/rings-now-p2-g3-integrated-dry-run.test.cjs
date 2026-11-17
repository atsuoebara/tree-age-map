'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {runG3SyntheticDryRun}=require('./rings-now-p2-g3-integrated-dry-run.cjs');
const id='test_run_100';
function inventory() {return {
 kind:'SYNTHETIC_RESOURCE_INVENTORY',source:'INJECTED_TEST_INVENTORY',
 realResourcesObserved:false,executionApproval:false,checkoutCommit:'a'.repeat(40),
 runId:id,productionAccess:false,billingVerified:false,g1Verified:false,
 cleanupAttempted:true,cleanupStatus:'CLEAN',verificationAttempted:true,verificationStatus:'EMPTY',
 expectedServices:['postgres','gotrue','postgrest'],
 before:[],
 created:[{id:'pg',type:'container',owner:id,service:'postgres'},
  {id:'gt',type:'container',owner:id,service:'gotrue'},
  {id:'rest',type:'container',owner:id,service:'postgrest'},
  {id:'net',type:'network',owner:id}],
 after:[]
};}
const clock=()=>{let t=0;return ()=>++t;};
function config(mod={},record=inventory()) {
 const observed=[];
 return {observed,opts:{
  inventory:record,nowMs:clock(),totalMs:1000,reserveMs:400,verifyReserveMs:150,
  stageRunner:async(stage,info)=>{
   observed.push({stage,info});
   if(mod[stage]==='throw')throw Error('synthetic failure');
   return mod[stage]||({execute:{status:'PASS'},cleanup:{status:'CLEAN'},verify:{verified:true}})[stage];
  },
 }};
}
const run=opts=>runG3SyntheticDryRun(opts);
test('clean injected stages are consistent but never real G3/P2 proof',async()=>{
 const {observed,opts}=config();
 const out=await run(opts);
 assert.equal(out.status,'SYNTHETIC_PIPELINE_CONSISTENT_NOT_REAL_PROOF');
 assert.deepEqual(out.attempts,['execute','cleanup','verify']);
 assert.equal(out.g3Verified,false);assert.equal(out.actualP2Proven,false);
 assert.equal(out.actualResourcesVerified,false);assert.equal(out.p2ExecutionAuthorized,false);
 assert.ok(observed.every(x=>x.info.kind==='SYNTHETIC_ONLY'&&x.info.timeoutMs>0));
});
test('execution failure still attempts cleanup and verification',async()=>{
 const {opts}=config({execute:{status:'FAIL'}});
 const out=await run(opts);
 assert.equal(out.status,'FAIL');
 assert.deepEqual(out.attempts,['execute','cleanup','verify']);
});
test('execute throw still runs both later stages',async()=>{
 const {opts}=config({execute:'throw'});
 const out=await run(opts);
 assert.equal(out.status,'FAIL');
 assert.deepEqual(out.attempts,['execute','cleanup','verify']);
});
test('cleanup failure cannot be overwritten by verification',async()=>{
 const {opts}=config({cleanup:{status:'FAIL'}});
 const out=await run(opts);
 assert.equal(out.status,'FAIL');
 assert.equal(out.inventoryStatus,'SYNTHETIC_INVENTORY_CONSISTENT_NOT_REAL_PROOF');
});
test('cleanup exception cannot be overwritten by a clean inventory',async()=>{
 const {opts}=config({cleanup:'throw'});
 const out=await run(opts);
 assert.equal(out.status,'FAIL');
 assert.deepEqual(out.attempts,['execute','cleanup','verify']);
});
test('verify failure cannot yield a consistent status',async()=>{
 const {opts}=config({verify:{verified:false}});
 const out=await run(opts);
 assert.equal(out.status,'BLOCKED');
});
test('residual resource despite clean callbacks blocks pipeline',async()=>{
 const data=inventory();data.after=[data.created[3]];
 const {opts}=config({},data);
 const out=await run(opts);
 assert.equal(out.status,'BLOCKED');
 assert.equal(out.inventoryStatus,'BLOCKED');
});
test('forged real evidence is rejected before any callback',async()=>{
 for(const extra of [
  {kind:'REAL_RESOURCE_INVENTORY'},{source:'REAL_DOCKER'},
  {realResourcesObserved:true},{executionApproval:true}
 ]){
  const data=Object.assign(inventory(),extra);
  const {observed,opts}=config({},data);
  await assert.rejects(()=>run(opts));
  assert.equal(observed.length,0);
 }
});
test('unknown or missing inventory is rejected before callback',async()=>{
 const {observed,opts}=config({},null);opts.inventory=null;
 await assert.rejects(()=>run(opts));
 assert.equal(observed.length,0);
});
test('deadline reserve is enforced and cannot create G3 verified flag',async()=>{
 const {opts}=config();opts.totalMs=7;opts.reserveMs=6;opts.verifyReserveMs=5;
 const out=await run(opts);
 assert.notEqual(out.status,'SYNTHETIC_PIPELINE_CONSISTENT_NOT_REAL_PROOF');
 assert.equal(out.g3Verified,false);
 assert.equal(out.p2ExecutionAuthorized,false);
});
