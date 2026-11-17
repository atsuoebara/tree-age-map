'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {runG3WatchdogSyntheticIntegration}=require('./rings-now-p2-g3-watchdog-integration.cjs');
const runId='test_run_100';
function inventory(){return {
 kind:'SYNTHETIC_RESOURCE_INVENTORY',source:'INJECTED_TEST_INVENTORY',
 realResourcesObserved:false,executionApproval:false,checkoutCommit:'a'.repeat(40),
 runId,productionAccess:false,billingVerified:false,g1Verified:false,
 cleanupAttempted:true,cleanupStatus:'CLEAN',verificationAttempted:true,verificationStatus:'EMPTY',
 expectedServices:['postgres','gotrue','postgrest'],before:[],
 created:[{id:'pg',type:'container',owner:runId,service:'postgres'},
 {id:'auth',type:'container',owner:runId,service:'gotrue'},
 {id:'rest',type:'container',owner:runId,service:'postgrest'},
 {id:'net',type:'network',owner:runId}],after:[]
};}
const clock=()=>{let n=0;return ()=>++n;};
const childSuccess=()=>({status:'PASS',timedOut:false,childClosed:true,spawnError:null});
function setup(modes={},results={}){
 const calls=[];
 return {calls,opts:{
  modes:{execute:'success',cleanup:'success',verify:'success',...modes},
  inventory:inventory(),nowMs:clock(),totalMs:1000,reserveMs:400,verifyReserveMs:150,
  childRunner:async o=>{calls.push(o);return results[o.args[0]]||childSuccess();}
 }};
}
test('fixed synthetic fixture and sanitized child environment',async()=>{
 const {calls,opts}=setup();
 const result=await runG3WatchdogSyntheticIntegration(opts);
 assert.equal(result.status,'SYNTHETIC_PIPELINE_CONSISTENT_NOT_REAL_PROOF');
 assert.deepEqual(result.attempts,['execute','cleanup','verify']);
 assert.equal(calls.length,3);
 assert.ok(calls.every(c=>c.script.endsWith('/rings-now-p2-process-watchdog-fixture.cjs')
  &&c.env&&Object.keys(c.env).length===0&&c.args.length===1
  &&c.args[0]==='success'&&c.timeoutMs>0));
 assert.equal(result.resourceTerminationProven,false);
 assert.equal(result.g3Verified,false);assert.equal(result.p2ExecutionAuthorized,false);
});
test('timed out child fails and later stages still attempted when time remains',async()=>{
 const {calls,opts}=setup({execute:'hang'},{
  hang:{status:'FAIL',timedOut:true,childClosed:true,termSent:true,killSent:true}
 });
 const result=await runG3WatchdogSyntheticIntegration(opts);
 assert.equal(result.status,'FAIL');
 assert.deepEqual(result.attempts,['execute','cleanup','verify']);
 assert.equal(calls.length,3);
 assert.equal(result.childRecords[0].timedOut,true);
 assert.equal(result.childRecords[0].groupTerminationVerified,false);
});
test('unknown process close or error cannot pass as clean',async()=>{
 for(const record of [
  {status:'PASS',timedOut:false,childClosed:false,spawnError:null},
  {status:'PASS',timedOut:false,childClosed:true,spawnError:'EACCES'},
  {status:'PASS',timedOut:true,childClosed:true,spawnError:null}
 ]){
  const {opts}=setup({cleanup:'failure'},{failure:record});
  const result=await runG3WatchdogSyntheticIntegration(opts);
  assert.equal(result.status,'FAIL');
  assert.equal(result.g3Verified,false);
 }
});
test('clean inventory cannot mask execute or cleanup process failure',async()=>{
 for(const name of ['execute','cleanup']){
  const modes={};modes[name]='failure';
  const {opts}=setup(modes,{failure:{status:'FAIL',timedOut:false,childClosed:true,spawnError:null}});
  const result=await runG3WatchdogSyntheticIntegration(opts);
  assert.equal(result.status,'FAIL');
 }
});
test('cleanup inventory leak blocks even after all child stages pass',async()=>{
 const {opts}=setup();opts.inventory.after=[opts.inventory.created[3]];
 const result=await runG3WatchdogSyntheticIntegration(opts);
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.inventoryStatus,'BLOCKED');
});
test('verify process failure fails closed with no G3 approval',async()=>{
 const {opts}=setup({verify:'failure'},{failure:{status:'FAIL',timedOut:false,childClosed:true}});
 const result=await runG3WatchdogSyntheticIntegration(opts);
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.p2ExecutionAuthorized,false);
});
test('invalid modes cannot invoke childRunner',async()=>{
 for(const bad of ['docker','/bin/sh','real-p2','Success']){
  const {calls,opts}=setup({execute:bad});
  await assert.rejects(()=>runG3WatchdogSyntheticIntegration(opts));
  assert.equal(calls.length,0);
 }
});
test('forged real inventory fails before spawning any children',async()=>{
 const {calls,opts}=setup();opts.inventory.kind='REAL_DOCKER_INVENTORY';
 await assert.rejects(()=>runG3WatchdogSyntheticIntegration(opts));
 assert.equal(calls.length,0);
});
test('child runner error cannot suppress later synthetic cleanup',async()=>{
 const {calls,opts}=setup({execute:'failure'});
 const previous=opts.childRunner;
 opts.childRunner=async arg=>{if(arg.args[0]==='failure'){calls.push(arg);throw Error('synthetic spawn error');}return previous(arg);};
 const result=await runG3WatchdogSyntheticIntegration(opts);
 assert.equal(result.status,'FAIL');
 assert.deepEqual(result.attempts,['execute','cleanup','verify']);
});
test('exhausted shared budget never promotes proof flags',async()=>{
 const {opts}=setup();opts.totalMs=7;opts.reserveMs=6;opts.verifyReserveMs=5;
 const result=await runG3WatchdogSyntheticIntegration(opts);
 assert.notEqual(result.status,'SYNTHETIC_PIPELINE_CONSISTENT_NOT_REAL_PROOF');
 assert.equal(result.actualResourcesVerified,false);
 assert.equal(result.g3Verified,false);
});

test('Linux native Node fixed child: normal stages complete without P2 access',
 {skip:process.platform!=='linux'},async()=>{
 const {performance}=require('node:perf_hooks');
 const result=await runG3WatchdogSyntheticIntegration({
  inventory:inventory(),nowMs:()=>performance.now(),
  totalMs:5000,reserveMs:2500,verifyReserveMs:1000,graceMs:30
 });
 assert.equal(result.status,'SYNTHETIC_PIPELINE_CONSISTENT_NOT_REAL_PROOF');
 assert.equal(result.childRecords.length,3);
 assert.ok(result.childRecords.every(x=>x.childClosed&&!x.timedOut));
 assert.equal(result.actualResourcesVerified,false);
 assert.equal(result.p2ExecutionAuthorized,false);
});
test('Linux native Node fixed child: hung execute is killed; cleanup is attempted',
 {skip:process.platform!=='linux'},async()=>{
 const {performance}=require('node:perf_hooks');
 const result=await runG3WatchdogSyntheticIntegration({
  modes:{execute:'ignore-term',cleanup:'success',verify:'success'},
  inventory:inventory(),nowMs:()=>performance.now(),
  totalMs:5000,reserveMs:2300,verifyReserveMs:950,graceMs:30
 });
 assert.equal(result.status,'FAIL');
 assert.ok(result.childRecords.length>=2);
 assert.equal(result.childRecords[0].timedOut,true);
 assert.equal(result.childRecords[0].groupTerminationVerified,false);
 assert.equal(result.g3Verified,false);
});
