'use strict';
// SYNTHETIC-ONLY G3 watchdog wiring. The sole executable target is the
// repository's fixed Node fixture. NOT a Docker/P2/Actions execution path.
const assert=require('node:assert/strict');
const path=require('node:path');
const {performance}=require('node:perf_hooks');
const {runBoundedChild}=require('./rings-now-p2-process-watchdog.cjs');
const {runG3SyntheticDryRun}=require('./rings-now-p2-g3-integrated-dry-run.cjs');
const FIXTURE=path.join(__dirname,'rings-now-p2-process-watchdog-fixture.cjs');
const STAGES=['execute','cleanup','verify'];
const MODES=new Set(['success','failure','hang','ignore-term']);

async function runG3WatchdogSyntheticIntegration({
 modes={execute:'success',cleanup:'success',verify:'success'},
 inventory,nowMs=()=>performance.now(),totalMs=1000,
 reserveMs=550,verifyReserveMs=240,graceMs=25,
 childRunner=runBoundedChild
}={}) {
 assert.ok(modes&&typeof modes==='object'&&!Array.isArray(modes));
 for(const name of STAGES)assert.ok(MODES.has(modes[name]),'synthetic mode required: '+name);
 assert.equal(typeof childRunner,'function');
 assert.ok(Number.isSafeInteger(graceMs)&&graceMs>=1&&graceMs<=5000);
 const childRecords=[];
 const stageRunner=async(name,{timeoutMs,kind})=>{
  assert.equal(kind,'SYNTHETIC_ONLY');
  assert.ok(STAGES.includes(name));
  // Do not accept arbitrary scripts, args, env or Docker parameters.
  const result=await childRunner({
   script:FIXTURE,args:[modes[name]],timeoutMs,graceMs,env:{}
  });
  const safe=result?.status==='PASS'&&result?.timedOut===false&&
    result?.childClosed===true&&result?.spawnError==null;
  childRecords.push(Object.freeze({
   stage:name,status:safe?'PASS':'FAIL',
   timedOut:result?.timedOut===true,
   childClosed:result?.childClosed===true,
   termSent:result?.termSent===true,killSent:result?.killSent===true,
   groupTerminationVerified:false
  }));
  if(name==='execute')return {status:safe?'PASS':'FAIL'};
  if(name==='cleanup')return {status:safe?'CLEAN':'FAIL'};
  return {verified:safe};
 };
 const outcome=await runG3SyntheticDryRun({
  stageRunner,inventory,nowMs,totalMs,reserveMs,verifyReserveMs
 });
 return Object.freeze({
  ...outcome,evidenceKind:'SYNTHETIC_FIXED_CHILD_WATCHDOG_AND_INVENTORY',
  childRecords:Object.freeze(childRecords),
  resourceTerminationProven:false,actualResourcesVerified:false,
  g3Verified:false,actualP2Proven:false,p2ExecutionAuthorized:false
 });
}
module.exports={runG3WatchdogSyntheticIntegration};
