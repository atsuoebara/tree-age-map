import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {replaySyntheticTabScenario as replay} from '../src/rings-now-old-tab-rollout-replay.mjs';

const tab=(r,at,id)=>r.trace[at].tabs.find(x=>x.tabId===id);

test('old open tab does NOT learn about a newly published build by itself',()=>{
 const r=replay({events:[{type:'open',tabId:'old'},{type:'publish',build:'v2'}]});
 assert.equal(tab(r,1,'old').loadedBuild,'v1');
 assert.equal(tab(r,1,'old').observationGap,true);
 assert.equal(tab(r,1,'old').remotelyRevokedGuaranteed,false);
 assert.equal(tab(r,1,'old').localDecision,'blocked');
});
test('unseen rollback of a previously verified old tab cannot be declared stopped',()=>{
 const r=replay({events:[
  {type:'open',tabId:'old'},
  {type:'receiveVerifiedSignal',tabId:'old',fresh:true},
  {type:'withdraw'}
 ]});
 assert.equal(tab(r,1,'old').localDecision,'requires_manual_review');
 assert.equal(tab(r,2,'old').observationGap,true);
 // Cached old tab has not seen rollback; the simulation makes this explicit.
 assert.equal(tab(r,2,'old').hasSeenWithdrawal,false);
 assert.equal(tab(r,2,'old').remotelyRevokedGuaranteed,false);
 assert.equal(tab(r,2,'old').mayReadRealFit,false);
});
test('explicit newly received rollback signal blocks a tab, without remote kill guarantee',()=>{
 const r=replay({events:[
  {type:'open',tabId:'old'},
  {type:'receiveVerifiedSignal',tabId:'old',fresh:true},
  {type:'withdraw'},
  {type:'receiveVerifiedSignal',tabId:'old',fresh:true}
 ]});
 const x=tab(r,3,'old');
 assert.equal(x.hasSeenWithdrawal,true);
 assert.equal(x.localDecision,'blocked');
 assert.equal(x.observationGap,false);
 assert.equal(x.remotelyRevokedGuaranteed,false);
});
test('new tab may learn newer build, while prior tab remains stale independently',()=>{
 const r=replay({events:[
  {type:'open',tabId:'old'},
  {type:'receiveVerifiedSignal',tabId:'old',fresh:true},
  {type:'publish',build:'v2'},
  {type:'open',tabId:'new'},
  {type:'receiveVerifiedSignal',tabId:'new',fresh:true}
 ]});
 const x=r.trace.at(-1);
 assert.equal(x.tabs.find(t=>t.tabId==='old').observationGap,true);
 assert.equal(x.tabs.find(t=>t.tabId==='new').loadedBuild,'v2');
 assert.equal(x.tabs.find(t=>t.tabId==='new').localDecision,'requires_manual_review');
 assert.equal(x.tabs.every(t=>t.mayReadRealFit===false),true);
});
test('pagehide and resume never restore a revoked synthetic session',()=>{
 for(const event of ['hide','pagehide']){
  const r=replay({events:[{type:'open',tabId:'a'},
   {type:'receiveVerifiedSignal',tabId:'a',fresh:true},
   {type:event,tabId:'a'},{type:'resume',tabId:'a'}]});
  assert.equal(tab(r,3,'a').localDecision,'blocked');
 }
});
test('invalid events and fake fresh=false fail closed',()=>{
 assert.throws(()=>replay({events:[{type:'receiveVerifiedSignal',tabId:'missing',fresh:true}]}),TypeError);
 assert.throws(()=>replay({events:[{type:'publish'}]}),TypeError);
 assert.throws(()=>replay({events:[{type:'open',tabId:'x'},{type:'open',tabId:'x'}]}),TypeError);
 const r=replay({events:[{type:'open',tabId:'a'},{type:'receiveVerifiedSignal',tabId:'a',fresh:false}]});
 assert.equal(tab(r,1,'a').localDecision,'blocked');
});
test('no network, persistence or FIT inputs in simulator; production remains disabled',()=>{
 const source=readFileSync(new URL('../src/rings-now-old-tab-rollout-replay.mjs',import.meta.url),'utf8');
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 for(const regex of [/\bfetch\s*\(/,/XMLHttpRequest/,/WebSocket/,/sendBeacon\s*\(/,/localStorage/,/indexedDB/,/\.arrayBuffer\s*\(/,/FileReader/,/postMessage\s*\(/])
  assert.doesNotMatch(source,regex);
 assert.match(index,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
 assert.doesNotMatch(index,/rings-now-old-tab-rollout-replay\.mjs/);
});
