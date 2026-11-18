'use strict';
// Pure contract for a future approval-only CHILD commit. Import has no I/O.
// Only in a separately approved runner will real Git information be supplied.
const assert=require('node:assert/strict');
const SHA=/^[0-9a-f]{40}$/;
const ALLOWED=Object.freeze([
 '.github/workflows/rings-now-p2-isolated-manual.yml',
 'tests/rings-now-p2-isolated-manifest.json'
]);
function inspectApprovalOnlyChild({manifest,checkoutSha,parents,changedPaths}={}){
 const issues=[];
 const fail=x=>{if(!issues.includes(x))issues.push(x);};
 if(!SHA.test(checkoutSha||''))fail('checkout_sha_invalid');
 if(!Array.isArray(parents)||parents.length!==1||!SHA.test(parents[0]||''))
  fail('exactly_one_parent_required');
 const source=Array.isArray(parents)&&parents.length===1?parents[0]:null;
 if(!SHA.test(manifest?.checkoutCommit||'')||
    manifest?.checkoutCommit!==source||
    manifest?.checkoutCommit===checkoutSha)
  fail('manifest_source_parent_mismatch');
 if(!Array.isArray(changedPaths)||changedPaths.length<1||
    changedPaths.length>ALLOWED.length||
    new Set(changedPaths).size!==changedPaths.length||
    !changedPaths.every(p=>ALLOWED.includes(p)))
  fail('approval_delta_not_restricted');
 if(manifest?.productionAccess!==false)
  fail('production_access_not_denied');
 return Object.freeze({
  status:issues.length?'BLOCKED_APPROVAL_ONLY_CHILD':
   'DECLARED_PARENT_AND_DIFF_MATCH_NOT_EXECUTION_APPROVAL',
  issues:Object.freeze(issues),sourceSha:source,
  sourceContentsIndependentlyAudited:false,gitObjectAuthenticityVerified:false,
  g4Verified:false,executionAuthorized:false
 });
}
module.exports={inspectApprovalOnlyChild,ALLOWED};
