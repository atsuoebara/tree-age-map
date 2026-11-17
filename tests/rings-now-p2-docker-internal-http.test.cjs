'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildProbeRequest,parseInternalHttpResponse}=require('./rings-now-p2-docker-internal-http.cjs');
const payload=JSON.stringify({status:'candidate_snapshot',rows:[]});
const http=(body,extra='')=>'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: '+Buffer.byteLength(body)+'\r\n'+extra+'\r\n'+body;
test('strict request only permits a syntactically valid JWT and exact internal RPC',()=>{
 const jwt='eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYXV0aGVudGljYXRlZCJ9.c2ln';
 const r=buildProbeRequest(jwt);
 assert.match(r,/^POST \/rpc\/rings_now_snapshot_candidate_v01 HTTP\/1\.1\r\n/);
 assert.ok(r.endsWith('\r\n\r\n{}'));
 assert.ok(r.includes('Host: postgrest:3000\r\n'));
 assert.ok(r.includes('Connection: close\r\n'));
 assert.throws(()=>buildProbeRequest('JWT WITH SPACES'));
});
test('parse bounded fixed JSON content-length response',()=>{
 assert.deepEqual(parseInternalHttpResponse(http(payload)),{
  status:200,body:{status:'candidate_snapshot',rows:[]}});
});
test('reject duplicate content-length, ambiguous encoding, JSON corruption and truncation',()=>{
 const bad=[
  http(payload,'Content-Length: 41\r\n'),
  'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\nContent-Length: 2\r\n\r\n',
  http('not json'),
  'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 999\r\n\r\n{}',
  http(payload,'Content-Encoding: gzip\r\n')
 ];
 for(const wire of bad)assert.throws(()=>parseInternalHttpResponse(wire));
});
test('chunked response with no trailers parsed; trailers rejected',()=>{
 const wire='HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\n\r\n'+payload.length.toString(16)+'\r\n'+payload+'\r\n0\r\n\r\n';
 assert.equal(parseInternalHttpResponse(wire).body.status,'candidate_snapshot');
 assert.throws(()=>parseInternalHttpResponse(wire.replace('0\r\n\r\n','0\r\nX: yes\r\n\r\n')));
});
test('non-200 HTTP body is not surfaced, redirects and error status not promoted',()=>{
 const r=parseInternalHttpResponse('HTTP/1.1 401 Unauthorized\r\nContent-Length: 6\r\n\r\nsecret');
 assert.deepEqual(r,{status:401});assert.equal('body' in r,false);
 assert.equal(parseInternalHttpResponse('HTTP/1.1 302 Found\r\nContent-Length: 0\r\n\r\n').status,302);
});
test('large responses and malformed headers fail closed',()=>{
 assert.throws(()=>parseInternalHttpResponse(http('x'.repeat(65536))));
 assert.throws(()=>parseInternalHttpResponse('HTTP/1.1 200 OK\r\nContent-type: application/json\r\ncontent-type: application/json\r\n\r\n{}'));
 assert.throws(()=>parseInternalHttpResponse('not HTTP'));
});
