import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeSyntheticRaceFit} from '../scripts/make-synthetic-race-fit.mjs';
import {createRingsNowIphoneIsolatedHandoff as create} from '../src/rings-now-iphone-isolated-handoff.mjs';
class Events {
 constructor(){this.handlers=new Map();this.hidden=false}
 addEventListener(type,fn){if(!this.handlers.has(type))this.handlers.set(type,new Set());this.handlers.get(type).add(fn)}
 removeEventListener(type,fn){this.handlers.get(type)?.delete(fn)}
 dispatch(type,payload){return [...(this.handlers.get(type)||[])].map(fn=>fn(payload))}
 count(){return [...this.handlers.values()].reduce((n,v)=>n+v.size,0)}
}
class Element extends Events{
 constructor(){super();this.value='';this.disabled=false;this.checked=false;this.files=[];this.children=[];this.textContent=''}
 replaceChildren(...x){this.children=x}
 append(...x){this.children.push(...x)}
}
const start=Date.parse('2026-11-14T01:00:00Z');
const binary=makeSyntheticRaceFit();
function fixture({enabled=true,inspect}={}){
 const elements=Object.fromEntries(['fileInput','ownerCheckbox','gachiCheckbox','reviewButton','cancelButton','statusNode','lapsNode'].map(k=>[k,new Element()]));
 const pageEvents=new Events(),visibilityEvents=new Events();
 let context={currentUserId:'test-owner',row:{id:91,user_id:'test-owner',started_at:'2026-11-14T01:00:00Z',activity_date:'2026-11-14'},selectionDate:'2026-11-14',selectionToken:'explicit-user-selection',selectedAsGachiRun:true};
 const document={createElement:()=>new Element()};
 const handoff=create({elements,document,readContext:()=>context,nowMs:()=>start+60000,featureStartedAtMs:enabled?start-1000:null,pageEvents,visibilityEvents,inspect});
 const file=()=>({name:'generated-synthetic.fit',size:binary.byteLength,arrayBuffer:async()=>binary.slice(0)});
 const select=()=>{elements.fileInput.files=[file()];elements.fileInput.dispatch('change');elements.ownerCheckbox.checked=true;elements.ownerCheckbox.dispatch('change');elements.gachiCheckbox.checked=true;elements.gachiCheckbox.dispatch('change')};
 return {elements,pageEvents,visibilityEvents,handoff,select,replaceContext:c=>context=c,context:()=>context};
}
test('isolated UI+session accepts synthetic data only with explicit test-time rollout and 2 confirmations',async()=>{
 const f=fixture(),e=f.elements;
 f.select();await e.reviewButton.dispatch('click')[0];
 assert.match(e.statusNode.textContent,/参考候補・未認証/);
 assert.match(e.statusNode.textContent,/信号待ちやトイレ休憩、自動ポーズ/);
 assert.deepEqual(e.lapsNode.children[0].children.map(r=>r.children[1].textContent),['5:15','5:18','5:20','5:24','5:43']);
 f.handoff.destroy();
 assert.equal(f.pageEvents.count(),0);
 assert.equal(f.visibilityEvents.count(),0);
});
test('production null rollout: no FIT bytes read, no candidate output',async()=>{
 let reads=0;
 const f=fixture({enabled:false});
 const e=f.elements;f.select();
 e.fileInput.files=[{name:'mock.fit',size:binary.byteLength,arrayBuffer:async()=>{reads++;return binary}}];
 await e.reviewButton.dispatch('click')[0];
 assert.equal(reads,0);
 assert.equal(f.handoff.isContextCurrent(),false);
 assert.equal(e.lapsNode.children.length,0);
 f.handoff.destroy();
});
test('pagehide, bfcache and visibility clear visible results and revoke selections',async()=>{
 for(const evt of ['pagehide','pageshow','visibilitychange']){
  const f=fixture(),e=f.elements;f.select();
  await e.reviewButton.dispatch('click')[0];
  assert.equal(e.lapsNode.children.length,1);
  if(evt==='visibilitychange'){f.visibilityEvents.hidden=true;f.visibilityEvents.dispatch(evt);f.visibilityEvents.hidden=false}
  else f.pageEvents.dispatch(evt,{persisted:true});
  assert.equal(e.lapsNode.children.length,0,evt);
  assert.equal(e.fileInput.value,'');
  assert.equal(e.ownerCheckbox.checked,false);
  assert.equal(e.gachiCheckbox.checked,false);
  assert.equal(f.handoff.isContextCurrent(),false);
  f.handoff.destroy();
 }
});
test('race: delayed parse cannot restore results after iPhone background',async()=>{
 let resume,decodeCalls=0;
 const pending=new Promise(resolve=>{resume=resolve});
 const inspect=async({file,confirmedOwner,confirmedGachi,isSelectionCurrent})=>{
  assert.equal(confirmedOwner,true);assert.equal(confirmedGachi,true);
  await file.arrayBuffer();
  if(!isSelectionCurrent())return {status:'blocked'};
  decodeCalls++;
  return {status:'reference_only_unverified',qualityCertified:false,analysisAllowed:false,writeAllowed:false,providerDataCombined:false,segments:[{index:1,clockElapsedS:315}]};
 };
 const f=fixture({inspect}),e=f.elements;
 e.fileInput.files=[{name:'mock.fit',size:binary.byteLength,arrayBuffer:()=>pending}];
 e.fileInput.dispatch('change');
 e.ownerCheckbox.checked=true;e.ownerCheckbox.dispatch('change');
 e.gachiCheckbox.checked=true;e.gachiCheckbox.dispatch('change');
 const work=e.reviewButton.dispatch('click')[0];
 assert.equal(e.reviewButton.disabled,true);
 f.pageEvents.dispatch('pagehide');
 resume(binary.slice(0));await work;
 assert.equal(decodeCalls,0);
 assert.equal(e.lapsNode.children.length,0);
 assert.equal(e.reviewButton.disabled,false);
 f.handoff.destroy();
});
test('explicit logout or calendar change requires caller invalidation and clears results',async()=>{
 for(const change of ['logout','calendar']){
  const f=fixture(),e=f.elements;f.select();await e.reviewButton.dispatch('click')[0];
  f.replaceContext(change==='logout'?null:{...f.context(),selectionToken:'new-choice'});
  f.handoff.invalidate();
  assert.equal(f.handoff.isContextCurrent(),false);
  assert.equal(e.lapsNode.children.length,0);
  f.handoff.destroy();
 }
});
test('misconfigured controller fails closed, drops lifecycle listeners',()=>{
 const e=new Events(),v=new Events();
 assert.throws(()=>create({readContext:()=>({}),nowMs:()=>start,pageEvents:e,visibilityEvents:v,document:{createElement:()=>({})}}));
 assert.equal(e.count(),0);
 assert.equal(v.count(),0);
});
test('source is offline-only and remains unconnected to public pages',()=>{
 const source=readFileSync(new URL('../src/rings-now-iphone-isolated-handoff.mjs',import.meta.url),'utf8');
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const synthetic=readFileSync(new URL('../previews/rings-now-iphone-synthetic-only-20261114.html',import.meta.url),'utf8');
 assert.doesNotMatch(index,/rings-now-iphone-isolated-handoff\.mjs/);
 assert.doesNotMatch(synthetic,/rings-now-iphone-isolated-handoff\.mjs/);
 assert.match(index,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
 for(const x of [/\bfetch\s*\(/,/XMLHttpRequest/,/localStorage/,/sessionStorage/,/indexedDB/,/navigator\.sendBeacon/,/postMessage/,/\bconsole\./,/\bFormData\b/])
  assert.doesNotMatch(source,x);
});
