'use strict';
// P2 future runner: OFFLINE shared deadline budgeting, not a timeout mechanism.
// No spawn, network, Docker, SQL, environment reads or Actions integration.
const assert=require('node:assert/strict');
const JOB_LIMIT_MS=600000;
const MAX_CHILD_STAGE_MS=540000;

async function runWithSharedTimeBudget({
  runStage, nowMs, totalMs=JOB_LIMIT_MS, reserveMs=60000,
  verifyReserveMs=10000
}) {
  assert.equal(typeof runStage,'function');
  assert.equal(typeof nowMs,'function');
  assert.ok(Number.isSafeInteger(totalMs)&&totalMs>=3&&totalMs<=JOB_LIMIT_MS);
  assert.ok(Number.isSafeInteger(reserveMs)&&reserveMs>=2&&reserveMs<totalMs);
  assert.ok(Number.isSafeInteger(verifyReserveMs)&&verifyReserveMs>=1&&verifyReserveMs<reserveMs);
  const started=nowMs();
  assert.ok(Number.isFinite(started));
  const deadline=started+totalMs;
  let lastNow=started;
  const time=()=>{
    const n=nowMs();
    assert.ok(Number.isFinite(n) && n>=lastNow,'monotonic clock required');
    lastNow=n;
    return n;
  };
  const records=[];
  async function stage(name,budget) {
    const before=time();
    if(!Number.isSafeInteger(budget)||budget<1)
      return {status:'NOT_PROVEN',attempted:false,elapsedMs:0,budgetMs:0,overran:false};
    let out,threw=false;
    try {out=await runStage(name,Object.freeze({timeoutMs:budget}));}
    catch {threw=true;}
    const after=time();
    const elapsed=after-before;
    const overran=elapsed>budget || after>deadline;
    const status=threw || overran ? 'FAIL'
      : name==='execute' && out?.status==='PASS' ? 'PASS'
      : name==='cleanup' && out?.status==='CLEAN' ? 'CLEAN'
      : name==='verify' && out?.verified===true ? 'VERIFIED'
      : name==='execute' && out?.status==='FAIL' ? 'FAIL'
      : name==='cleanup' && out?.status==='FAIL' ? 'FAIL'
      : 'NOT_PROVEN';
    const record=Object.freeze({name,status,attempted:true,elapsedMs:elapsed,budgetMs:budget,overran});
    records.push(record);
    return record;
  }
  const available=()=>Math.max(0,Math.floor(deadline-time()));
  const executeBudget=Math.min(MAX_CHILD_STAGE_MS,Math.max(0,available()-reserveMs));
  const execution=await stage('execute',executeBudget);
  // Always try cleanup even when execution FAILs, provided actual budget remains.
  const cleanupBudget=Math.min(MAX_CHILD_STAGE_MS,Math.max(0,available()-verifyReserveMs));
  const cleanup=await stage('cleanup',cleanupBudget);
  // Verification is attempted independently even if cleanup failed.
  const verification=await stage('verify',Math.min(MAX_CHILD_STAGE_MS,available()));
  const finished=time();
  const allInTime=finished<=deadline;
  const status=execution.status==='FAIL'||cleanup.status==='FAIL'||
    verification.status==='FAIL'||!allInTime ? 'FAIL'
    : execution.status==='PASS'&&cleanup.status==='CLEAN'&&
      verification.status==='VERIFIED' ? 'PASS' : 'NOT_PROVEN';
  return Object.freeze({
    status,allInTime,
    execution,cleanup,verification,elapsedMs:finished-started,
    // Stage result is callback evidence, not process/resource absence proof.
    resourceTerminationProven:false,
    stageRecords:Object.freeze(records)
  });
}
module.exports={runWithSharedTimeBudget,JOB_LIMIT_MS,MAX_CHILD_STAGE_MS};
