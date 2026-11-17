'use strict';
// G3 component integration — synthetic-only, OFFLINE; NEVER an executable P2 runner.
// Injected stage callbacks are not trusted real resource attestations. No spawn,
// Docker, network, env, filesystem or Actions execution in this module.
const assert=require('node:assert/strict');
const {runWithSharedTimeBudget}=require('./rings-now-p2-shared-time-budget.cjs');
const {inspectG3ResourceEvidence}=require('./rings-now-p2-g3-resource-absence-gate.cjs');

async function runG3SyntheticDryRun({
 stageRunner, inventory, nowMs, totalMs=600000, reserveMs=60000, verifyReserveMs=10000,
}={}) {
 assert.equal(typeof stageRunner,'function','injected synthetic stageRunner required');
 assert.equal(typeof nowMs,'function','monotonic clock required');
 // Reject all real-evidence or authorization claims before executing callbacks.
 assert.ok(inventory&&inventory.kind==='SYNTHETIC_RESOURCE_INVENTORY'&&
  inventory.source==='INJECTED_TEST_INVENTORY'&&inventory.realResourcesObserved===false&&
  inventory.executionApproval===false,'synthetic inventory only');
 let executed=false, cleaned=false, cleanDeclared=false, inspected=null;
 const attempts=[];
 const budget=await runWithSharedTimeBudget({
  totalMs,reserveMs,verifyReserveMs,nowMs,
  runStage:async(name,{timeoutMs})=>{
   attempts.push(name);
   if(name==='execute'){
    executed=true;
    const result=await stageRunner('execute',{timeoutMs,kind:'SYNTHETIC_ONLY'});
    return {status:result?.status==='PASS'?'PASS':'FAIL'};
   }
   if(name==='cleanup'){
    cleaned=true;
    const result=await stageRunner('cleanup',{timeoutMs,kind:'SYNTHETIC_ONLY'});
    cleanDeclared=result?.status==='CLEAN';
    return {status:cleanDeclared?'CLEAN':'FAIL'};
   }
   const response=await stageRunner('verify',{timeoutMs,kind:'SYNTHETIC_ONLY'});
   // Verification callback cannot replace the independently structured
   // inventory check. A cleanup FAIL cannot be hidden by a clean inventory.
   inspected=inspectG3ResourceEvidence(inventory);
   return {verified:response?.verified===true&&cleaned&&cleanDeclared&&
    inspected.status==='SYNTHETIC_INVENTORY_CONSISTENT_NOT_REAL_PROOF'};
  }
 });
 const complete=executed&&cleaned&&attempts.includes('verify')&&
  budget.execution.attempted===true&&budget.cleanup.attempted===true&&
  budget.verification.attempted===true;
 const internallyConsistent=complete&&budget.status==='PASS'&&
  inspected?.status==='SYNTHETIC_INVENTORY_CONSISTENT_NOT_REAL_PROOF';
 return Object.freeze({
  status:internallyConsistent?'SYNTHETIC_PIPELINE_CONSISTENT_NOT_REAL_PROOF':
   budget.status==='FAIL'?'FAIL':'BLOCKED',
  evidenceKind:'INJECTED_SYNTHETIC_G3_PIPELINE',
  stageRecords:budget.stageRecords,attempts:Object.freeze(attempts),
  inventoryStatus:inspected?.status||'NOT_PROVEN',
  resourceTerminationProven:false,actualResourcesVerified:false,
  g3Verified:false,p2ExecutionAuthorized:false,actualP2Proven:false,
 });
}
module.exports={runG3SyntheticDryRun};
