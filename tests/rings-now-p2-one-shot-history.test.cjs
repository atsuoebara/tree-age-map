'use strict';
const assert=require('node:assert/strict');
const {inspectOneShotHistory}=require('./rings-now-p2-one-shot-history.cjs');
const sha='89454a8d3e6ca44ba659b3a338f575486de7fd23';
const branch='audit/rings-now-p2-final-oneshot-89454a8-20261124';
const start='2026-11-24T09:58:00Z';
const run=(id,name=branch,hash=sha)=>({
 id,head_branch:name,head_sha:hash,run_attempt:1,event:'workflow_dispatch',
 created_at:'2026-11-24T12:20:00Z'
});
const check=(runs,extra={})=>inspectOneShotHistory({
 response:{total_count:runs.length,workflow_runs:runs},
 runId:10,headSha:sha,runAttempt:1,branch,windowStart:start,...extra
});
assert.equal(check([run(10)]).pass,true);
assert.equal(check([run(7,'main'),run(8,'audit/rings-now-p2-approved-hold-ac7f5ea7-20261124'),run(10)]).pass,true);
assert.equal(check([run(7,'main'),run(8,'main'),run(9,'main'),run(10)]).pass,true);
assert.equal(check([run(10),run(11)]).pass,false);
assert.equal(check([run(9,'audit/rings-now-p2-final-oneshot-96d866ea-20261124','96d866eae6425a52cce04eeebade9748d991e583'),run(10)]).pass,false);
assert.equal(check([run(10)],{runAttempt:2}).pass,false);
assert.equal(check([run(10)],{runId:11}).pass,false);
assert.equal(check([run(10)],{branch:'main'}).pass,false);
assert.equal(check([run(10)],{headSha:'0'.repeat(40)}).pass,false);
assert.equal(check([run(10)],{windowStart:'bad'}).pass,false);
assert.equal(inspectOneShotHistory({response:{total_count:3,workflow_runs:[run(10)]},runId:10,headSha:sha,runAttempt:1,branch,windowStart:start}).pass,false);
assert.equal(check([{...run(10),head_branch:null}]).pass,false);
assert.equal(check([{...run(10),created_at:'2026-11-20T12:20:00Z'}]).pass,false);
assert.equal(check([{...run(10),event:'pull_request'}]).pass,false);
assert.equal(check([{...run(10),run_attempt:2}]).pass,false);
assert.equal(check([]).pass,false);
assert.equal(inspectOneShotHistory({response:null,runId:10,headSha:sha,runAttempt:1,branch,windowStart:start}).pass,false);
console.log('PASS: offline one-shot guard (wrong-branch clicks ignored; eligible second runs blocked; malformed data blocked)');
