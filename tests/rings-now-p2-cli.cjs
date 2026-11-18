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
  resourceTerminationProven:false
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
module.exports={inspectCliPreflight,main};
