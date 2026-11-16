'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {observeExpiredTokenRejection} = require('./rings-now-p2-http-observation-adapter.cjs');
const jwt = exp => 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({sub:'synthetic',exp})).toString('base64url') + '.c2ln';
const endpoint = 'http://127.0.0.1:54321/rpc/rings_now_snapshot_candidate_v01';
test('requires an expired token and server rejection together', async()=>{
  const token=jwt(100);
  let calls=0;
  const result=await observeExpiredTokenRejection({
    token,nowSeconds:100,endpoint,
    request:async req=>{
      calls++;
      assert.equal(req.authorization,'Bearer '+token);
      assert.equal(req.method,'POST');
      assert.equal(req.endpoint,endpoint);
      return {status:401};
    }
  });
  assert.equal(calls,1);
  assert.deepEqual(result,{verified:true,httpStatus:401});
});
test('fails closed when expiry or rejection is missing',async()=>{
  const token=jwt(100);
  for (const [nowSeconds,status] of [[99,401],[100,200],[100,404],[100,'401']]) {
    await assert.rejects(observeExpiredTokenRejection({
      token,nowSeconds,endpoint,request:async()=>({status})
    }));
  }
});
test('rejects external URLs before calling transport',async()=>{
  let calls=0;
  const request=async()=>{calls++;return {status:401};};
  for(const unsafe of [
    'https://127.0.0.1:54321/rpc/x',
    'http://example.com:54321/rpc/x',
    'http://127.0.0.1:54321@evil.example/rpc/x',
    'http://127.0.0.1/rpc/x',
    'http://127.0.0.1:54321/rpc/x?token=1',
    'http://127.0.0.1:54321/rpc/x#fragment'
  ]) {
    await assert.rejects(observeExpiredTokenRejection({
      token:jwt(100),nowSeconds:100,endpoint:unsafe,request
    }),unsafe);
  }
  assert.equal(calls,0);
});
test('missing transport or missing observation rejects',async()=>{
  await assert.rejects(observeExpiredTokenRejection({token:jwt(100),nowSeconds:100,endpoint}));
  await assert.rejects(observeExpiredTokenRejection({token:jwt(100),nowSeconds:100,endpoint,request:async()=>null}));
});
