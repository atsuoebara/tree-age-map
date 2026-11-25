'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {inspectOneShotHistory}=require('./rings-now-g5-one-shot-history.cjs');
const branch='run/rings-now-g5-test',headSha='a'.repeat(40),windowStart='2026-11-25T09:00:00Z',windowEnd='2026-11-25T09:10:00Z';
const run={id:10,head_branch:branch,head_sha:headSha,created_at:windowStart,event:'workflow_dispatch',run_attempt:1};
function check(runs,patch={}){
 return inspectOneShotHistory({response:{total_count:runs.length,workflow_runs:runs},runId:'10',headSha,runAttempt:1,branch,windowStart,windowEnd,...patch}).pass;
}
test('unique exact dispatch only',()=>{assert.equal(check([run]),true);assert.equal(check([run,{...run,id:11,head_branch:'main'}]),true);});
test('second final dispatch and wrong identity blocked',()=>{assert.equal(check([run,{...run,id:11}]),false);assert.equal(check([run],{runId:'11'}),false);assert.equal(check([run],{runAttempt:2}),false);});
test('missing incomplete or out-of-window history blocked',()=>{assert.equal(check([]),false);assert.equal(check([run],{response:{total_count:2,workflow_runs:[run]}}),false);assert.equal(check([{...run,created_at:'2026-11-25T09:10:01Z'}]),false);});
