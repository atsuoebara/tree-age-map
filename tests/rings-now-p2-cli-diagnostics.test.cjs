'use strict';
// Offline only: no Docker, network, workflow dispatch, or real lifecycle.
const assert=require('node:assert/strict');
const {safeDiagnostics}=require('./rings-now-p2-cli.cjs');
const secret='SECRET_DO_NOT_LEAK';
const result=safeDiagnostics({
 stageRecords:[
  {name:'execute',status:'FAIL',attempted:true,elapsedMs:7,budgetMs:10,overran:false,secret},
  {name:'cleanup',status:'CLEAN',attempted:true},
  {name:'verify',status:'VERIFIED',attempted:true},
  {name:secret,status:secret,attempted:false}
 ],
 cleanupActions:['started:postgres','stop:rn_p2_abcdefgh_postgres',
  'remove:rn_p2_abcdefgh_postgres','network:rn_p2_abcdefgh',
  'unsafe:'+secret],
 failedExecuteStep:'POSTGRES_READY',
 coordinatorFailed:false,
 emergencyCleanupStatus:'NOT_NEEDED',emergencyVerifyStatus:'NOT_NEEDED'
});
assert.deepEqual(result.stageRecords.map(x=>x.stage),
 ['execute','cleanup','verify','UNKNOWN']);
assert.deepEqual(result.stageRecords.map(x=>x.status),
 ['FAIL','CLEAN','VERIFIED','UNKNOWN']);
assert.equal(result.failedExecuteStep,'POSTGRES_READY');
assert.equal(result.opsSummary.started,1);
assert.equal(result.opsSummary.stopped,1);
assert.equal(result.opsSummary.removed,1);
assert.equal(result.opsSummary.networksRemoved,1);
assert.equal(result.opsSummary.total,5);
assert.equal(JSON.stringify(result).includes(secret),false);
assert.equal(JSON.stringify(result).includes('rn_p2_abcdefgh'),false);
assert.equal(safeDiagnostics({failedExecuteStep:secret}).failedExecuteStep,null);
assert.equal(safeDiagnostics({failedExecuteStep:{secret}}).failedExecuteStep,null);
assert.equal(safeDiagnostics({}).failedExecuteStep,null);
assert.equal(safeDiagnostics({}).stageRecordCount,0);
assert.equal(safeDiagnostics({}).opsSummary.total,0);
console.log('PASS: offline allowlist projection and redaction');
