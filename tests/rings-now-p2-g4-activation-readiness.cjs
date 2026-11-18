'use strict';
// Rings Now G4: OFFLINE activation-readiness inspector only.
// Never reads GitHub, environment, Docker, timestamps or network.
// Caller-supplied commit relationships/measurements cannot establish provenance.
const assert=require('node:assert/strict');
const SHA=/^[0-9a-f]{40}$/;
const APPROVAL_ONLY_PATHS=Object.freeze([
 '.github/workflows/rings-now-p2-isolated-manual.yml',
 'tests/rings-now-p2-isolated-manifest.json'
]);
const RUNNER_MAX_MS=600000;
const PARENT_CLEANUP_RESERVE_MS=120000;
const WAIT_STRICT_MIN_MS=301000;
const POST_WAIT_RESERVE_MS=60000;
function integerMs(n){return Number.isSafeInteger(n)&&n>=0;}
function inspectG4ActivationCandidate({
 manifest,workflow,checkoutBinding,measurements
}={}){
 const issues=[];
 const fail=x=>{if(!issues.includes(x))issues.push(x);};
 if(manifest?.status!=='BLOCKED_NOT_RUN'||manifest?.explicitExecutionApproval!==false||
    manifest?.productionAccess!==false||manifest?.checkoutCommit!==null)
  fail('manifest_must_remain_unapproved');
 if(typeof workflow!=='string'||!/^    if: \$\{\{ false \}\}/m.test(workflow))
  fail('workflow_hard_stop_must_remain');
 if(typeof workflow==='string'&&!/^  workflow_dispatch:\s*$/m.test(workflow))
  fail('workflow_not_manual_only');
 const timeout=typeof workflow==='string'?
  workflow.match(/^    timeout-minutes:[ \t]*(\d+)(?:[ \t]*#.*)?[ \t]*$/m):null;
 const jobMs=timeout?Number(timeout[1])*60000:NaN;
 if(!integerMs(jobMs)||jobMs<=RUNNER_MAX_MS)
  fail('job_limit_does_not_allow_checkout_or_setup_overhead');
 if(!checkoutBinding||checkoutBinding.method!=='APPROVAL_ONLY_CHILD'||
    !SHA.test(checkoutBinding.sourceSha||'')||
    !SHA.test(checkoutBinding.approvalSha||'')||
    checkoutBinding.sourceSha===checkoutBinding.approvalSha||
    checkoutBinding.approvalParentSha!==checkoutBinding.sourceSha||
    checkoutBinding.workflowCheckoutSha!==checkoutBinding.approvalSha||
    !Array.isArray(checkoutBinding.changedPaths)||
    checkoutBinding.changedPaths.length<1||
    checkoutBinding.changedPaths.length>APPROVAL_ONLY_PATHS.length||
    new Set(checkoutBinding.changedPaths).size!==checkoutBinding.changedPaths.length||
    !checkoutBinding.changedPaths.every(p=>APPROVAL_ONLY_PATHS.includes(p)))
  fail('approval_only_child_checkout_binding_not_demonstrated');
 // A future audited activation may use sourceSha in the approval child's
 // manifest, never its own self-referential approval commit hash.
 if(checkoutBinding?.proposedManifestCheckoutCommit!==checkoutBinding?.sourceSha||
    !SHA.test(checkoutBinding?.sourceSha||''))
  fail('manifest_source_commit_binding_not_proposed');
 if(!measurements||measurements.source!=='ACTUAL_ISOLATED_RUN_EVIDENCE'||
    !measurements.evidenceId||typeof measurements.evidenceId!=='string'||
    !Array.isArray(measurements.stages)||
    measurements.stages.length!==5)
  fail('actual_runtime_measurement_missing');
 else {
  const labels=['preBridge','expiryWait','postWait','cleanupVerify','workflowOverhead'];
  if(!measurements.stages.every((s,i)=>
   s&&s.label===labels[i]&&integerMs(s.elapsedMs)))
   fail('measured_stages_invalid');
  else {
   const [pre,wait,post,cleanup,overhead]=measurements.stages.map(s=>s.elapsedMs);
   const maxPre=RUNNER_MAX_MS-PARENT_CLEANUP_RESERVE_MS-
    WAIT_STRICT_MIN_MS-POST_WAIT_RESERVE_MS;
   if(pre>maxPre)fail('pre_bridge_exceeds_119s_budget');
   if(wait<WAIT_STRICT_MIN_MS)fail('natural_expiry_elapsed_not_proven');
   if(post>POST_WAIT_RESERVE_MS)fail('post_wait_exceeds_reserved_budget');
   if(cleanup>PARENT_CLEANUP_RESERVE_MS)fail('cleanup_exceeds_reserved_budget');
   if(pre+wait+post+cleanup>RUNNER_MAX_MS)
    fail('runner_total_exceeds_600s');
   if(!integerMs(jobMs)||pre+wait+post+cleanup+overhead>=jobMs)
    fail('workflow_total_has_no_positive_margin');
  }
 }
 const status=issues.length?'BLOCKED_ACTIVATION_NOT_READY':
  'DOCUMENTARY_CANDIDATE_ONLY_INDEPENDENT_VERIFICATION_REQUIRED';
 return Object.freeze({status,issues:Object.freeze(issues),
  workflowJobMs:integerMs(jobMs)?jobMs:null,runnerMaxMs:RUNNER_MAX_MS,
  nominalPreBridgeMaxMs:119000,cleanupReserveMs:PARENT_CLEANUP_RESERVE_MS,
  // Untrusted measured metadata never authorizes runtime use or G4 proof.
  measurementsIndependentlyVerified:false,sourceProvenanceVerified:false,
  billingVerified:false,g4Verified:false,executionAuthorized:false,
  safeToEnable:false});
}
module.exports={inspectG4ActivationCandidate,APPROVAL_ONLY_PATHS,
 RUNNER_MAX_MS,PARENT_CLEANUP_RESERVE_MS};
