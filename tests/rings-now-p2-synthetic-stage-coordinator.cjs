'use strict';
// OFFLINE SYNTHETIC INTEGRATION ONLY. No P2 services, DB, HTTP, or Actions.
const path = require('node:path');
const assert = require('node:assert/strict');
const {performance} = require('node:perf_hooks');
const {runWithSharedTimeBudget} = require('./rings-now-p2-shared-time-budget.cjs');
const {runBoundedChild} = require('./rings-now-p2-process-watchdog.cjs');
const FIXTURE = path.join(__dirname, 'rings-now-p2-process-watchdog-fixture.cjs');
const MODES = new Set(['success', 'failure', 'hang', 'ignore-term']);
const STAGES = Object.freeze(['execute', 'cleanup', 'verify']);
function normalizeStageRecords(result) {
  return Object.freeze(STAGES.map((name) => {
    const outcome = name === 'execute' ? result.execution :
      name === 'cleanup' ? result.cleanup : result.verification;
    return Object.freeze({name, ...outcome});
  }));
}
async function runSyntheticP2Integration({
  modes = {execute:'success',cleanup:'success',verify:'success'},
  totalMs = 1000, reserveMs = 550, verifyReserveMs = 240,
  graceMs = 25, nowMs = () => performance.now(),
  childRunner = runBoundedChild
} = {}) {
  assert.ok(modes && typeof modes === 'object' && !Array.isArray(modes));
  for (const name of STAGES) assert.ok(MODES.has(modes[name]), 'synthetic mode required for '+name);
  assert.equal(typeof childRunner,'function');
  assert.equal(typeof nowMs,'function');
  const stageOutcomes=[];
  const budget = await runWithSharedTimeBudget({
    totalMs,reserveMs,verifyReserveMs,nowMs,
    runStage: async (name,{timeoutMs}) => {
      // Only the existing synthetic fixture is allowed. No user script/PID/env.
      const result = await childRunner({script:FIXTURE,args:[modes[name]],timeoutMs,graceMs,env:{}});
      stageOutcomes.push(Object.freeze({stage:name, status:result?.status || 'NOT_PROVEN',
        timedOut:result?.timedOut === true, childClosed:result?.childClosed === true,
        groupTerminationVerified:false}));
      if (name==='execute') return {status:result?.status==='PASS'?'PASS':'FAIL'};
      if (name==='cleanup') return {status:result?.status==='PASS'?'CLEAN':'FAIL'};
      return {verified:result?.status==='PASS'};
    }
  });
  const records=normalizeStageRecords(budget);
  const noMissing=records.length===3 && records.every(x=>x.attempted===true);
  const noTimedOutChild=stageOutcomes.every(x=>!x.timedOut);
  // This verdict is explicitly about synthetic stage behavior only.
  const status=budget.status==='PASS'&&noMissing&&noTimedOutChild?'PASS':budget.status;
  return Object.freeze({
    evidenceKind:'SYNTHETIC_NODE_ONLY', status,
    records, stageOutcomes:Object.freeze(stageOutcomes),
    resourceTerminationProven:false, actualP2Proven:false,
    totalElapsedMs:budget.elapsedMs,
  });
}
module.exports={runSyntheticP2Integration,normalizeStageRecords};
