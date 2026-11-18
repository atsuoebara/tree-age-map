'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {inspectG4ActivationCandidate}=require('./rings-now-p2-g4-activation-readiness.cjs');
const SOURCE='a'.repeat(40),APPROVAL='b'.repeat(40);
function fixture(){
 return {
  manifest:{status:'BLOCKED_NOT_RUN',explicitExecutionApproval:false,
   productionAccess:false,checkoutCommit:null},
  workflow:'on:\n  workflow_dispatch:\njobs:\n  isolated-p2:\n    if: ${{ false }}\n    timeout-minutes: 12\n',
  checkoutBinding:{method:'APPROVAL_ONLY_CHILD',sourceSha:SOURCE,
   approvalSha:APPROVAL,approvalParentSha:SOURCE,
   workflowCheckoutSha:APPROVAL,proposedManifestCheckoutCommit:SOURCE,
   changedPaths:['.github/workflows/rings-now-p2-isolated-manual.yml',
    'tests/rings-now-p2-isolated-manifest.json']},
  measurements:{source:'ACTUAL_ISOLATED_RUN_EVIDENCE',evidenceId:'synthetic-metadata-not-proof',
   stages:[
    {label:'preBridge',elapsedMs:100000},
    {label:'expiryWait',elapsedMs:301000},
    {label:'postWait',elapsedMs:50000},
    {label:'cleanupVerify',elapsedMs:100000},
    {label:'workflowOverhead',elapsedMs:25000}
   ]}
 };
}
function check(x){return inspectG4ActivationCandidate(x);}
test('actual disabled 10m workflow blocks even with otherwise-shaped metadata',()=>{
 const x=fixture();x.workflow=x.workflow.replace('timeout-minutes: 12','timeout-minutes: 10');
 const r=check(x);
 assert.equal(r.status,'BLOCKED_ACTIVATION_NOT_READY');
 assert.ok(r.issues.includes('job_limit_does_not_allow_checkout_or_setup_overhead'));
 assert.equal(r.safeToEnable,false);
});
test('missing timing measurements blocks',()=>{
 const x=fixture();delete x.measurements;
 const r=check(x);
 assert.ok(r.issues.includes('actual_runtime_measurement_missing'));
});
test('119-second pre-bridge boundary rejects overrun',()=>{
 const x=fixture();x.measurements.stages[0].elapsedMs=119000;
 assert.ok(!check(x).issues.includes('pre_bridge_exceeds_119s_budget'));
 x.measurements.stages[0].elapsedMs=119001;
 assert.ok(check(x).issues.includes('pre_bridge_exceeds_119s_budget'));
});
test('strict expiry 301s, postwait 60s and cleanup 120s are bounded',()=>{
 for(const [index,n,issue] of [
  [1,300999,'natural_expiry_elapsed_not_proven'],
  [2,60001,'post_wait_exceeds_reserved_budget'],
  [3,120001,'cleanup_exceeds_reserved_budget']
 ]){
  const x=fixture();x.measurements.stages[index].elapsedMs=n;
  assert.ok(check(x).issues.includes(issue),issue);
 }
});
test('unknown source or self-pinning approval is rejected',()=>{
 for(const patch of [
  {approvalSha:SOURCE},
  {approvalParentSha:APPROVAL},
  {workflowCheckoutSha:SOURCE},
  {proposedManifestCheckoutCommit:APPROVAL},
  {changedPaths:['tests/rings-now-p2-real-docker-runner.cjs']}
 ]){
  const x=fixture();Object.assign(x.checkoutBinding,patch);
  assert.equal(check(x).status,'BLOCKED_ACTIVATION_NOT_READY');
 }
});
test('hard-stop missing or source manifest already approved blocks',()=>{
 const x=fixture();x.workflow=x.workflow.replace('if: ${{ false }}','if: ${{ true }}');
 assert.ok(check(x).issues.includes('workflow_hard_stop_must_remain'));
 const y=fixture();y.manifest.explicitExecutionApproval=true;
 assert.ok(check(y).issues.includes('manifest_must_remain_unapproved'));
});
test('hypothetical complete metadata remains unverified and cannot enable',()=>{
 const r=check(fixture());
 assert.equal(r.status,'DOCUMENTARY_CANDIDATE_ONLY_INDEPENDENT_VERIFICATION_REQUIRED');
 assert.equal(r.safeToEnable,false);
 assert.equal(r.g4Verified,false);
 assert.equal(r.executionAuthorized,false);
 assert.equal(r.measurementsIndependentlyVerified,false);
 assert.equal(r.sourceProvenanceVerified,false);
 assert.equal(r.billingVerified,false);
});
