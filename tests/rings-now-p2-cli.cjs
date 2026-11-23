'use strict';
// Rings Now P2: one-shot CLI entrypoint. This is NOT an Actions workflow.
// Canonical checked-in manifest only; no argv-provided approval or manifest.
// NEVER dispatch while G1-G4 final gate and owner HEAD-bound G5 are pending.
const {randomBytes}=require('node:crypto');
const {runRealP2DockerLifecycle,validateLiveManifest}=
 require('./rings-now-p2-real-docker-runner.cjs');
const {inspectP2Preflight}=require('./rings-now-p2-stack-static-gate.cjs');
const manifest=require('./rings-now-p2-isolated-manifest.json');
const ARGS=Object.freeze(['--isolated-once']);
function inspectCliPreflight(argv,checkedInManifest,environment={}){
 const issues=[];
 if(!Array.isArray(argv)||argv.length!==1||argv[0]!==ARGS[0])
   issues.push('invalid_exact_one_run_argument');
 const structural=validateLiveManifest(checkedInManifest);
 if(!structural.pass)issues.push(...structural.failures);
 const effective=inspectP2Preflight(checkedInManifest,environment);
 for(const issue of effective.failures)if(!issues.includes(issue))issues.push(issue);
 return Object.freeze({pass:issues.length===0,issues:Object.freeze(issues)});
}
// Diagnostic projection is intentionally allowlisted: never print raw stage
// objects, Docker identifiers, errors, SQL, environment, tokens or paths.
const STAGES=Object.freeze(['execute','cleanup','verify']);
const STATES=Object.freeze(['PASS','FAIL','CLEAN','VERIFIED','NOT_PROVEN']);
const EXECUTE_STEPS=Object.freeze([
 'NOT_STARTED','BASELINE_INVENTORY','CREATE_NETWORK','CREATE_CONTAINER',
 'START_CONTAINER','POSTGRES_READY','BOOTSTRAP_POSTGRES','APPLY_SNAPSHOT',
 'SQL_RLS_PROBE','INIT_GOTRUE','H1_GOTRUE','H2_GOTRUE',
 'H2_SYNTHETIC','POSTGREST_HTTP','DONE'
]);
const OPS=Object.freeze([
 'started:postgres','started:gotrue','started:postgrest',
 'postgres_candidate_sql_and_authenticator_cli_reported',
 'snapshot_candidate_cli_reported_not_rls_proof',
 'sql_rls_boundary_cli_reported_not_http_jwt_proof',
 'gotrue_migration_cli_reported',
 'h1_gotrue_http_five_cases_cli_reported_not_g4_proof',
 'h2_original_gotrue_jwt_seven_cases_cli_reported_not_g4_proof',
 'h2_seven_internal_cases_cli_reported_synthetic_jwt_not_g4_proof',
 'internal_postgrest_http_empty_owner_cli_reported_not_g4'
]);
function safeDiagnostics(result){
 const records=Array.isArray(result.stageRecords)?result.stageRecords:[];
 const actions=Array.isArray(result.cleanupActions)?result.cleanupActions:[];
 return {
  stageRecords:records.slice(0,12).map((entry,index)=>({
   index,
   stage:STAGES.includes(entry?.name)?entry.name:'UNKNOWN',
   status:STATES.includes(entry?.status)?entry.status:'UNKNOWN',
   attempted:entry?.attempted===true,
   overran:entry?.overran===true
  })),
  stageRecordCount:records.length,
  failedExecuteStep:EXECUTE_STEPS.includes(result.failedExecuteStep)?result.failedExecuteStep:null,
  opsSummary:{
   known:actions.filter(x=>OPS.includes(x)).map(x=>x),
   started:actions.filter(x=>typeof x==='string'&&/^started:(postgres|gotrue|postgrest)$/.test(x)).length,
   stopped:actions.filter(x=>typeof x==='string'&&/^stop:rn_p2_[a-z0-9]{8,32}_(postgres|gotrue|postgrest)$/.test(x)).length,
   removed:actions.filter(x=>typeof x==='string'&&/^remove:rn_p2_[a-z0-9]{8,32}_(postgres|gotrue|postgrest)$/.test(x)).length,
   networksRemoved:actions.filter(x=>typeof x==='string'&&/^network:rn_p2_[a-z0-9]{8,32}$/.test(x)).length,
   total:actions.length
  },
  coordinatorFailed:result.coordinatorFailed===true,
  emergencyCleanupAttempted:result.emergencyCleanupAttempted===true,
  emergencyCleanupStatus:['NOT_NEEDED','CLI_CLEAN_REPORTED','FAIL','BASELINE_UNTRUSTED'].includes(result.emergencyCleanupStatus)?result.emergencyCleanupStatus:'UNKNOWN',
  emergencyVerifyStatus:['NOT_NEEDED','CLI_EMPTY_REPORTED','FAIL','NOT_PROVEN'].includes(result.emergencyVerifyStatus)?result.emergencyVerifyStatus:'UNKNOWN'
 };
}
async function main(){
 const gate=inspectCliPreflight(process.argv.slice(2),manifest,process.env);
 if(!gate.pass){
  // Deliberately omit environment, tokens, SQL or secret-bearing error text.
  process.stderr.write('BLOCKED_NOT_RUN: P2 preflight failed ('+
   gate.issues.join(',')+')\n');
  process.exitCode=2;
  return;
 }
 const runId='rn_p2_'+randomBytes(12).toString('hex');
 let result;
 try{
  // Real backend accepts only its imported canonical manifest and adapter.
  result=await runRealP2DockerLifecycle({runId});
 }catch{
  process.stderr.write('P2_FAIL_OR_NOT_PROVEN: runner exception; teardown not proven\n');
  process.exitCode=1;
  return;
 }
 const report={
  status:result.status,
  attempted:result.attempted===true,
  // A CLI self-report is NOT independent evidence of real cleanup or H1-H6.
  g3Verified:false,
  actualP2Proven:false,
  resourceTerminationProven:false,
  diagnostics:safeDiagnostics(result)
 };
 process.stdout.write(JSON.stringify(report)+'\n');
 // Never return success until separately audited H1-H6 evidence has been
 // integrated. Do not treat a clean CLI lifecycle as G4/H6 proof.
 process.exitCode=1;
}
if(require.main===module)main().catch(()=>{
 process.stderr.write('P2_FAIL_OR_NOT_PROVEN: unhandled failure\n');
 process.exitCode=1;
});
module.exports={inspectCliPreflight,safeDiagnostics,main};
