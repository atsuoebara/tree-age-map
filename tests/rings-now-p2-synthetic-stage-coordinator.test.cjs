'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {runSyntheticP2Integration,normalizeStageRecords}=require('./rings-now-p2-synthetic-stage-coordinator.cjs');

test('real synthetic Node stages integrate 3 audited parts with bounded time',async()=>{
 const r=await runSyntheticP2Integration({totalMs:3000,reserveMs:1500,verifyReserveMs:600});
 assert.equal(r.evidenceKind,'SYNTHETIC_NODE_ONLY');
 assert.equal(r.status,'PASS');
 assert.deepEqual(r.records.map(x=>x.name),['execute','cleanup','verify']);
 assert.ok(r.records.every(x=>x.attempted));
 assert.equal(r.resourceTerminationProven,false);
 assert.equal(r.actualP2Proven,false);
});
test('synthetic execution failure still attempts cleanup and verify',async()=>{
 const r=await runSyntheticP2Integration({modes:{execute:'failure',cleanup:'success',verify:'success'},totalMs:3000,reserveMs:1500,verifyReserveMs:600});
 assert.equal(r.status,'FAIL');
 assert.deepEqual(r.stageOutcomes.map(x=>x.stage),['execute','cleanup','verify']);
});
test('synthetic cleanup failure prevents PASS',async()=>{
 const r=await runSyntheticP2Integration({modes:{execute:'success',cleanup:'failure',verify:'success'},totalMs:3000,reserveMs:1500,verifyReserveMs:600});
 assert.equal(r.status,'FAIL');
 assert.equal(r.records[1].status,'FAIL');
});
test('synthetic verifier failure prevents PASS',async()=>{
 const r=await runSyntheticP2Integration({modes:{execute:'success',cleanup:'success',verify:'failure'},totalMs:3000,reserveMs:1500,verifyReserveMs:600});
 assert.notEqual(r.status,'PASS');
 assert.equal(r.records[2].status,'NOT_PROVEN');
});
test('hanging synthetic execution is terminated by real watchdog, cleanup still runs',async()=>{
 const r=await runSyntheticP2Integration({modes:{execute:'hang',cleanup:'success',verify:'success'},totalMs:1100,reserveMs:750,verifyReserveMs:280,graceMs:40});
 assert.equal(r.status,'FAIL');
 assert.equal(r.stageOutcomes[0].timedOut,true);
 assert.deepEqual(r.stageOutcomes.map(x=>x.stage),['execute','cleanup','verify']);
 assert.equal(r.actualP2Proven,false);
});
test('hanging synthetic cleanup is bounded rather than claiming success',async()=>{
 const r=await runSyntheticP2Integration({modes:{execute:'success',cleanup:'hang',verify:'success'},totalMs:1200,reserveMs:750,verifyReserveMs:300,graceMs:30});
 assert.equal(r.status,'FAIL');
 assert.ok(r.stageOutcomes.some(x=>x.stage==='cleanup'&&x.timedOut));
});
test('normalizes all three stage records including unattempted stages',()=>{
 const entries=normalizeStageRecords({execution:{status:'FAIL',attempted:true},cleanup:{status:'NOT_PROVEN',attempted:false},verification:{status:'NOT_PROVEN',attempted:false}});
 assert.deepEqual(entries.map(x=>x.attempted),[true,false,false]);
 assert.deepEqual(entries.map(x=>x.name),['execute','cleanup','verify']);
});
test('rejects unsupported mode so it cannot run arbitrary script',async()=>{
 await assert.rejects(()=>runSyntheticP2Integration({modes:{execute:'production',cleanup:'success',verify:'success'}}));
});
