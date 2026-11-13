import assert from 'node:assert/strict';
import {makeFakeAtomicProbeStore,modelOptionalProbe} from '../src/garmin-one-shot-probe-contract.mjs';
const cfg={enabledAt:1000,expiresAt:2000,connectionVersion:'version-A',ownerId:'owner-A'};
const fresh=()=>makeFakeAtomicProbeStore(cfg);
const counts={ok:true,activityCount:1,sampleCount:30,token:'DO-NOT-COPY'};
{
  const store=fresh();
  assert.equal(store.claim({owner:'owner-A',version:'version-A',now:999}),false);
  assert.equal(store.claim({owner:'owner-A',version:'version-A',now:1000}),true);
  assert.equal(store.claim({owner:'owner-A',version:'version-A',now:1001}),false);
  assert.equal(store.finish({owner:'owner-A',version:'version-A',now:1999,counts}),true);
  assert.equal(store.claim({owner:'owner-A',version:'version-A',now:1999}),false);
  assert.equal(store.snapshot().claims,1);
  assert.ok(!JSON.stringify(store.snapshot()).includes('DO-NOT-COPY'));
}
{
  const store=fresh();
  assert.equal(store.claim({owner:'owner-B',version:'version-A',now:1200}),false);
  assert.equal(store.claim({owner:'owner-A',version:'version-B',now:1200}),false);
  assert.equal(store.claim({owner:'owner-A',version:'version-A',now:2000}),false);
  assert.equal(store.claim({owner:'owner-A',version:'version-A',now:2001}),false);
}
{
  const store=fresh();
  assert.equal(store.claim({owner:'owner-A',version:'version-A',now:1500}),true);
  assert.equal(store.finish({owner:'owner-A',version:'version-A',now:2000,counts}),false);
  assert.equal(store.snapshot().result,null);
}
{
  const store=fresh();
  assert.equal(store.claim({owner:'owner-A',version:'version-A',now:1100}),true);
  store.revoke();
  assert.equal(store.finish({owner:'owner-A',version:'version-A',now:1101,counts}),false);
  assert.equal(store.snapshot().state,'revoked');
  assert.equal(store.snapshot().result,null);
}
{
  const store=fresh();
  const calls=Array.from({length:100},(_,i)=>Promise.resolve().then(()=>store.claim({
    owner:'owner-A',version:'version-A',now:1100+i
  })));
  const got=await Promise.all(calls);
  assert.equal(got.filter(Boolean).length,1);
  assert.equal(store.snapshot().claims,1);
}
{
  for(const status of [200,503]) {
    for(const probe of [async()=>{throw Error('probe_failed')},async()=>false,async()=>true]) {
      let n=0;
      const result=await modelOptionalProbe({existingImport:async()=>{n++;return status;},probe});
      assert.equal(result,status);
      assert.equal(n,1);
    }
  }
  await assert.rejects(modelOptionalProbe({
    existingImport:async()=>{throw Error('existing_import_failure')},
    probe:async()=>{throw Error('probe_failure')}
  }),/existing_import_failure/);
}
assert.throws(()=>makeFakeAtomicProbeStore({...cfg,expiresAt:1000}),/invalid_probe_configuration/);
console.log('Synthetic one-shot contract tests PASS (not distributed DB concurrency proof).');
