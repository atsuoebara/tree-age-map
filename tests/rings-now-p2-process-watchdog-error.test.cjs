'use strict';
// Deterministic synthetic EventEmitter tests for abnormal child lifecycle.
// No real P2 process, Auth, SQL, HTTP, Docker or GitHub Actions.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {runBoundedChild}=require('./rings-now-p2-process-watchdog.cjs');
const script='/synthetic/only.cjs';
function fakeSpawn(onSpawn) {
 return (...args)=>{
  const child=new EventEmitter();
  child.pid=undefined; // no external PID and no process group to signal
  queueMicrotask(()=>onSpawn(child,args));
  return child;
 };
}
test('error without close resolves FAIL within grace, never claims childClosed',async()=>{
 const result=await runBoundedChild({script,timeoutMs:200,graceMs:12,
  spawnImpl:fakeSpawn(child=>child.emit('error',Object.assign(Error('synthetic'),{code:'EFAKE'})))});
 assert.equal(result.status,'FAIL');
 assert.equal(result.spawnError,'EFAKE');
 assert.equal(result.timedOut,false);
 assert.equal(result.childClosed,false);
 assert.equal(result.groupTerminationVerified,false);
});
test('error followed by close resolves FAIL and truthfully marks childClosed',async()=>{
 const result=await runBoundedChild({script,timeoutMs:200,graceMs:25,
  spawnImpl:fakeSpawn(child=>{
   child.emit('error',Object.assign(Error('synthetic'),{code:'EFAKE'}));
   child.emit('close',0,null);
  })});
 assert.equal(result.status,'FAIL');
 assert.equal(result.childClosed,true);
 assert.equal(result.spawnError,'EFAKE');
});
test('timeout without error or close resolves FAIL after escalation',async()=>{
 const result=await runBoundedChild({script,timeoutMs:12,graceMs:10,
  spawnImpl:fakeSpawn(()=>{})});
 assert.equal(result.status,'FAIL');
 assert.equal(result.timedOut,true);
 assert.equal(result.childClosed,false);
 assert.equal(result.groupTerminationVerified,false);
});
test('late close after error fallback cannot promote FAIL to PASS',async()=>{
 let child;
 const result=await runBoundedChild({script,timeoutMs:200,graceMs:10,
  spawnImpl:fakeSpawn(c=>{
   child=c;
   c.emit('error',Object.assign(Error('synthetic'),{code:'EFAKE'}));
  })});
 assert.equal(result.status,'FAIL');
 child.emit('close',0,null);
 assert.equal(result.status,'FAIL');
 assert.equal(result.childClosed,false); // snapshot freezes result truth at settlement
});
test('mock implementation is explicit and cannot run via shell',async()=>{
 let seen;
 const result=await runBoundedChild({script,timeoutMs:200,
  spawnImpl:fakeSpawn((child,args)=>{
   seen=args;
   child.emit('close',0,null);
  })});
 assert.equal(result.status,'PASS');
 assert.equal(seen[2].shell,false);
 assert.equal(seen[2].detached,true);
 assert.deepEqual(seen[2].env,{});
});
