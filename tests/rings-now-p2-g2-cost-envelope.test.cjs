'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {inspectG2CostEnvelope}=require('./rings-now-p2-g2-cost-envelope.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
function sample() {return {
 purpose:'DOCUMENTARY_PREFLIGHT_ONLY',executionApproval:false,
 repository:'atsuoebara/tree-age-map',checkoutCommit:'a'.repeat(40),
 runner:{kind:'github-hosted-standard',os:'ubuntu-latest',largerRunner:false,jobs:1,concurrency:1,maxJobMinutes:10,retries:0},
 costControls:{artifactUpload:false,cacheWrites:false,externalPaidServices:false,additionalRunnerTypesAllowed:false},
 billing:{source:'GITHUB_BILLING_ACCOUNT_UI',accountScope:'REPOSITORY_OWNER',
  currentActionsChargeUsd:0,actionsBudgetUsd:0,usageBlockedObserved:true,
  observedAt:'2026-11-17T05:00:00Z',observationEvidenceId:'SYNTHETIC_TEST_ONLY',
  futureRunIncrementalCostProven:false,storageCostVerifiedForRun:false,
  standardRunnerEligibilityVerifiedForRun:false},
 g2Verified:false,p2ExecutionAuthorized:false
};}
const check=x=>inspectG2CostEnvelope(x);
test('all synthetic evidence fields can never prove zero future costs',()=>{
 const r=check(sample());
 assert.equal(r.status,'DOCUMENTARY_ENVELOPE_COMPLETE_COST_NOT_PROVEN');
 assert.equal(r.g2Verified,false);assert.equal(r.p2ExecutionAuthorized,false);
});
test('missing input is blocked',()=>{
 assert.equal(check(null).status,'BLOCKED');
 assert.equal(check([]).status,'BLOCKED');
});
test('wrong repository or unchecked HEAD is blocked',()=>{
 const x=sample();x.repository='someone/other';assert.equal(check(x).status,'BLOCKED');
 const y=sample();y.checkoutCommit=null;assert.equal(check(y).status,'BLOCKED');
});
test('larger runner, parallel jobs, extended time or retries blocked',()=>{
 const changes=[{largerRunner:true},{kind:'self-hosted'},{jobs:2},{maxJobMinutes:11},{concurrency:2},{retries:1}];
 for(const patch of changes) {const x=sample();Object.assign(x.runner,patch);assert.equal(check(x).status,'BLOCKED');}
});
test('artifacts, caches, other paid services cannot silently activate',()=>{
 for(const key of ['artifactUpload','cacheWrites','externalPaidServices','additionalRunnerTypesAllowed']){
  const x=sample();x.costControls[key]=true;assert.equal(check(x).status,'BLOCKED');
 }
});
test('billing $0 and blocked usage observations are not inferred',()=>{
 for(const patch of [{currentActionsChargeUsd:1},{actionsBudgetUsd:1},{usageBlockedObserved:false},{observationEvidenceId:''}]){
  const x=sample();Object.assign(x.billing,patch);assert.equal(check(x).status,'BLOCKED');
 }
});
test('future cost or entitlement verification cannot be self-proclaimed',()=>{
 for(const patch of [{futureRunIncrementalCostProven:true},{storageCostVerifiedForRun:true},{standardRunnerEligibilityVerifiedForRun:true}]){
  const x=sample();Object.assign(x.billing,patch);assert.equal(check(x).status,'BLOCKED');
 }
});
test('forged approval and malformed timestamp are rejected',()=>{
 for(const patch of [{g2Verified:true},{p2ExecutionAuthorized:true},{executionApproval:true}])
  assert.equal(check(Object.assign(sample(),patch)).status,'BLOCKED');
 const x=sample();x.billing.observedAt='not-a-date';assert.equal(check(x).status,'BLOCKED');
});
