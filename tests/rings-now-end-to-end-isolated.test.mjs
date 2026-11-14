import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRingsNowAuthSnapshotBoundary} from '../src/rings-now-auth-snapshot-boundary.mjs';
import {createRingsNowAuthTransitionEpochGate} from '../src/rings-now-auth-transition-epoch-gate.mjs';
import {createRingsNowCalendarSelectionAdapter} from '../src/rings-now-calendar-selection-adapter.mjs';

const A='123e4567-e89b-42d3-a456-426614174000';
const B='123e4567-e89b-42d3-a456-426614174001';
const START='2026-11-06T09:00:00.000Z';
const START_MS=Date.parse(START);
const WINDOW_MS=691200000;
const row=(id,user_id=A)=>({
 id,user_id,activity_date:'2026-11-06',
 started_at:START,distance_km:id===1?5:8,deleted_at:null,
 route:[[35.0,139.0]],heartRate:140
});
function rig({rows=[row(1),row(2)],clock=START_MS+WINDOW_MS,
  featureStartedAtMs=START_MS-1000,readSource=null}={}){
 let owner=A,now=clock,notify=null,adapter;
 const session=()=>owner?{user:{id:owner}}:null;
 const boundary=createRingsNowAuthSnapshotBoundary({
  readSession:session,
  readOwnerScopedRows:readSource??(async user=>({
   ownerId:user,ownerScoped:true,unmodifiedSnapshot:true,rows
  }))
 });
 const gate=createRingsNowAuthTransitionEpochGate({
  boundary,subscribeAuthChanges:callback=>{notify=callback;return()=>{}},
  onInvalidateSelection:()=>adapter?.invalidate()
 });
 adapter=createRingsNowCalendarSelectionAdapter({
  readRows:gate.readRows,readCurrentUserId:gate.readCurrentUserId,
  nowMs:()=>now,featureStartedAtMs
 });
 return {
  gate,adapter,setTime:x=>{now=x},setOwner:x=>{owner=x},authEvent:()=>notify(),
  async load(){return gate.refresh()},
  async select(id){assert.equal(adapter.choose(id).status,'gachi_confirmation_required');
   return adapter.confirmGachi(true)}
 };
}
const assertPreviewOnly=verdict=>{
 assert.equal(verdict.analysisAllowed,false);
 assert.equal(verdict.realFitAllowed,false);
 assert.equal(verdict.productionAllowed,false);
};
test('same-day two runs: explicit run ID and gachi confirmation, no location/HR leak',async()=>{
 const r=rig();
 assert.deepEqual(r.adapter.list(),[]);
 assert.equal((await r.load()).status,'owner_snapshot_ready');
 assert.deepEqual(r.adapter.list(),[
  {id:'1',activityDate:'2026-11-06',distanceKm:5},
  {id:'2',activityDate:'2026-11-06',distanceKm:8}
 ]);
 const requested=r.adapter.choose('2');
 assert.equal(requested.status,'gachi_confirmation_required');
 assertPreviewOnly(requested);
 assert.equal(r.adapter.readContext(),null);
 assert.equal(r.adapter.confirmGachi(false).status,'blocked');
 assert.equal(r.adapter.readContext(),null);
 const selected=await r.select('1');
 assert.equal(selected.status,'selected_preview_only');
 assertPreviewOnly(selected);
 const context=r.adapter.readContext();
 assert.equal(context.row.id,'1');
 assert.equal(context.selectedAsGachiRun,true);
 assert.equal('route' in context.row,false);
 assert.equal('heartRate' in context.row,false);
 assertPreviewOnly(await r.select('2'));
 assert.equal(r.adapter.readContext().row.id,'2');
 r.gate.destroy();
});
test('start+691200 seconds accepted, +1ms expired, no clock rollback revival',async()=>{
 const r=rig();
 await r.load();
 assert.equal((await r.select('1')).status,'selected_preview_only');
 r.setTime(START_MS+WINDOW_MS+1);
 assert.equal(r.adapter.readContext(),null);
 assert.equal(r.adapter.choose('1').status,'blocked');
 r.setTime(START_MS+WINDOW_MS);
 assert.equal(r.adapter.choose('1').status,'blocked');
 r.gate.destroy();
});
test('old record does not become valid on delayed import/reload',async()=>{
 const r=rig({clock:START_MS+WINDOW_MS+1});
 await r.load();
 assert.equal(r.adapter.choose('1').status,'blocked');
 r.setTime(START_MS+WINDOW_MS+5000);
 assert.equal((await r.load()).status,'owner_snapshot_ready');
 assert.equal(r.adapter.choose('1').status,'blocked');
 r.gate.destroy();
});
test('logout A -> A, with no context read during logout, cannot restore gachi',async()=>{
 const r=rig();
 await r.load();await r.select('2');
 r.setOwner(null);r.authEvent();
 r.setOwner(A);r.authEvent();
 assert.equal((await r.load()).status,'owner_snapshot_ready');
 assert.equal(r.adapter.readContext(),null);
 assert.equal(r.adapter.confirmGachi(true).status,'blocked');
 assert.equal(r.adapter.choose('2').status,'gachi_confirmation_required');
 r.gate.destroy();
});
test('switch A -> B, even a forged foreign or deleted row blocks entire set',async()=>{
 for(const rows of [[row(1),row(2,B)],
  [row(1),{...row(2),deleted_at:'2026-11-07T00:00:00.000Z',user_id:B}]]){
  const r=rig({rows});
  assert.equal((await r.load()).status,'blocked');
  assert.deepEqual(r.adapter.list(),[]);
  r.gate.destroy();
 }
 const r=rig();
 await r.load();await r.select('1');
 r.setOwner(B);r.authEvent();
 assert.deepEqual(r.adapter.list(),[]);
 assert.equal(r.adapter.readContext(),null);
 r.gate.destroy();
});
test('no feature start timestamp can never unlock a selection',async()=>{
 const r=rig({featureStartedAtMs:null});
 await r.load();
 assert.equal(r.adapter.choose('1').status,'blocked');
 r.gate.destroy();
});
test('main production UI remains OFF, and no import of isolated flow',()=>{
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.match(index,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
 for(const f of [index,sw]){
  assert.doesNotMatch(f,/rings-now-auth-snapshot-boundary\.mjs|rings-now-auth-transition-epoch-gate\.mjs|rings-now-calendar-selection-adapter\.mjs/);
 }
});
