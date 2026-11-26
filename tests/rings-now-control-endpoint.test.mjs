import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handleRingsNowControl} from '../supabase/functions/rings-now-control/contract.mjs';
const ENDPOINT_URL='https://example.invalid/functions/v1/rings-now-control';
const ORIGIN='https://runnersrings.com';
const payload={protocol:'rings-now-review-v1',build:'v1'};
const call=(body,options={})=>handleRingsNowControl(new Request(ENDPOINT_URL,{
  method:'POST',headers:{'content-type':'application/json',origin:ORIGIN,...(options.headers||{})},
  body:typeof body==='string'?body:JSON.stringify(body),
}));
async function assertDeny(response,status){
 assert.equal(response.status,status);
 assert.equal(response.headers.get('access-control-allow-origin'),ORIGIN);
 assert.match(response.headers.get('cache-control'),/no-store/);
 assert.equal(response.headers.get('x-content-type-options'),'nosniff');
 assert.deepEqual(await response.json(),{protocol:'rings-now-review-v1',build:'v1',enabled:false});
}
test('valid control request is still never authorized',async()=>{
 await assertDeny(await call(payload),200);
});
test('additional personal and FIT fields are rejected without reflection',async()=>{
 for(const key of ['fit','gps','heartRate','userId','email','token','deviceId','activityId']){
  await assertDeny(await call({...payload,[key]:'personal'}),400);
 }
});
test('missing or wrong contract and malformed requests are rejected',async()=>{
 for(const body of [{build:'v1'}, {protocol:'rings-now-review-v1'},
  {protocol:'rings-now-review-v2',build:'v1'},
  {protocol:'rings-now-review-v1',build:'v2'},
  null, [], 'bad', 123, true]){
  await assertDeny(await call(body),400);
 }
 await assertDeny(await call('not json'),400);
});
test('oversized bodies and wrong content type fail closed',async()=>{
 await assertDeny(await call({...payload,pad:'x'.repeat(2000)}),400);
 await assertDeny(await call(payload,{headers:{'content-type':'text/plain'}}),415);
});
test('only approved origin gets POST preflight; other methods and origins deny',async()=>{
 for(const method of ['GET','HEAD']){
  const r=await handleRingsNowControl(new Request(ENDPOINT_URL,{method,headers:{origin:ORIGIN}}));
  assert.equal(r.status,405);
 }
 const preflight=await handleRingsNowControl(new Request(ENDPOINT_URL,{method:'OPTIONS',headers:{origin:ORIGIN,'access-control-request-method':'POST','access-control-request-headers':'content-type'}}));
 assert.equal(preflight.status,204);
 assert.equal(preflight.headers.get('access-control-allow-origin'),ORIGIN);
 assert.equal(preflight.headers.get('access-control-allow-credentials'),null);
 for(const origin of ['null','https://evil.invalid','https://www.runnersrings.com','']){
  const r=await call(payload,{headers:{origin}});
  assert.equal(r.status,403);assert.equal(r.headers.get('access-control-allow-origin'),null);
 }
 const invalid=await handleRingsNowControl(new Request(ENDPOINT_URL,{method:'OPTIONS',headers:{origin:ORIGIN,'access-control-request-method':'POST','access-control-request-headers':'authorization'}}));
 assert.equal(invalid.status,403);
});
test('endpoint never touches production pages or secrets and cannot turn on',()=>{
 const src=readFileSync(new URL('../supabase/functions/rings-now-control/contract.mjs',import.meta.url),'utf8');
 const entry=readFileSync(new URL('../supabase/functions/rings-now-control/index.ts',import.meta.url),'utf8');
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.match(index,/const RR_RINGS_NOW_REAL_FIT_READ_ENABLED=false;/);
 assert.doesNotMatch(sw,/rings-now-control/);
 assert.match(index,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
 for(const re of [/\bfetch\s*\(/,/\bXMLHttpRequest\b/,/\blocalStorage\b/,/\bindexedDB\b/,/\bconsole\./,/createClient\s*\(/])assert.doesNotMatch(src+entry,re);
 assert.doesNotMatch(src+entry,/enabled\s*:\s*true/);
});
