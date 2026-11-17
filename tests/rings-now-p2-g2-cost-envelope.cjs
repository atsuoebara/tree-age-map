'use strict';
// G2 offline documentary cost envelope checker, NOT billing verification.
// Never reads accounts, secrets, Actions or an execution environment.
const assert=require('node:assert/strict');
const SHA=/^[0-9a-f]{40}$/;
const ISO=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/;
const REQUIRED=Object.freeze(['repository','checkoutCommit','runner','billing','costControls']);
function inspectG2CostEnvelope(envelope) {
 const issues=[];
 const fail=x=>issues.push(x);
 if(!envelope||typeof envelope!=='object'||Array.isArray(envelope))
  return Object.freeze({status:'BLOCKED',issues:Object.freeze(['invalid_envelope']),g2Verified:false,p2ExecutionAuthorized:false});
 const e=envelope;
 if(e.purpose!=='DOCUMENTARY_PREFLIGHT_ONLY'||e.executionApproval!==false)
  fail('not_documentary_only');
 if(e.repository!=='atsuoebara/tree-age-map')fail('repository_mismatch');
 if(!SHA.test(e.checkoutCommit||''))fail('checkout_not_pinned');
 if(e.runner?.kind!=='github-hosted-standard'||e.runner?.os!=='ubuntu-latest'||
    e.runner?.largerRunner!==false||e.runner?.jobs!==1||
    e.runner?.concurrency!==1||e.runner?.maxJobMinutes!==10||
    e.runner?.retries!==0)fail('runner_envelope_not_fixed');
 if(e.costControls?.artifactUpload!==false||e.costControls?.cacheWrites!==false||
    e.costControls?.externalPaidServices!==false||
    e.costControls?.additionalRunnerTypesAllowed!==false)
  fail('cost_controls_unbounded');
 if(e.billing?.source!=='GITHUB_BILLING_ACCOUNT_UI'||e.billing?.accountScope!=='REPOSITORY_OWNER'||
    e.billing?.currentActionsChargeUsd!==0||e.billing?.actionsBudgetUsd!==0||
    e.billing?.usageBlockedObserved!==true)
  fail('billing_observation_incomplete');
 if(!ISO.test(e.billing?.observedAt||'')||
    Number.isNaN(Date.parse(e.billing?.observedAt||'')))
  fail('billing_timestamp_invalid');
 if(e.billing?.observationEvidenceId===null||
    typeof e.billing?.observationEvidenceId!=='string'||
    !e.billing.observationEvidenceId.trim())fail('billing_evidence_missing');
 if(e.billing?.futureRunIncrementalCostProven!==false)
  fail('future_cost_must_remain_unproven');
 if(e.billing?.storageCostVerifiedForRun!==false||
    e.billing?.standardRunnerEligibilityVerifiedForRun!==false)
  fail('future_entitlement_must_remain_unproven');
 if(e.g2Verified!==false||e.p2ExecutionAuthorized!==false)
  fail('approval_flag_forged');
 // A self-reported JSON object can never prove future billing, eligibility,
 // storage or surprise charges. It is intentionally impossible to emit PASS.
 return Object.freeze({
  status:issues.length?'BLOCKED':'DOCUMENTARY_ENVELOPE_COMPLETE_COST_NOT_PROVEN',
  issues:Object.freeze(issues),g2Verified:false,p2ExecutionAuthorized:false
 });
}
module.exports={inspectG2CostEnvelope,REQUIRED};
