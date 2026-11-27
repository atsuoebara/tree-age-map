import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRingsNowControlRequest,normalizeRingsNowControl} from '../src/rings-now-control-client.mjs';
import {handleRingsNowControl} from '../supabase/functions/rings-now-control/contract.mjs';
const endpoint='https://fhwvntpzwyenendhcgbw.supabase.co/functions/v1/rings-now-control';
test('disabled client never connects',async()=>{
 let calls=0;const request=createRingsNowControlRequest({fetchImpl:async()=>{calls++}});
 assert.equal(await request(),null);assert.equal(calls,0);
});
test('fixed anonymous request reaches existing always-deny handler',async()=>{
 let calls=0;const request=createRingsNowControlRequest({enabled:true,fetchImpl:async(url,opts)=>{
  calls++;assert.equal(url,endpoint);assert.equal(opts.credentials,'omit');assert.equal(opts.cache,'no-store');
  assert.equal(opts.referrerPolicy,'no-referrer');assert.equal(opts.redirect,'error');
  assert.deepEqual(opts.headers,{'content-type':'application/json'});
  assert.deepEqual(JSON.parse(opts.body),{protocol:'rings-now-review-v1',build:'v1'});
  const response=await handleRingsNowControl(new Request(url,{method:opts.method,headers:{...opts.headers,origin:'https://runnersrings.com'},body:opts.body}));
  Object.defineProperty(response,'url',{value:url});return response;
 }});
 assert.deepEqual(await request(),{protocol:'rings-now-review-v1',build:'v1',enabled:false});assert.equal(calls,1);
});
test('unrecognized, oversized, cached and failed control responses deny',async()=>{
 for(const [body,cache,status] of [
  [{protocol:'rings-now-review-v1',build:'v1',enabled:true,extra:1},'no-store',200],
  [{protocol:'rings-now-review-v1',build:'v2',enabled:true},'no-store',200],
  [{protocol:'rings-now-review-v1',build:'v1',enabled:true},'max-age=3600',200],
  [{protocol:'rings-now-review-v1',build:'v1',enabled:true},'no-store',403],
  ['x'.repeat(129),'no-store',200]]){
  const request=createRingsNowControlRequest({enabled:true,fetchImpl:async()=>{
   const r=new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':cache}});
   Object.defineProperty(r,'url',{value:endpoint});return r;
  }});assert.equal(await request(),null);
 }
 assert.equal(normalizeRingsNowControl(null),null);
 assert.equal(await createRingsNowControlRequest({enabled:true,fetchImpl:async()=>{throw Error('offline')}})(),null);
});
test('published document and host retain disabled gates, opaque frame, no file input on entry',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 const html=read('index.html'),frame=read('rings-now-fit-frame.html'),host=read('src/rings-now-fit-screen-host.mjs'),child=read('src/rings-now-fit-frame.mjs'),sw=read('sw.js');
 assert.match(html,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false/);
 assert.match(html,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null/);
 assert.match(html,/RR_RINGS_NOW_REAL_FIT_READ_ENABLED=false/);
 assert.match(child,/REAL_FIT_SCREEN_ENABLED=false/);
 assert.match(host,/setAttribute\('sandbox','allow-scripts'\)/);
 assert.doesNotMatch(host,/allow-same-origin|allow-top-navigation|allow-forms/);
 assert.match(frame,/connect-src 'none'/);assert.match(frame,/form-action 'none'/);
 assert.doesNotMatch(frame,/<input|<form|<iframe/);
 assert.doesNotMatch(child,/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB|sendBeacon/);
 assert.match(child,/event\.source!==window\.parent/);
 assert.match(child,/event\.origin!==PARENT_ORIGIN/);
 assert.match(child,/window\.origin!=='null'/);
 assert.match(html,/APP_BUILD = '2026\.11\.20\.06'/);
 assert.match(sw,/RR_BUILD = '2026\.11\.20\.06'/);
});
