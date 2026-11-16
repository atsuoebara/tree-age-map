'use strict';
// Local mock server only. No production endpoints, credentials or workflow wiring.
const test = require('node:test');
const http = require('node:http');
const assert = require('node:assert/strict');
const { createLoopbackTransport } = require('./rings-now-p2-loopback-transport.cjs');
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
