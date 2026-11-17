'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {runComposedP2Simulation}=require('./rings-now-p2-composed-simulation-runner.cjs');
const run=opts=>runComposedP2Simulation(opts);
test('integrates #188 #198 #199 #200 with fixed in-memory CLI and zero fake leftovers',async()=>{
 const r=await run();
 assert.equal(r.status,'COMPOSED_SYNTHETIC_COMPONENTS_CONSISTENT_NOT_REAL_P2');
 assert.deepEqual(r.connections,['188_stage_budget','198_watchdog_inventory',
  '199_lifecycle_cleanup','200_cli_adapter','200_bounded_cli']);
 assert.equal(r.remainingFakeResources,0);
 assert.equal(r.stage188Status,'PASS');
 assert.equal(r.stage198Status,'SYNTHETIC_PIPELINE_CONSISTENT_NOT_REAL_PROOF');
 assert.equal(r.lifecycleStatus,'SYNTHETIC_LIFECYCLE_CONSISTENT_NOT_REAL_PROOF');
 assert.ok(r.events.some(x=>x.argv[0]==='network'&&x.argv[1]==='create'));
 assert.equal(r.events.filter(x=>x.argv[0]==='container'&&x.argv[1]==='create').length,3);
 assert.ok(r.events.some(x=>x.argv[0]==='network'&&x.argv[1]==='rm'));
 for(const key of ['g1Verified','g2Verified','g3Verified','g4Verified',
  'actualResourcesVerified','resourceTerminationProven',
  'actualP2Proven','p2ExecutionAuthorized','realDockerInvoked','realAuthJwtTested'])
  assert.equal(r[key],false);
});
test('partial container create after daemon success still attempts cleanup',async()=>{
 const r=await run({faults:{partialCreateOn:'gotrue'}});
 assert.equal(r.status,'FAIL');
 assert.equal(r.remainingFakeResources,0);
 assert.ok(r.events.some(x=>x.argv[0]==='container'&&x.argv[1]==='rm'&&
  x.argv.at(-1).endsWith('_gotrue')));
});
test('failed start does not hide cleanup of all owned resources',async()=>{
 const r=await run({faults:{startFailureOn:'postgrest'}});
 assert.equal(r.status,'FAIL');
 assert.equal(r.remainingFakeResources,0);
 assert.ok(r.events.some(x=>x.argv[0]==='network'&&x.argv[1]==='rm'));
});
test('simulated daemon resource leak makes composed runner FAIL',async()=>{
 const r=await run({faults:{leakContainer:true}});
 assert.equal(r.status,'FAIL');
 assert.ok(r.remainingFakeResources>0);
 assert.equal(r.p2ExecutionAuthorized,false);
});
test('CLI simulated timeout cannot be reported as successful runtime',async()=>{
 const r=await run({faults:{timeoutOn:'container:create'}});
 assert.equal(r.status,'FAIL');
 assert.equal(r.remainingFakeResources,0);
});
test('forged owner label prevents destructive cleanup and blocks result',async()=>{
 const r=await run({faults:{spoofOwner:true}});
 assert.equal(r.status,'FAIL');
 assert.equal(r.p2ExecutionAuthorized,false);
});
test('synthetic watchdog failure cannot be overwritten by clean fake Docker',async()=>{
 const r=await run({stageModes:{execute:'hang',cleanup:'success',verify:'success'}});
 assert.equal(r.status,'FAIL');
 assert.equal(r.remainingFakeResources,0);
 assert.equal(r.g3Verified,false);
});
test('invalid stage mode fails before any P2 work',async()=>{
 await assert.rejects(()=>run({stageModes:{execute:'docker',cleanup:'success',verify:'success'}}));
});
test('untrusted synthetic inventory blocks integrated verdict despite clean CLI',async()=>{
 const x=await run();
 assert.equal(x.status,'COMPOSED_SYNTHETIC_COMPONENTS_CONSISTENT_NOT_REAL_P2');
 const r=await run({inventoryOverride:{kind:'REAL_DOCKER'}});
 assert.equal(r.status,'BLOCKED');
});
test('fake execFile backend is never a real execution authorization path',async()=>{
 const r=await run();
 assert.equal(r.realDockerInvoked,false);
 assert.equal(r.resourceTerminationProven,false);
 assert.equal(r.actualP2Proven,false);
});
