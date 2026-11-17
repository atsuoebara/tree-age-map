'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {runBoundedChild,MAX_STAGE_MS}=require('./rings-now-p2-process-watchdog.cjs');
const script=path.join(__dirname,'rings-now-p2-process-watchdog-fixture.cjs');
test('fast synthetic success exits zero and reports PASS',async()=>{
 const r=await runBoundedChild({script,args:['success'],timeoutMs:2000});
 assert.equal(r.status,'PASS');assert.equal(r.timedOut,false);assert.equal(r.childClosed,true);
 assert.equal(r.groupTerminationVerified,false);
});
test('synthetic nonzero exit always FAIL',async()=>{
 const r=await runBoundedChild({script,args:['failure'],timeoutMs:2000});
 assert.equal(r.status,'FAIL');assert.equal(r.exitCode,7);
});
test('hung process is bounded and receives termination signal',async()=>{
 const r=await runBoundedChild({script,args:['hang'],timeoutMs:250,graceMs:200});
 assert.equal(r.status,'FAIL');assert.equal(r.timedOut,true);assert.equal(r.termSent,true);
 assert.equal(r.groupTerminationVerified,false);
});
test('TERM-resistant child must not hang forever (escalates to KILL)',async()=>{
 const r=await runBoundedChild({script,args:['ignore-term'],timeoutMs:300,graceMs:100});
 assert.equal(r.status,'FAIL');assert.equal(r.timedOut,true);assert.equal(r.termSent,true);
 assert.equal(r.killSent,true);
});
test('input gate enforces bounded stages, no shell arguments',async()=>{
 for(const input of [0,MAX_STAGE_MS+1,2.5,-1])
  assert.throws(()=>runBoundedChild({script,args:['success'],timeoutMs:input}));
 assert.throws(()=>runBoundedChild({script:'relative.cjs',timeoutMs:20}));
 assert.throws(()=>runBoundedChild({script,args:[1],timeoutMs:20}));
});
test('synthetic cleanup stage can independently expire, never PASS',async()=>{
 const execution=await runBoundedChild({script,args:['success'],timeoutMs:2000});
 const cleanup=await runBoundedChild({script,args:['hang'],timeoutMs:200,graceMs:75});
 assert.equal(execution.status,'PASS');
 assert.equal(cleanup.status,'FAIL');
 assert.equal(cleanup.timedOut,true);
 // A real coordinator must never promote execution PASS over cleanup FAIL.
 assert.notEqual(cleanup.status,'PASS');
});
test('missing child file cannot report PASS',async()=>{
 const r=await runBoundedChild({script:'/path/does-not-exist.cjs',timeoutMs:2000});
 assert.equal(r.status,'FAIL');
});
