import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeSyntheticRaceFit} from '../scripts/make-synthetic-race-fit.mjs';
import {inspectRingsNowPrivateFit as inspect} from '../src/rings-now-private-fit-input-gate.mjs';

const bytes=makeSyntheticRaceFit();
const makeFile=(override={})=>({
 name:'synthetic-running.fit',size:bytes.byteLength,
 arrayBuffer:async()=>bytes.slice(0),...override
});
const yes={confirmedOwner:true,confirmedGachi:true,isSelectionCurrent:()=>true};
test('never decode without both explicit confirmations and a live selection guard',async()=>{
 let reads=0;
 const file=makeFile({arrayBuffer:async()=>{reads++;return bytes.slice(0)}});
 for(const args of [{...yes,confirmedOwner:false},{...yes,confirmedGachi:false},
                    {...yes,isSelectionCurrent:undefined}]){
  const result=await inspect({file,...args});
  assert.equal(result.status,'blocked');
  assert.equal(result.analysisAllowed,false);
 }
 assert.equal(reads,0);
});
test('reject ZIP, huge FIT and byte-length mismatch before parsing',async()=>{
 for(const file of [makeFile({name:'race.zip'}),makeFile({name:'race.fit',size:16*1024*1024+1}),
                    makeFile({size:bytes.byteLength+1})]){
  const result=await inspect({file,...yes});
  assert.equal(result.status,'blocked');
  assert.equal(result.writeAllowed,false);
 }
});
test('cancel immediately if file selection changes during asynchronous iPhone read',async()=>{
 let resolve;
 const pending=new Promise(r=>{resolve=r});
 let selected=true,decoded=0;
 const promise=inspect({file:makeFile({arrayBuffer:()=>pending}),...yes,
  isSelectionCurrent:()=>selected,review:()=>{decoded++;return null}});
 selected=false;resolve(bytes.slice(0));
 const result=await promise;
 assert.equal(result.reason,'selection_changed');
 assert.equal(decoded,0);
});
test('synthetic FIT passes the same isolated SDK, but only as a private unverified reference',async()=>{
 const result=await inspect({file:makeFile(),...yes});
 assert.equal(result.status,'reference_only_unverified',JSON.stringify(result));
 assert.deepEqual(result.segments.map(s=>Math.round(s.clockElapsedS)),[315,318,320,324,343]);
 assert.equal(result.analysisAllowed,false);
 assert.equal(result.writeAllowed,false);
 assert.equal(result.qualityCertified,false);
 assert.equal(result.providerDataCombined,false);
 for(const key of ['rawFit','recordMesgs','messages','startedAt','runId','userId','gps','heartRate','timestamp'])
  assert.ok(!(key in result),'must not expose '+key);
});
test('reject any parser result claiming certified, authorized, writable or combined',async()=>{
 for(const changes of [{qualityCertified:true},{analysisAllowed:true},
  {writeAllowed:true},{providerDataCombined:true}]){
  const fake=()=>({status:'candidate_unverified',qualityCertified:false,
    analysisAllowed:false,writeAllowed:false,providerDataCombined:false,segments:[],...changes});
  const result=await inspect({file:makeFile(),...yes,review:fake});
  assert.equal(result.status,'blocked');
 }
});
test('the new gate is unconnected to production or public test pages and has no IO APIs',()=>{
 const gate=readFileSync(new URL('../src/rings-now-private-fit-input-gate.mjs',import.meta.url),'utf8');
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const synthetic=readFileSync(new URL('../previews/rings-now-iphone-synthetic-only-20261114.html',import.meta.url),'utf8');
 const existing=readFileSync(new URL('../previews/ima-wo-shirou-fit-local-file-draft-20261113.html',import.meta.url),'utf8');
 for(const page of [index,synthetic,existing])assert.ok(!page.includes('rings-now-private-fit-input-gate.mjs'));
 for(const expression of [/\bfetch\s*\(/,/XMLHttpRequest/,/WebSocket/,/localStorage/,/sessionStorage/,/indexedDB/,
                         /sendBeacon/,/\.from\(['"]runs['"]\)/,/navigator\.share\s*\(/])
  assert.doesNotMatch(gate,expression);
 assert.match(index,/const RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/const RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
});
