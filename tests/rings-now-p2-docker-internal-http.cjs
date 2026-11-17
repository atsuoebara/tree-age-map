'use strict';
// Safe HTTP/1.1 envelope parser for a Docker-internal, no-published-port
// probe. Nothing on import. NEVER treat output as G3 or JWT proof by itself.
const assert=require('node:assert/strict');
const MAX_WIRE_BYTES=65536;
const RPC='/rpc/rings_now_snapshot_candidate_v01';
function buildProbeRequest(jwt){
 assert.match(jwt||'',/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
 const raw=[
  'POST '+RPC+' HTTP/1.1',
  'Host: postgrest:3000',
  'Authorization: Bearer '+jwt,
  'Accept: application/json',
  'Content-Type: application/json',
  'Content-Length: 2',
  'Connection: close',
  '',
  '{}'
 ].join('\r\n');
 assert.ok(Buffer.byteLength(raw)<4096);
 return raw;
}
function decodeChunked(input){
 let cursor=0,parts=[],size=0;
 for(let count=0;count<256;count++){
  const end=input.indexOf('\r\n',cursor);
  assert.ok(end>cursor&&end-cursor<16,'bad chunk length');
  const hex=input.slice(cursor,end).split(';')[0];
  assert.match(hex,/^[0-9A-Fa-f]+$/);
  const n=Number.parseInt(hex,16);
  assert.ok(n>=0&&n<=MAX_WIRE_BYTES&&size+n<=MAX_WIRE_BYTES);
  cursor=end+2;
  if(n===0){
   assert.equal(input.slice(cursor),'\r\n','chunk trailers forbidden');
   return parts.join('');
  }
  assert.ok(cursor+n+2<=input.length);
  parts.push(input.slice(cursor,cursor+n));size+=n;
  cursor+=n;
  assert.equal(input.slice(cursor,cursor+2),'\r\n');
  cursor+=2;
 }
 throw Error('chunk limit exceeded');
}
function parseInternalHttpResponse(wire){
 assert.equal(typeof wire,'string');
 assert.ok(Buffer.byteLength(wire)<=MAX_WIRE_BYTES,'Docker HTTP output too large');
 const split=wire.indexOf('\r\n\r\n');
 assert.ok(split>0&&split<8192,'missing HTTP headers');
 const lines=wire.slice(0,split).split('\r\n');
 const status=lines.shift().match(/^HTTP\/1\.[01] ([1-5][0-9][0-9])(?: .*)?$/);
 assert.ok(status,'invalid HTTP status');
 const code=Number(status[1]);
 const headers=Object.create(null);
 for(const line of lines){
  const m=line.match(/^([A-Za-z0-9-]+):[ \t]*([^\r\n]*)$/);
  assert.ok(m,'invalid header');
  const k=m[1].toLowerCase();
  assert.ok(!Object.hasOwn(headers,k),'duplicate HTTP header');
  headers[k]=m[2].trim();
 }
 assert.ok(!headers['content-encoding'],'compressed responses prohibited');
 const chunked=(headers['transfer-encoding']||'').toLowerCase()==='chunked';
 assert.ok(!headers['transfer-encoding']||chunked,'unsupported encoding');
 assert.ok(!(chunked&&headers['content-length']),'ambiguous response framing');
 let body=wire.slice(split+4);
 if(chunked)body=decodeChunked(body);
 else if(headers['content-length']!==undefined){
  assert.match(headers['content-length'],/^[0-9]+$/);
  assert.equal(Buffer.byteLength(body),Number(headers['content-length']),'length mismatch');
 }
 if(code!==200)return Object.freeze({status:code});
 assert.match(headers['content-type']||'',/^application\/json(?:;|$)/i);
 const obj=JSON.parse(body);
 assert.ok(obj&&typeof obj==='object'&&!Array.isArray(obj),'RPC response not object');
 return Object.freeze({status:code,body:obj});
}
module.exports={buildProbeRequest,parseInternalHttpResponse,MAX_WIRE_BYTES};
