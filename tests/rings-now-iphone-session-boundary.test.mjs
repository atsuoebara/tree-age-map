import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRingsNowIphoneSessionBoundary as boundary} from '../src/rings-now-iphone-session-boundary.mjs';

const start=Date.parse('2026-11-14T01:00:00.000Z');
class Events {
 constructor(){this.listeners=new Map();this.hidden=false}
 addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn)}
 removeEventListener(name,fn){this.listeners.get(name)?.delete(fn)}
 dispatch(name,data){for(const f of this.listeners.get(name)||[])f(data)}
 size(){return Array.from(this.listeners.values()).reduce((n,s)=>n+s.size,0)}
}
function setup(overrides={}){
 let time=start+120000;
 const pageEvents=new Events(),visibilityEvents=new Events();
 let state={
  currentUserId:'person-A',
  row:{id:123,user_id:'person-A',started_at:'2026-11-14T01:00:00.000Z',activity_date:'2026-11-14',deleted_at:null},
  selectedAsGachiRun:true,selectionDate:'2026-11-14',selectionToken:'explicit-tap-1',
  ...overrides
 };
 const api=boundary({readContext:()=>state,nowMs:()=>time,featureStartedAtMs:start-1000,pageEvents,visibilityEvents});
 return {api,pageEvents,visibilityEvents,setState:change=>state={...state,...change},getState:()=>state,setTime:n=>time=n};
}
test('explicit same-row same-user selection and valid 8d window are provisional only',()=>{
 const {api}=setup();
 assert.equal(api.isContextCurrent(),true);
 assert.equal('runId' in api,false);
 assert.equal('analysisAllowed' in api,false);
 api.destroy();
 assert.equal(api.isContextCurrent(),false);
});
test('must fail when production rollout time remains null',()=>{
 const e=new Events(),v=new Events();
 const row={id:123,user_id:'person-A',started_at:'2026-11-14T01:00:00.000Z',activity_date:'2026-11-14'};
 const api=boundary({readContext:()=>({currentUserId:'person-A',row,selectionToken:'x',selectionDate:'2026-11-14',selectedAsGachiRun:true}),nowMs:()=>start+5000,pageEvents:e,visibilityEvents:v});
 assert.equal(api.isContextCurrent(),false);
 api.destroy();
});
test('8d boundary inclusive, +1ms expired; no late imported activity extension',()=>{
 const f=setup();
 f.setTime(start+691200000);
 assert.equal(f.api.isContextCurrent(),true);
 f.setTime(start+691200001);
 assert.equal(f.api.isContextCurrent(),false);
 f.api.destroy();
});
test('cannot associate FIT by date/distance; owner, row id, start, date, token all fail closed',()=>{
 for(const change of [
  {currentUserId:'person-B'},
  {row:{id:123,user_id:'person-B',started_at:'2026-11-14T01:00:00.000Z',activity_date:'2026-11-14'}},
  {row:{id:124,user_id:'person-A',started_at:'2026-11-14T01:00:00.000Z',activity_date:'2026-11-14'}},
  {row:{id:123,user_id:'person-A',started_at:'2026-11-14T01:00:01.000Z',activity_date:'2026-11-14'}},
  {row:{id:123,user_id:'person-A',started_at:'2026-11-14T01:00:00.000Z',activity_date:'2026-11-15'}},
  {selectionDate:'2026-11-15'},
  {selectionToken:'other-tap'},
  {selectedAsGachiRun:false},
  {row:{id:123,user_id:'person-A',started_at:'2026-11-14T01:00:00.000Z',activity_date:'2026-11-14',deleted_at:'2026-11-14T02:00:00Z'}}
 ]){
  const f=setup();f.setState(change);
  assert.equal(f.api.isContextCurrent(),false,JSON.stringify(change));
  f.api.destroy();
 }
});
test('iPhone tab background, navigation and bfcache restore invalidate permanently',()=>{
 for(const event of ['pagehide','pageshow','visibilitychange']){
  const f=setup();
  assert.equal(f.api.isContextCurrent(),true);
  if(event==='visibilitychange'){f.visibilityEvents.hidden=true;f.visibilityEvents.dispatch(event)}
  else f.pageEvents.dispatch(event,{persisted:true});
  if(event==='visibilitychange')f.visibilityEvents.hidden=false;
  assert.equal(f.api.isContextCurrent(),false,event);
  f.api.destroy();
 }
});
test('non-persisted pageshow does not prematurely revoke current session',()=>{
 const f=setup();
 f.pageEvents.dispatch('pageshow',{persisted:false});
 assert.equal(f.api.isContextCurrent(),true);
 f.api.invalidate();
 assert.equal(f.api.isContextCurrent(),false);
 f.api.destroy();
 assert.equal(f.pageEvents.size(),0);
 assert.equal(f.visibilityEvents.size(),0);
});
test('missing, invalid or throwing dependencies fail closed',()=>{
 const e=new Events(),v=new Events();
 assert.throws(()=>boundary({readContext:null,nowMs:()=>start,pageEvents:e,visibilityEvents:v}),TypeError);
 const b=boundary({readContext:()=>{throw Error('logout')},nowMs:()=>start,pageEvents:e,visibilityEvents:v,featureStartedAtMs:start});
 assert.equal(b.isContextCurrent(),false);
 b.destroy();
});
test('must not create public FIT page, API access or change production OFF',()=>{
 const src=readFileSync(new URL('../src/rings-now-iphone-session-boundary.mjs',import.meta.url),'utf8');
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const synthetic=readFileSync(new URL('../previews/rings-now-iphone-synthetic-only-20261114.html',import.meta.url),'utf8');
 const tombstone=readFileSync(new URL('../previews/ima-wo-shirou-fit-local-file-draft-20261113.html',import.meta.url),'utf8');
 assert.match(index,/const RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/const RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
 for(const page of [index,synthetic,tombstone])assert.ok(!page.includes('rings-now-iphone-session-boundary.mjs'));
 for(const pattern of [/\bfetch\s*\(/,/XMLHttpRequest/,/WebSocket/,/localStorage/,/sessionStorage/,/indexedDB/,/postMessage/,/innerHTML/,/navigator\.share/,/FileReader/,/file\.arrayBuffer\(/])
   assert.doesNotMatch(src,pattern);
});
