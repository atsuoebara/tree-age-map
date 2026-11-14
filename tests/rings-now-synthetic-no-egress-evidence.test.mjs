import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inspectRingsNowPrivateFit} from '../src/rings-now-private-fit-input-gate.mjs';
import {createSyntheticOnlyInspector,SYNTHETIC_NAME} from '../src/rings-now-iphone-synthetic-inspector.mjs';
import {inspectSourceGraph} from '../scripts/rings-now-local-delivery-preflight.mjs';

const root=new URL('..',import.meta.url).pathname;
const html=readFileSync(new URL('../previews/rings-now-iphone-synthetic-handoff-20261114.html',import.meta.url),'utf8');
const b64=html.match(/const SYNTHETIC_B64='([^']+)'/);
assert.ok(b64,'synthetic fixture required');
const bytes=Buffer.from(b64[1],'base64');
const fixtureFile=()=>({name:SYNTHETIC_NAME,size:bytes.byteLength,arrayBuffer:async()=>Uint8Array.from(bytes).buffer});
const sha=async(_algorithm,b)=>{
 const d=createHash('sha256').update(new Uint8Array(b)).digest();
 return d.buffer.slice(d.byteOffset,d.byteOffset+d.byteLength);
};
const keys=['fetch','XMLHttpRequest','WebSocket','EventSource','Worker','SharedWorker','localStorage','sessionStorage','indexedDB','caches','navigator'];
function trapGlobals(){
 const previous=new Map(),attempts=[];
 for(const key of keys){
  const own=Object.getOwnPropertyDescriptor(globalThis,key);
  previous.set(key,own);
  if(own && own.configurable===false)continue;
  const failure=()=>{attempts.push(key);throw Error('egress/storage forbidden: '+key)};
  Object.defineProperty(globalThis,key,{configurable:true,get:failure,set:failure});
 }
 return {attempts,restore(){
  for(const [key,descriptor] of previous){
   if(descriptor)Object.defineProperty(globalThis,key,descriptor);
   else delete globalThis[key];
  }
 }};
}
const safeOptions={confirmedOwner:true,confirmedGachi:true,isSelectionCurrent:()=>true};

test('approved synthetic binary follows isolated fit parser without calling instrumented global egress or storage',async()=>{
 const trap=trapGlobals();
 try{
  const inspector=createSyntheticOnlyInspector({digest:sha});
  const result=await inspector({...safeOptions,file:fixtureFile()});
  assert.equal(result.status,'reference_only_unverified');
  assert.equal(result.qualityCertified,false);
  assert.equal(result.analysisAllowed,false);
  assert.equal(result.writeAllowed,false);
  assert.equal(result.providerDataCombined,false);
  assert.equal(result.segments.length,5);
  assert.deepEqual(trap.attempts,[]);
  for(const field of ['raw','buffer','gps','heartRate','userId','athleteId','timestamp','deviceId','lat','lon'])
   assert.equal(Object.hasOwn(result,field),false,field);
 }finally{trap.restore()}
});

test('pre-inspector validation blocks modified/same-name synthetic before invoking parser',async()=>{
 const changed=Uint8Array.from(bytes);changed[100]^=1;
 let decodes=0;
 const inspector=createSyntheticOnlyInspector({digest:sha,inspect:async()=>{decodes++;return {status:'reference_only_unverified'}}});
 const result=await inspector({...safeOptions,file:{name:SYNTHETIC_NAME,size:changed.length,arrayBuffer:async()=>changed.buffer}});
 assert.equal(result.status,'blocked');
 assert.equal(result.reason,'hash_mismatch_no_decode');
 assert.equal(decodes,0);
});

test('private input gate is review-only and sanitizes all raw candidate metadata',async()=>{
 const expected={status:'candidate_unverified',qualityCertified:false,analysisAllowed:false,writeAllowed:false,providerDataCombined:false,
  segments:[{index:1,distanceM:1000,clockElapsedS:300,partial:false,gps:'DO_NOT_LEAK',heartRate:200,raw:'SECRET'}],
  flags:['synthetic'],garminToken:'SECRET',athleteId:'SECRET',gps:'DO_NOT_LEAK'};
 const result=await inspectRingsNowPrivateFit({...safeOptions,file:fixtureFile(),review:()=>expected});
 assert.equal(result.status,'reference_only_unverified');
 assert.deepEqual(result.segments,[{index:1,distanceM:1000,clockElapsedS:300,partial:false}]);
 assert.deepEqual(result.flags,['synthetic']);
 assert.doesNotMatch(JSON.stringify(result),/SECRET|DO_NOT_LEAK/);
 assert.equal(result.writeAllowed,false);
});

test('cancel after asynchronous synthetic read prevents decoder and output',async()=>{
 let release,live=true,parses=0;
 const wait=new Promise(resolve=>{release=resolve});
 const f={name:SYNTHETIC_NAME,size:bytes.byteLength,arrayBuffer:async()=>{await wait;return Uint8Array.from(bytes).buffer}};
 const inspect=async()=>{parses++;throw Error('should not decode')};
 const running=createSyntheticOnlyInspector({digest:sha,inspect})({...safeOptions,isSelectionCurrent:()=>live,file:f});
 live=false;release();
 const result=await running;
 assert.equal(result.status,'blocked');assert.equal(parses,0);
});

test('existing HTML source import graph needs manual review and unchanged production is OFF',()=>{
 const graph=inspectSourceGraph({rootDir:root,entryPath:'previews/rings-now-iphone-synthetic-handoff-20261114.html'});
 assert.equal(graph.status,'requires_manual_review');
 assert.ok(graph.inspected.length>=9);
 assert.ok(graph.inspected.includes('src/rings-now-private-fit-input-gate.mjs'));
 const home=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(home,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(home,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
 assert.doesNotMatch(home,/rings-now-synthetic-no-egress/);
});
