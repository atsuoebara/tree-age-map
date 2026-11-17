'use strict';
// Local mock server only. No production endpoints, credentials or workflow wiring.
const test = require('node:test');
const http = require('node:http');
const assert = require('node:assert/strict');
const { createLoopbackTransport, assertSnapshotRpcResult } = require('./rings-now-p2-loopback-transport.cjs');
const authorization = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjEwMH0.c2ln';
async function withServer(handler, run) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = server.address().port;
    return await run('http://127.0.0.1:' + port + '/rpc/rings_now_snapshot_candidate_v01');
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}
test('loopback transport receives 401 from local mock', async()=>{
  await withServer((req,res)=>{res.writeHead(401);res.end('denied');},async endpoint=>{
    const response=await createLoopbackTransport()({endpoint,method:'POST',authorization,body:{}});
    assert.equal(response.status,401);
  });
});
test('rejects redirect without following it',async()=>{
  await withServer((req,res)=>{res.writeHead(302,{location:'http://example.com/'});res.end();},async endpoint=>{
    const response=await createLoopbackTransport()({endpoint,method:'POST',authorization,body:{}});
    assert.equal(response.status,302);
  });
});
test('rejects trickle response by absolute deadline', {timeout:12000}, async()=>{
  await withServer((req,res)=>{
    res.writeHead(401);
    const timer=setInterval(()=>res.write('x'),100);
    res.on('close',()=>clearInterval(timer));
  },async endpoint=>{
    const start=Date.now();
    await assert.rejects(createLoopbackTransport()({endpoint,method:'POST',authorization,body:{}}),/absolute deadline/);
    const elapsed=Date.now()-start;
    assert.ok(elapsed>=4500 && elapsed<9000,'absolute deadline elapsed: '+elapsed);
  });
});

const own='00000000-0000-4000-8000-000000000001';
const foreign='00000000-0000-4000-8000-000000000002';
function row(id,user_id=own){
 return {id,user_id,activity_date:'2026-11-17',distance_km:5,
  started_at:'2026-11-17T00:00:00+00:00',deleted_at:null};
}
test('loopback reads bounded JSON successful response and validates owner',async()=>{
 await withServer((req,res)=>{
  res.writeHead(200,{'content-type':'application/json'});
  res.end(JSON.stringify({status:'candidate_snapshot',rows:[row(1)]}));
 },async endpoint=>{
  const r=await createLoopbackTransport()({endpoint,method:'POST',authorization,body:{}});
  assert.equal(assertSnapshotRpcResult(r,{subject:own,expectedCount:1}),
   'RPC_RESPONSE_SHAPE_ONLY_NOT_JWT_PROOF');
 });
});
test('foreign owner and duplicate IDs rejected, blocked 1001 status accepted only with no rows',()=>{
 assert.throws(()=>assertSnapshotRpcResult({status:200,
  body:{status:'candidate_snapshot',rows:[row(1,foreign)]}},{subject:own,expectedCount:1}));
 assert.throws(()=>assertSnapshotRpcResult({status:200,
  body:{status:'candidate_snapshot',rows:[row(1),row(1)]}},{subject:own,expectedCount:2}));
 assert.equal(assertSnapshotRpcResult({status:200,
  body:{status:'blocked',reason:'too_many_rows'}},{blockedReason:'too_many_rows'}),
  'RPC_BLOCKED_RESULT_SHAPE_ONLY');
 assert.throws(()=>assertSnapshotRpcResult({status:200,
  body:{status:'blocked',reason:'too_many_rows',rows:[row(1,foreign)]}},
  {blockedReason:'too_many_rows'}));
 assert.throws(()=>assertSnapshotRpcResult({status:401},
  {blockedReason:'too_many_rows'}));
});
test('reject non-JSON or malformed successful RPC responses',async()=>{
 for(const [type,value] of [['text/plain','ok'],['application/json','not-json']]){
  await withServer((req,res)=>{
   res.writeHead(200,{'content-type':type});res.end(value);
  },async endpoint=>{
   await assert.rejects(()=>createLoopbackTransport()({
    endpoint,method:'POST',authorization,body:{}}));
  });
 }
});
test('reject oversized responses before any successful body is returned',async()=>{
 await withServer((req,res)=>{
  res.writeHead(200,{'content-type':'application/json'});
  res.end('x'.repeat(1048577));
 },async endpoint=>{
  await assert.rejects(()=>createLoopbackTransport()({
   endpoint,method:'POST',authorization,body:{}}),/response too large/);
 });
});
