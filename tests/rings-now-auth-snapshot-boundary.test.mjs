import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRingsNowAuthSnapshotBoundary} from '../src/rings-now-auth-snapshot-boundary.mjs';
import {createRingsNowCalendarSelectionAdapter} from '../src/rings-now-calendar-selection-adapter.mjs';

const A='123e4567-e89b-42d3-a456-426614174000';
const B='123e4567-e89b-42d3-a456-426614174001';
const NOW=Date.parse('2026-11-14T10:00:00.000Z');
const row=(id,owner=A)=>({id,user_id:owner,activity_date:'2026-11-14',
 started_at:'2026-11-14T09:00:00.000Z',distance_km:id===1?5:8,
 deleted_at:null,route:[[1,2]],heart_rate:145});
const source=(rows,owner=A)=>({ownerId:owner,ownerScoped:true,
 unmodifiedSnapshot:true,rows});
const session=id=>id?{user:{id}}:null;
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve}}
test('only session UUID can select sanitized same-day runs; no data before refresh',async()=>{
 let active=A;
 const boundary=createRingsNowAuthSnapshotBoundary({readSession:()=>session(active),
  readOwnerScopedRows:async()=>source([row(1),row(2)])});
 assert.deepEqual(boundary.readRows(),[]);
 const snapshot=await boundary.refresh();
 assert.equal(snapshot.status,'owner_snapshot_ready');
 assert.equal(snapshot.rows.length,2);
 assert.equal(Object.keys(snapshot.rows[0]).length,6);
 assert.equal('route' in snapshot.rows[0],false);
 const a=createRingsNowCalendarSelectionAdapter({
  readRows:boundary.readRows,readCurrentUserId:boundary.readCurrentUserId,
  nowMs:()=>NOW,featureStartedAtMs:NOW-86400000
 });
 assert.deepEqual(a.list().map(x=>x.id),['1','2']);
 assert.equal(a.choose('2').status,'gachi_confirmation_required');
 assert.equal(a.confirmGachi(true).status,'selected_preview_only');
 assert.equal(a.readContext()?.row.id,'2');
 active=B;
 assert.deepEqual(boundary.readRows(),[]);
 assert.equal(a.readContext(),null);
 active=A;
 assert.deepEqual(boundary.readRows(),[]);
});
test('a foreign row or unscoped claim blocks the entire snapshot',async()=>{
 for(const result of [
  source([row(1),row(2,B)]),
  source([row(1),row(2,B)],B),
  {...source([row(1)]),ownerScoped:false},
  {...source([row(1)]),unmodifiedSnapshot:false}
 ]){
  const b=createRingsNowAuthSnapshotBoundary({readSession:()=>session(A),
   readOwnerScopedRows:async()=>result});
  assert.equal((await b.refresh()).status,'blocked');
  assert.deepEqual(b.readRows(),[]);
 }
});
test('no current session, callback failure, or switch during await is denied',async()=>{
 const missing=createRingsNowAuthSnapshotBoundary({
  readSession:()=>null,readOwnerScopedRows:async()=>source([row(1)])});
 assert.equal((await missing.refresh()).status,'blocked');
 const failed=createRingsNowAuthSnapshotBoundary({
  readSession:()=>session(A),readOwnerScopedRows:async()=>{throw Error('private')}});
 assert.equal((await failed.refresh()).status,'blocked');
 let active=A;const pause=deferred();
 const b=createRingsNowAuthSnapshotBoundary({readSession:()=>session(active),
  readOwnerScopedRows:()=>pause.promise});
 const pending=b.refresh();active=B;pause.resolve(source([row(1)]));
 assert.equal((await pending).status,'blocked');
 assert.deepEqual(b.readRows(),[]);
});
test('refresh overlap and clear invalidate late completions',async()=>{
 const first=deferred(),second=deferred();
 let count=0;
 const b=createRingsNowAuthSnapshotBoundary({readSession:()=>session(A),
  readOwnerScopedRows:()=>++count===1?first.promise:second.promise});
 const p1=b.refresh(),p2=b.refresh();
 second.resolve(source([row(2)]));
 assert.equal((await p2).status,'owner_snapshot_ready');
 first.resolve(source([row(1)]));
 assert.equal((await p1).reason,'stale_request');
 assert.deepEqual(b.readRows().map(x=>x.id),['2']);
 b.clear();
 assert.deepEqual(b.readRows(),[]);
});
test('production remains OFF; no runtime auth/network/storage and no published entry',()=>{
 const boundary=readFileSync(new URL('../src/rings-now-auth-snapshot-boundary.mjs',import.meta.url),'utf8');
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.doesNotMatch(boundary,/\bfetch\s*\(|XMLHttpRequest|createClient|localStorage|indexedDB|sessionStorage|\.auth\./);
 assert.doesNotMatch(index,/rings-now-auth-snapshot-boundary/);
 assert.doesNotMatch(sw,/rings-now-auth-snapshot-boundary/);
 assert.match(index,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
});
