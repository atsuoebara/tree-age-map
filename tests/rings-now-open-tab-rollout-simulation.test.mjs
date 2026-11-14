import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createOpenTabRolloutSimulation} from '../src/rings-now-open-tab-rollout-simulation.mjs';

test('initial unknown signal always blocks, no permission even with observed matching build',()=>{
 const s=createOpenTabRolloutSimulation({initialBuild:'v1'});
 const tab=s.open();
 assert.equal(s.inspect(tab).simulatedStatus,'blocked');
 assert.ok(s.inspect(tab).failures.includes('fresh_signal_unverified'));
 assert.equal(s.observe(tab).simulatedStatus,'requires_manual_review');
 assert.equal(s.inspect(tab).realFitAllowed,false);
 assert.equal(s.inspect(tab).verifiedSafe,false);
});
test('old open tab detects code deployment only after explicitly observing fresh signal',()=>{
 const s=createOpenTabRolloutSimulation({initialBuild:'v1'}),old=s.open();
 s.observe(old);
 s.publish('v2');
 const before=s.miss(old);
 assert.equal(before.knownBuild,'v1'); // old JS has no knowledge of remote update
 assert.equal(before.simulatedStatus,'requires_manual_review');
 assert.equal(before.verifiedSafe,false);
 const after=s.observe(old);
 assert.equal(after.knownBuild,'v2');
 assert.equal(after.simulatedStatus,'blocked');
 assert.ok(after.failures.includes('build_mismatch'));
 const fresh=s.open();assert.equal(s.observe(fresh).simulatedStatus,'requires_manual_review');
});
test('withdrawal cannot reach disconnected tab; delivered signal blocks immediately',()=>{
 const s=createOpenTabRolloutSimulation(),t=s.open();
 s.observe(t);
 s.withdraw();
 const disconnected=s.miss(t);
 assert.equal(disconnected.knowsWithdrawn,false);
 assert.equal(disconnected.globallyWithdrawn,true);
 assert.equal(disconnected.simulatedStatus,'requires_manual_review');
 assert.equal(disconnected.oldTabGuaranteedStopped,false);
 const connected=s.observe(t);
 assert.equal(connected.knowsWithdrawn,true);
 assert.equal(connected.simulatedStatus,'blocked');
 assert.ok(connected.failures.includes('rollback_declared'));
});
test('bfcache, hidden tab, and explicit invalidation cannot be revived',()=>{
 for(const behavior of ['pagehide','hide','invalidate']){
  const s=createOpenTabRolloutSimulation(),t=s.open();
  s.observe(t);
  s[behavior](t);
  s.show(t);
  s.pageshow(t,{persisted:true});
  s.observe(t);
  assert.equal(s.inspect(t).simulatedStatus,'blocked',behavior);
  assert.equal(s.inspect(t).revoked,true,behavior);
 }
});
test('two tabs can know different deployment states and must not imply propagation',()=>{
 const s=createOpenTabRolloutSimulation(),a=s.open(),b=s.open();
 s.observe(a);s.observe(b);s.publish('v2');
 assert.equal(s.observe(a).simulatedStatus,'blocked');
 assert.equal(s.miss(b).simulatedStatus,'requires_manual_review');
 assert.equal(s.stats().openTabs,2);
 assert.equal(s.stats().missed,1);
 assert.equal(s.inspect(b).oldTabGuaranteedStopped,false);
});
test('test scope cannot change actual production flags or real FIT delivery',()=>{
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 const source=readFileSync(new URL('../src/rings-now-open-tab-rollout-simulation.mjs',import.meta.url),'utf8');
 assert.match(index,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
 assert.doesNotMatch(index,/rings-now-open-tab-rollout-simulation/);
 assert.doesNotMatch(sw,/rings-now-open-tab-rollout-simulation/);
 for(const forbidden of [/\bfetch\s*\(/,/\bXMLHttpRequest\b/,/\blocalStorage\b/,/\bindexedDB\b/,/\bFileReader\b/,/\bpostMessage\s*\(/])assert.doesNotMatch(source,forbidden);
});
