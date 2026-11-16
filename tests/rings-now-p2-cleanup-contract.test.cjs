'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {runWithVerifiedCleanup} = require('./rings-now-p2-cleanup-contract.cjs');

test('PASS requires execution, cleanup AND independent cleanup verification', async () => {
  const order=[];
  const result=await runWithVerifiedCleanup({
    execute:async()=>{order.push('execute'); return {status:'PASS'};},
    cleanup:async()=>{order.push('cleanup'); return {status:'CLEAN'};},
    verifyCleanup:async()=>{order.push('verify'); return {verified:true};}
  });
  assert.deepEqual(order,['execute','cleanup','verify']);
  assert.equal(result.status,'PASS');
  assert.equal(result.cleanupAttempted,true);
  assert.equal(Object.isFrozen(result),true);
});
test('an execution exception cannot bypass cleanup', async () => {
  const order=[];
  const result=await runWithVerifiedCleanup({
    execute:async()=>{order.push('execute'); throw Error('synthetic');},
    cleanup:async()=>{order.push('cleanup'); return {status:'CLEAN'};},
    verifyCleanup:async()=>{order.push('verify');return {verified:true};}
  });
  assert.deepEqual(order,['execute','cleanup','verify']);
  assert.equal(result.status,'FAIL');
  assert.equal(result.executionError,true);
});
test('cleanup failure overrides successful execution', async () => {
  const result=await runWithVerifiedCleanup({
    execute:async()=>({status:'PASS'}),
    cleanup:async()=>{throw Error('synthetic cleanup failure');},
    verifyCleanup:async()=>({verified:true})
  });
  assert.equal(result.status,'FAIL');
  assert.equal(result.cleanupResult,'FAIL');
  assert.equal(result.cleanupError,true);
});
test('cleanup not confirmed cannot claim PASS', async () => {
  for (const cleanupResult of [{status:'UNKNOWN'}, undefined, {status:'CLEAN'}]) {
    const result=await runWithVerifiedCleanup({
      execute:async()=>({status:'PASS'}),
      cleanup:async()=>cleanupResult,
      verifyCleanup:async()=>({verified:false})
    });
    assert.equal(result.status,'NOT_PROVEN');
  }
});
test('verification exception remains NOT_PROVEN', async () => {
  const result=await runWithVerifiedCleanup({
    execute:async()=>({status:'PASS'}),
    cleanup:async()=>({status:'CLEAN'}),
    verifyCleanup:async()=>{throw Error('synthetic verification error');}
  });
  assert.equal(result.status,'NOT_PROVEN');
  assert.equal(result.cleanupVerified,false);
});
test('not proven observations cannot become PASS through cleanup', async () => {
  for(const outcome of [undefined, {status:'UNKNOWN'}, {status:'NOT_PROVEN'}]) {
    const result=await runWithVerifiedCleanup({
      execute:async()=>outcome,
      cleanup:async()=>({status:'CLEAN'}),
      verifyCleanup:async()=>({verified:true})
    });
    assert.equal(result.status,'NOT_PROVEN');
  }
});
test('FAIL observation persists even if cleanup succeeds', async () => {
  const result=await runWithVerifiedCleanup({
    execute:async()=>({status:'FAIL'}),
    cleanup:async()=>({status:'CLEAN'}),
    verifyCleanup:async()=>({verified:true})
  });
  assert.equal(result.status,'FAIL');
});
test('all three callbacks are mandatory before any work', async () => {
  assert.throws(()=>runWithVerifiedCleanup({execute:()=>{},cleanup:()=>{}}));
  assert.throws(()=>runWithVerifiedCleanup({execute:()=>{},verifyCleanup:()=>{}}));
  assert.throws(()=>runWithVerifiedCleanup({cleanup:()=>{},verifyCleanup:()=>{}}));
});
