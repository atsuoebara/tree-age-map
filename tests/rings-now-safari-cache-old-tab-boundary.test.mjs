import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRingsNowIphoneSessionBoundary} from '../src/rings-now-iphone-session-boundary.mjs';
const swSource=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const demo=readFileSync(new URL('../previews/rings-now-iphone-synthetic-handoff-20261114.html',import.meta.url),'utf8');
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const origin='https://runnersrings.com';
function worker(){
 const handlers=new Map(),cacheCalls=[],networkCalls=[];
 const cache={match:async()=>null,addAll:async values=>cacheCalls.push(['addAll',...values])};
 const caches={open:async key=>{cacheCalls.push(['open',key]);return cache},keys:async()=>[],delete:async key=>{cacheCalls.push(['delete',key]);return true}};
 const self={location:{origin},addEventListener:(type,fn)=>handlers.set(type,fn)};
 const fetch=async request=>{networkCalls.push(request);return {status:200}};
 class Request{constructor(request,options){Object.assign(this,request,{cache:options?.cache})}}
 const context=vm.createContext({self,caches,fetch,Request,URL,Response:class{constructor(body,options){this.status=options.status}},Promise,console});
 vm.runInContext(swSource,context,{filename:'sw.js'});
 const send=async(path,{mode='navigate',method='GET',search='',crossOrigin=false}={})=>{
  let responsePromise;
  const request={url:(crossOrigin?'https://elsewhere.example':origin)+path+search,method,mode};
  handlers.get('fetch')({request,respondWith:value=>{responsePromise=Promise.resolve(value)}});
  if(responsePromise)await responsePromise;
  return {handled:!!responsePromise,request};
 };
 return {send,cacheCalls,networkCalls};
}
class Emitter{
 constructor(){this.handlers=new Map();this.hidden=false}
 addEventListener(t,fn){if(!this.handlers.has(t))this.handlers.set(t,new Set());this.handlers.get(t).add(fn)}
 removeEventListener(t,fn){this.handlers.get(t)?.delete(fn)}
 dispatch(t,payload){for(const fn of this.handlers.get(t)||[])fn(payload)}
}
const start=Date.parse('2026-11-14T01:00:00Z');
function tab(){
 const pageEvents=new Emitter(),visibilityEvents=new Emitter();
 const context={currentUserId:'fake',row:{id:1,user_id:'fake',started_at:'2026-11-14T01:00:00Z',activity_date:'2026-11-14',deleted_at:null},selectedAsGachiRun:true,selectionDate:'2026-11-14',selectionToken:'tap'};
 const api=createRingsNowIphoneSessionBoundary({readContext:()=>context,nowMs:()=>start+1000,featureStartedAtMs:start-1000,pageEvents,visibilityEvents});
 return {api,pageEvents,visibilityEvents};
}
test('SW bypasses synthetic HTML, JS dependencies, FIT URL, and arbitrary upload/data paths',async()=>{
 const sw=worker();
 for(const path of ['/previews/rings-now-iphone-synthetic-handoff-20261114.html','/src/rings-now-iphone-isolated-handoff.mjs','/src/rings-now-iphone-synthetic-inspector.mjs','/private.fit','/api/activities','/journal.html']){
  assert.equal((await sw.send(path)).handled,false,path);
 }
 assert.equal((await sw.send('/api/upload',{method:'POST'})).handled,false);
 assert.equal((await sw.send('/previews/rings-now-iphone-synthetic-handoff-20261114.html',{crossOrigin:true})).handled,false);
 assert.deepEqual(sw.cacheCalls,[]);
 assert.deepEqual(sw.networkCalls,[]);
});
test('SW only intercepts public icon assets or network-first homepage, never caches FIT or scripts',async()=>{
 const sw=worker();
 assert.equal((await sw.send('/assets/pwa/icon-192.png',{mode:'no-cors'})).handled,true);
 assert.equal((await sw.send('/index.html')).handled,true);
 assert.equal(sw.networkCalls.length,2);
 assert.equal(sw.networkCalls[1].cache,'no-store');
 assert.equal((await sw.send('/index.html',{search:'?lang=en'})).handled,false);
 assert.equal((await sw.send('/previews/rings-now-iphone-synthetic-handoff-20261114.html?x=1')).handled,false);
 assert.ok(sw.cacheCalls.every(item=>item[0]==='open'&&item[1].startsWith('rr-static-')));
});
test('two independent old tabs cannot be silently revived through bfcache after suspension',()=>{
 const old=tab(),newer=tab();
 try{
  assert.equal(old.api.isContextCurrent(),true);
  assert.equal(newer.api.isContextCurrent(),true);
  old.pageEvents.dispatch('pagehide');
  old.pageEvents.dispatch('pageshow',{persisted:true});
  assert.equal(old.api.isContextCurrent(),false);
  assert.equal(newer.api.isContextCurrent(),true);
  newer.visibilityEvents.hidden=true;
  newer.visibilityEvents.dispatch('visibilitychange');
  newer.visibilityEvents.hidden=false;
  assert.equal(newer.api.isContextCurrent(),false);
 }finally{old.api.destroy();newer.api.destroy()}
});
test('synthetic page has no real FIT admission and a manual invalidation route',()=>{
 assert.match(demo,/createSyntheticOnlyInspector/);
 assert.match(demo,/SYNTHETIC_SHA256/);
 assert.match(demo,/handoff\.invalidate\(\)/);
 assert.match(demo,/connect-src 'none'/);
 assert.match(demo,/form-action 'none'/);
 assert.match(index,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
});
test('service worker has no automatic takeover and does not store runtime requests',()=>{
 assert.doesNotMatch(swSource,/skipWaiting\s*\(/);
 assert.doesNotMatch(swSource,/clients\.claim\s*\(/);
 assert.doesNotMatch(swSource,/cache\.put\s*\(/);
 assert.doesNotMatch(swSource,/cache\.add\s*\(/);
 // This tests SW script and simulated dispatch only, NOT Safari HTTP cache/CDN.
});
