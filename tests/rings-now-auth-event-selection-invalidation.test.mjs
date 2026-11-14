import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRingsNowAuthTransitionEpochGate} from '../src/rings-now-auth-transition-epoch-gate.mjs';
import {createRingsNowAuthSnapshotBoundary} from '../src/rings-now-auth-snapshot-boundary.mjs';
import {createRingsNowCalendarSelectionAdapter} from '../src/rings-now-calendar-selection-adapter.mjs';

const A='123e4567-e89b-42d3-a456-426614174000';
const B='123e4567-e89b-42d3-a456-426614174001';
const NOW=Date.parse('2026-11-14T10:00:00.000Z');
const row=(id,owner=A)=>({id,user_id:owner,activity_date:'2026-11-14',
 started_at:'2026-11-14T09:00:00.000Z',distance_km:5,deleted_at:null});
const snap=owner=>({ownerId:owner,ownerScoped:true,unmodifiedSnapshot:true,rows:[row(1,owner)]});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};

function harness(source=null){
 let owner=A,notify,invalidations=0,adapter;
 const readSession=()=>owner?{user:{id:owner}}:null;
 const boundary=createRingsNowAuthSnapshotBoundary({
  readSession,readOwnerScopedRows:source??(async current=>snap(current))
 });
 const gate=createRingsNowAuthTransitionEpochGate({
  boundary,subscribeAuthChanges:cb=>{notify=cb;return()=>{}},
  onInvalidateSelection:()=>{invalidations++;adapter?.invalidate()}
 });
 adapter=createRingsNowCalendarSelectionAdapter({
  readRows:gate.readRows,readCurrentUserId:gate.readCurrentUserId,
  nowMs:()=>NOW,featureStartedAtMs:NOW-86400000
 });
 return {gate,adapter,setOwner:v=>owner=v,fire:()=>notify(),getInvalidations:()=>invalidations};
}
async function select(h){
 assert.equal((await h.gate.refresh()).status,'owner_snapshot_ready');
 assert.equal(h.adapter.choose('1').status,'gachi_confirmation_required');
 assert.equal(h.adapter.confirmGachi(true).status,'selected_preview_only');
 assert.ok(h.adapter.readContext());
}
test('A -> logout -> A; do NOT read selection during logout; refresh cannot revive old gachi',async()=>{
 const h=harness();await select(h);
 h.setOwner(null);h.fire();h.setOwner(A);h.fire();
 // Deliberately do not read context while logged out.
 assert.equal((await h.gate.refresh()).status,'owner_snapshot_ready');
 assert.equal(h.adapter.readContext(),null);
 assert.equal(h.adapter.confirmGachi(true).status,'blocked');
 assert.equal(h.adapter.choose('1').status,'gachi_confirmation_required');
 assert.equal(h.getInvalidations(),2);
});
test('same owner token event immediately invalidates, including before a successful refresh',async()=>{
 const h=harness();await select(h);
 h.fire();
 assert.equal(h.adapter.readContext(),null);
 assert.equal((await h.gate.refresh()).status,'owner_snapshot_ready');
 assert.equal(h.adapter.readContext(),null);
});
test('in-flight async source with same owner A/B/A cannot revive selection',async()=>{
 const d=deferred(),h=harness((owner)=>owner===A?d.promise:Promise.resolve(snap(owner)));
 const p=h.gate.refresh();
 h.setOwner(B);h.fire();h.setOwner(A);h.fire();
 d.resolve(snap(A));
 assert.equal((await p).reason,'auth_changed_during_refresh');
 assert.equal(h.adapter.readContext(),null);
});
test('manual clear, destroy, and id switch notify selection invalidation',async()=>{
 const h=harness();await select(h);
 h.gate.clear();assert.equal(h.adapter.readContext(),null);
 await select(h);h.setOwner(B);h.fire();
 assert.equal(h.adapter.readContext(),null);
 h.setOwner(A);await select(h);
 h.gate.destroy();assert.equal(h.adapter.readContext(),null);
 assert.equal(h.getInvalidations(),3);
});
test('callback is optional for legacy isolated callsites; no production wiring',()=>{
 const src=readFileSync(new URL('../src/rings-now-auth-transition-epoch-gate.mjs',import.meta.url),'utf8');
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.match(src,/onInvalidateSelection\?\.\(\)/);
 assert.doesNotMatch(src,/\bfetch\s*\(|onAuthStateChange|indexedDB|localStorage|createClient/);
 for(const publicFile of [index,sw])assert.doesNotMatch(publicFile,/rings-now-auth-event-selection-invalidation/);
 assert.match(index,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
});
