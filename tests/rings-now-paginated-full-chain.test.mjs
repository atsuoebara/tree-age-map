import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRingsNowPaginatedSnapshotSource} from '../src/rings-now-paginated-snapshot-source.mjs';
import {createRingsNowAuthSnapshotBoundary} from '../src/rings-now-auth-snapshot-boundary.mjs';
import {createRingsNowAuthTransitionEpochGate} from '../src/rings-now-auth-transition-epoch-gate.mjs';
import {createRingsNowCalendarSelectionAdapter} from '../src/rings-now-calendar-selection-adapter.mjs';

const A='123e4567-e89b-42d3-a456-426614174000';
const B='123e4567-e89b-42d3-a456-426614174001';
const START='2026-11-06T09:00:00.000Z';
const START_MS=Date.parse(START);
const WINDOW=691200000;
const row=(id,owner=A)=>({id,user_id:owner,activity_date:'2026-11-06',
 distance_km:id%2?5:8,started_at:START,deleted_at:null,
 route:[[35,139]],heart_rate:155,filename:'never-propagate.fit'});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
function makeRig({rows=[row(1),row(2)],nowMs=START_MS+WINDOW,
 featureStartedAtMs=START_MS-1000,page=null}={}){
 let active=A,tick=nowMs,fire=null,adapter;
 const calls=[];
 const readSession=()=>active?{user:{id:active}}:null;
 const source=createRingsNowPaginatedSnapshotSource({
  readSession,readPage:async arg=>{
   calls.push(arg);
   return page ? page(arg) : rows.slice(arg.offset,arg.offset+arg.limit);
  }
 });
 const boundary=createRingsNowAuthSnapshotBoundary({
  readSession,readOwnerScopedRows:source.readOwnerScopedRows
 });
 const gate=createRingsNowAuthTransitionEpochGate({
  boundary,source,subscribeAuthChanges:cb=>{fire=cb;return()=>{}},
  onInvalidateSelection:()=>adapter?.invalidate()
 });
 adapter=createRingsNowCalendarSelectionAdapter({
  readRows:gate.readRows,readCurrentUserId:gate.readCurrentUserId,
  nowMs:()=>tick,featureStartedAtMs
 });
 return {source,boundary,gate,adapter,calls,
  setOwner:x=>active=x,setTime:x=>tick=x,authEvent:()=>fire(),
  async close(){gate.destroy()}
 };
}
test('50+2 pages -> #140 -> #143/#144 -> #137; choose specific same-day run',async()=>{
 const rows=Array.from({length:52},(_,i)=>row(i+1));
 const h=makeRig({rows});
 assert.deepEqual(h.adapter.list(),[]);
 assert.equal((await h.gate.refresh()).status,'owner_snapshot_ready');
 assert.deepEqual(h.calls.map(x=>x.offset),[0,50]);
 assert.equal(h.calls[0].limit,50);
 assert.equal(h.calls[0].stableOrder,'id.asc');
 assert.equal(h.calls[0].deletedAtIsNull,true);
 assert.deepEqual(h.calls[0].columns,['id','user_id','activity_date','distance_km','started_at','deleted_at']);
 assert.equal(h.adapter.list().length,52);
 assert.equal(h.adapter.choose('51').status,'gachi_confirmation_required');
 assert.equal(h.adapter.readContext(),null);
 const selected=h.adapter.confirmGachi(true);
 assert.equal(selected.status,'selected_preview_only');
 for(const x of ['analysisAllowed','realFitAllowed','productionAllowed'])assert.equal(selected[x],false);
 assert.equal(h.adapter.readContext().row.id,'51');
 for(const key of ['route','heart_rate','filename'])assert.equal(key in h.adapter.readContext().row,false);
 assert.equal(h.adapter.choose('52').status,'gachi_confirmation_required');
 assert.equal(h.adapter.confirmGachi(true).status,'selected_preview_only');
 assert.equal(h.adapter.readContext().row.id,'52');
 await h.close();
});
test('exactly 1000 runs: 21st empty page, valid selection at the final boundary',async()=>{
 const h=makeRig({rows:Array.from({length:1000},(_,i)=>row(i+1))});
 assert.equal((await h.gate.refresh()).status,'owner_snapshot_ready');
 assert.equal(h.calls.length,21);
 assert.equal(h.calls.at(-1).offset,1000);
 assert.equal(h.adapter.list().length,1000);
 assert.equal(h.adapter.choose('1000').status,'gachi_confirmation_required');
 assert.equal(h.adapter.confirmGachi(true).status,'selected_preview_only');
 await h.close();
});
test('1001 runs blocked without permitting partial selection',async()=>{
 const h=makeRig({rows:Array.from({length:1001},(_,i)=>row(i+1))});
 assert.equal((await h.gate.refresh()).status,'blocked');
 assert.equal(h.calls.length,21);
 assert.deepEqual(h.adapter.list(),[]);
 assert.equal(h.adapter.choose('1').status,'blocked');
 await h.close();
});
test('foreign/deleted record on second page blocks all first-page runs',async()=>{
 for(const bad of [row(51,B),{...row(51),deleted_at:'2026-11-07T00:00:00.000Z'},row(2)]){
  const rows=[...Array.from({length:50},(_,i)=>row(i+1)),bad];
  const h=makeRig({rows});
  assert.equal((await h.gate.refresh()).status,'blocked');
  assert.deepEqual(h.adapter.list(),[]);
  assert.equal(h.adapter.choose('1').status,'blocked');
  await h.close();
 }
});
test('A logout A during second page: no old result, confirmation remains erased',async()=>{
 const d=deferred();let second=false;
 const h=makeRig({page:arg=>{
  if(arg.offset===0)return Array.from({length:50},(_,i)=>row(i+1));
  second=true;return d.promise;
 }});
 const pending=h.gate.refresh();
 // Microtasks settle first page and start second.
 for(let n=0;n<8 && !second;n++)await Promise.resolve();
 assert.equal(second,true);
 h.setOwner(null);h.authEvent();
 h.setOwner(A);h.authEvent();
 d.resolve([row(51)]);
 assert.equal((await pending).status,'blocked');
 assert.deepEqual(h.adapter.list(),[]);
 assert.equal(h.adapter.confirmGachi(true).status,'blocked');
 await h.close();
});
test('8-day limit inclusive; +1ms expires; later page reload does not revive',async()=>{
 const h=makeRig();
 await h.gate.refresh();
 assert.equal(h.adapter.choose('2').status,'gachi_confirmation_required');
 assert.equal(h.adapter.confirmGachi(true).status,'selected_preview_only');
 h.setTime(START_MS+WINDOW+1);
 assert.equal(h.adapter.readContext(),null);
 assert.equal((await h.gate.refresh()).status,'owner_snapshot_ready');
 assert.equal(h.adapter.choose('2').status,'blocked');
 h.setTime(START_MS+WINDOW);
 assert.equal(h.adapter.choose('2').status,'blocked');
 await h.close();
});
test('no rollout start cannot unlock even the fresh owner-scoped paginated source',async()=>{
 const h=makeRig({featureStartedAtMs:null});
 assert.equal((await h.gate.refresh()).status,'owner_snapshot_ready');
 assert.equal(h.adapter.choose('1').status,'blocked');
 await h.close();
});
test('review-only: no public wiring; feature OFF and start null remain unchanged',()=>{
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.match(index,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
 for(const text of [index,sw]){
  assert.doesNotMatch(text,/rings-now-paginated-snapshot-source\.mjs|rings-now-auth-transition-epoch-gate\.mjs|rings-now-auth-snapshot-boundary\.mjs/);
 }
});
