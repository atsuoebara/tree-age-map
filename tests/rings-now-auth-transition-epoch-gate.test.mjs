import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRingsNowAuthTransitionEpochGate as create} from '../src/rings-now-auth-transition-epoch-gate.mjs';
import {createRingsNowAuthSnapshotBoundary} from '../src/rings-now-auth-snapshot-boundary.mjs';
import {createRingsNowCalendarSelectionAdapter} from '../src/rings-now-calendar-selection-adapter.mjs';

const A='123e4567-e89b-42d3-a456-426614174000';
const B='123e4567-e89b-42d3-a456-426614174001';
const NOW=Date.parse('2026-11-14T10:00:00Z');
const row=id=>({id,user_id:A,activity_date:'2026-11-14',
 started_at:'2026-11-14T09:00:00.000Z',distance_km:5,deleted_at:null});
const snapshot=()=>({ownerId:A,ownerScoped:true,unmodifiedSnapshot:true,rows:[row(1)]});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
function harness(readOwnerScopedRows=async()=>snapshot()){
 let user=A,listener=null,unsubscribeCount=0,sourceClears=0;
 const boundary=createRingsNowAuthSnapshotBoundary({
  readSession:()=>user?{user:{id:user}}:null,readOwnerScopedRows
 });
 const gate=create({boundary,source:{clear(){sourceClears++}},
  subscribeAuthChanges:fn=>{listener=fn;return()=>{unsubscribeCount++}}
 });
 return {gate,setUser:v=>{user=v},fire:()=>listener?.(),
  sourceClears:()=>sourceClears,unsubscribeCount:()=>unsubscribeCount};
}
test('same-owner logout and relogin cannot reuse old snapshot',async()=>{
 const h=harness();
 assert.equal((await h.gate.refresh()).status,'owner_snapshot_ready');
 assert.equal(h.gate.readRows().length,1);
 h.setUser(null);h.fire();
 h.setUser(A);h.fire();
 assert.deepEqual(h.gate.readRows(),[]);
 assert.equal(h.gate.readCurrentUserId(),null);
 assert.equal((await h.gate.refresh()).status,'owner_snapshot_ready');
 assert.equal(h.gate.readRows().length,1);
 assert.equal(h.sourceClears(),2);
});
test('same-owner A -> logout -> A mid-await invalidates in-flight response',async()=>{
 const d=deferred(),h=harness(()=>d.promise);
 const pending=h.gate.refresh();
 h.setUser(null);h.fire();h.setUser(A);h.fire();
 d.resolve(snapshot());
 assert.equal((await pending).reason,'auth_changed_during_refresh');
 assert.deepEqual(h.gate.readRows(),[]);
 assert.equal(h.sourceClears(),2);
});
test('different-owner and same-owner token refresh event also invalidate',async()=>{
 const h=harness();
 await h.gate.refresh();
 h.setUser(B);h.fire();
 assert.deepEqual(h.gate.readRows(),[]);
 h.setUser(A);h.fire();
 await h.gate.refresh();
 assert.equal(h.gate.readRows().length,1);
 // Conservative: every explicit auth transition event invalidates,
 // even when owner UUID remains identical.
 h.fire();
 assert.deepEqual(h.gate.readRows(),[]);
});
test('adapter cannot reuse previous gachi confirmation after auth event',async()=>{
 const h=harness();
 await h.gate.refresh();
 const adapter=createRingsNowCalendarSelectionAdapter({
  readRows:h.gate.readRows,readCurrentUserId:h.gate.readCurrentUserId,
  nowMs:()=>NOW,featureStartedAtMs:NOW-86400000
 });
 assert.equal(adapter.choose('1').status,'gachi_confirmation_required');
 assert.equal(adapter.confirmGachi(true).status,'selected_preview_only');
 assert.equal(adapter.readContext()?.row.id,'1');
 h.fire();
 assert.equal(adapter.readContext(),null);
 await h.gate.refresh();
 assert.equal(adapter.readContext(),null);
 assert.equal(adapter.choose('1').status,'gachi_confirmation_required');
});
test('destroy invalidates, unsubscribes, and prevents revival',async()=>{
 const h=harness();
 await h.gate.refresh();
 h.gate.destroy();
 assert.deepEqual(h.gate.readRows(),[]);
 assert.equal(h.gate.readCurrentUserId(),null);
 assert.equal(h.unsubscribeCount(),1);
 assert.equal((await h.gate.refresh()).reason,'disposed');
 h.gate.destroy();
 assert.equal(h.unsubscribeCount(),1);
});
test('no real auth subscription or production publication; existing feature OFF',()=>{
 const code=readFileSync(new URL('../src/rings-now-auth-transition-epoch-gate.mjs',import.meta.url),'utf8');
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.doesNotMatch(code,/\bfetch\s*\(|XMLHttpRequest|createClient|localStorage|indexedDB|sessionStorage|onAuthStateChange/);
 assert.doesNotMatch(index,/rings-now-auth-transition-epoch-gate/);
 assert.doesNotMatch(sw,/rings-now-auth-transition-epoch-gate/);
 assert.match(index,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
});
