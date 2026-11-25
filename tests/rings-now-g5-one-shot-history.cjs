'use strict';
// Pure decision; incomplete, duplicate or unverifiable history fails closed.
const PREFIX='run/rings-now-g5-';
const SHA=/^[a-f0-9]{40}$/;
function inspectOneShotHistory({response,runId,headSha,runAttempt,branch,windowStart,windowEnd}={}){
 const start=Date.parse(windowStart),end=Date.parse(windowEnd);
 if(!/^[1-9]\d*$/.test(String(runId||''))||!Number.isSafeInteger(Number(runId))||
    !SHA.test(headSha||'')||runAttempt!==1||
    typeof branch!=='string'||!/^run\/rings-now-g5-[a-z0-9-]+$/.test(branch)||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(windowStart||'')||
    !Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>600000)
  return {pass:false,issues:['current_identity_invalid']};
 if(!response||!Array.isArray(response.workflow_runs)||
    !Number.isSafeInteger(response.total_count)||response.total_count<0||
    response.total_count>=100||response.workflow_runs.length!==response.total_count)
  return {pass:false,issues:['history_incomplete']};
 const eligible=[],ids=new Set();
 for(const run of response.workflow_runs){
  if(!run||typeof run.head_branch!=='string'||!Number.isSafeInteger(run.id)||ids.has(run.id)||
     !SHA.test(run.head_sha||'')||typeof run.created_at!=='string'||
     !Number.isFinite(Date.parse(run.created_at))||run.event!=='workflow_dispatch'||
     !Number.isSafeInteger(run.run_attempt)||Date.parse(run.created_at)<start)
   return {pass:false,issues:['history_unverifiable']};
  ids.add(run.id);
  if(run.head_branch.startsWith(PREFIX))eligible.push(run);
 }
 if(eligible.length!==1)return {pass:false,issues:['final_dispatch_count_not_one']};
 const only=eligible[0];
 if(only.id!==Number(runId)||only.head_sha!==headSha||only.head_branch!==branch||
    only.run_attempt!==1||Date.parse(only.created_at)>end)
  return {pass:false,issues:['not_the_unique_final_attempt']};
 return {pass:true,issues:[]};
}
module.exports={inspectOneShotHistory,PREFIX};
