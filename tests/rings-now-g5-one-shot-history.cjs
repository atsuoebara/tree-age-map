'use strict';
// Offline decision function. No GitHub access and no side effects.
// Only an explicitly named final G4 branch consumes a one-shot approval.
// Wrong selections (main, earlier hold branches) cannot consume the grant.
const PREFIX='run/rings-now-g5-';
const SHA=/^[a-f0-9]{40}$/;
function inspectOneShotHistory({response,runId,headSha,runAttempt,branch,windowStart,windowEnd}={}){
 const issues=[];
 if(!/^[1-9]\d*$/.test(String(runId||''))||!SHA.test(headSha||'')||
    runAttempt!==1||typeof windowStart!=='string'||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(windowStart)||
    !Number.isFinite(Date.parse(windowStart))||!Number.isFinite(Date.parse(windowEnd))||Date.parse(windowEnd)<=Date.parse(windowStart)||Date.parse(windowEnd)-Date.parse(windowStart)>600000||
    typeof branch!=='string'||!branch.startsWith(PREFIX))issues.push('current_identity_invalid');
 const suffix=(branch||'').slice(PREFIX.length);
 if(!new RegExp('^[a-z0-9-]+issues.push('final_branch_mismatch');
 if(!response||typeof response!=='object'||!Array.isArray(response.workflow_runs)||
    !Number.isSafeInteger(response.total_count)||response.total_count<0||
    response.total_count>=100||response.workflow_runs.length!==response.total_count)
   issues.push('history_incomplete');
 if(issues.length)return {pass:false,issues};
 const eligible=[];
 for(const run of response.workflow_runs){
  if(!run||typeof run!=='object'||typeof run.head_branch!=='string'||
     !Number.isSafeInteger(run.id)||typeof run.head_sha!=='string'||
     typeof run.created_at!=='string'||!Number.isFinite(Date.parse(run.created_at))||
     typeof run.event!=='string'||!Number.isSafeInteger(run.run_attempt))
    return {pass:false,issues:['history_unverifiable']};
  if(run.event!=='workflow_dispatch')return {pass:false,issues:['unexpected_event']};
  if(Date.parse(run.created_at)<Date.parse(windowStart))
    return {pass:false,issues:['history_window_violation']};
  if(run.head_branch.startsWith(PREFIX))eligible.push(run);
 }
 if(eligible.length!==1)return {pass:false,issues:['final_dispatch_count_not_one']};
 const only=eligible[0];
 if(only.id!==Number(runId)||only.head_sha!==headSha||
    only.head_branch!==branch||only.run_attempt!==1||Date.parse(only.created_at)>Date.parse(windowEnd))
    return {pass:false,issues:['not_the_unique_final_attempt']};
 return {pass:true,issues:[]};
}
module.exports={inspectOneShotHistory,PREFIX};
).test(suffix))issues.push('final_branch_mismatch');
 if(!response||typeof response!=='object'||!Array.isArray(response.workflow_runs)||
    !Number.isSafeInteger(response.total_count)||response.total_count<0||
    response.total_count>=100||response.workflow_runs.length!==response.total_count)
   issues.push('history_incomplete');
 if(issues.length)return {pass:false,issues};
 const eligible=[];
 for(const run of response.workflow_runs){
  if(!run||typeof run!=='object'||typeof run.head_branch!=='string'||
     !Number.isSafeInteger(run.id)||typeof run.head_sha!=='string'||
     typeof run.created_at!=='string'||!Number.isFinite(Date.parse(run.created_at))||
     typeof run.event!=='string'||!Number.isSafeInteger(run.run_attempt))
    return {pass:false,issues:['history_unverifiable']};
  if(run.event!=='workflow_dispatch')return {pass:false,issues:['unexpected_event']};
  if(Date.parse(run.created_at)<Date.parse(windowStart))
    return {pass:false,issues:['history_window_violation']};
  if(run.head_branch.startsWith(PREFIX))eligible.push(run);
 }
 if(eligible.length!==1)return {pass:false,issues:['final_dispatch_count_not_one']};
 const only=eligible[0];
 if(only.id!==Number(runId)||only.head_sha!==headSha||
    only.head_branch!==branch||only.run_attempt!==1)
    return {pass:false,issues:['not_the_unique_final_attempt']};
 return {pass:true,issues:[]};
}
module.exports={inspectOneShotHistory,PREFIX};
