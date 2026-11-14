import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRingsNowPaginatedSnapshotSource as create,RINGS_NOW_PAGE_SIZE} from '../src/rings-now-paginated-snapshot-source.mjs';
import {createRingsNowAuthSnapshotBoundary} from '../src/rings-now-auth-snapshot-boundary.mjs';
import {createRingsNowCalendarSelectionAdapter} from '../src/rings-now-calendar-selection-adapter.mjs';

const OWNER='123e4567-e89b-42d3-a456-426614174000';
const OTHER='123e4567-e89b-42d3-a456-426614174001';
const NOW=Date.parse('2026-11-14T10:00:00.000Z');
const row=(id,user_id=OWNER)=>({id,user_id,activity_date:'2026-11-14',
 started_at:'2026-11-14T09:00:00.000Z',distance_km:5,deleted_at:null,
 route:[[35,139]],heart_rate:150});
const session=id=>id?{user:{id}}:null;
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
test('50-item pages, stable request contract and 101st item; no sensitive fields',async()=>{
 let user=OWNER;const rows=Array.from({length:101},(_,i)=>row(i+1)),calls=[];
 const source=create({readSession:()=>session(user),readPage:async params=>{
  calls.push(params);
  return rows.slice(params.offset,params.offset+params.limit);
 }});
 const result=await source.readOwnerScopedRows(OWNER);
 assert.equal(result.rows.length,101);
 assert.deepEqual(calls.map(p=>p.offset),[0,50,100]);
 assert.equal(RINGS_NOW_PAGE_SIZE,50);
 for(const p of calls){
  assert.equal(p.ownerId,OWNER);
  assert.equal(p.limit,50);
  assert.equal(p.deletedAtIsNull,true);
  assert.equal(p.stableOrder,'id.asc');
  assert.deepEqual(p.columns,['id','user_id','activity_date','distance_km','started_at','deleted_at']);
 }
 assert.equal(Object.isFrozen(result.rows),true);
 assert.equal(Object.isFrozen(result.rows[0]),true);
 assert.equal('route' in result.rows[0],false);
 assert.equal('heart_rate' in result.rows[0],false);
});
test('foreign and deleted rows, duplicates, oversized pages, and more than 1000 blocked',async()=>{
 for(const response of [
  [row(1),row(2,OTHER)], [row(1),{...row(2),deleted_at:'now'}],
  [row(1),row(1)],Array.from({length:51},(_,i)=>row(i+1))
 ]){
  const s=create({readSession:()=>session(OWNER),readPage:async()=>response});
  const result=await s.readOwnerScopedRows(OWNER);
  assert.equal(result.status,'blocked');
  assert.deepEqual(result.rows,[]);
 }
 const many=Array.from({length:1001},(_,i)=>row(i+1));
 const s=create({readSession:()=>session(OWNER),
  readPage:async p=>many.slice(p.offset,p.offset+p.limit)});
 const output=await s.readOwnerScopedRows(OWNER);
 assert.equal(output.reason,'too_many_rows');
});
test('no session, wrong owner, interrupted page or logout clears entire result',async()=>{
 let owner=null;
 const s=create({readSession:()=>session(owner),readPage:async()=>[row(1)]});
 assert.equal((await s.readOwnerScopedRows(OWNER)).status,'blocked');
 owner=OWNER;
 assert.equal((await s.readOwnerScopedRows(OTHER)).status,'blocked');
 const gate=deferred();let pages=0;
 const pendingSource=create({readSession:()=>session(owner),readPage:()=>{
  pages++;return gate.promise;
 }});
 const p=pendingSource.readOwnerScopedRows(OWNER);
 owner=null;gate.resolve([row(1)]);
 assert.equal((await p).reason,'session_invalidated');
 assert.equal(pages,1);
});
test('clear and concurrent requests reject stale responses',async()=>{
 const d=deferred();
 let count=0;
 const s=create({readSession:()=>session(OWNER),
  readPage:()=>++count===1?d.promise:Promise.resolve([row(2)])});
 const p1=s.readOwnerScopedRows(OWNER);
 const p2=await s.readOwnerScopedRows(OWNER);
 assert.equal(p2.rows.length,1);
 d.resolve([row(1)]);
 assert.equal((await p1).reason,'session_invalidated');
 const d2=deferred();
 const t=create({readSession:()=>session(OWNER),readPage:()=>d2.promise});
 const p=t.readOwnerScopedRows(OWNER);
 t.clear();d2.resolve([row(3)]);
 assert.equal((await p).status,'blocked');
});
test('isolated chain: paginated mock -> #140 boundary -> #138 contract -> #137 adapter',async()=>{
 let active=OWNER;
 const pages=create({readSession:()=>session(active),
  readPage:async p=>p.offset===0?[row(1),row(2)]:[]});
 const boundary=createRingsNowAuthSnapshotBoundary({
  readSession:()=>session(active),readOwnerScopedRows:pages.readOwnerScopedRows
 });
 assert.equal((await boundary.refresh()).status,'owner_snapshot_ready');
 const adapter=createRingsNowCalendarSelectionAdapter({
  readRows:boundary.readRows,readCurrentUserId:boundary.readCurrentUserId,
  nowMs:()=>NOW,featureStartedAtMs:NOW-86400000
 });
 assert.equal(adapter.list().length,2);
 assert.equal(adapter.choose('2').status,'gachi_confirmation_required');
 assert.equal(adapter.confirmGachi(true).status,'selected_preview_only');
 assert.equal(adapter.readContext()?.row.id,'2');
 active=OTHER;
 assert.deepEqual(boundary.readRows(),[]);
 assert.equal(adapter.readContext(),null);
});
test('disconnected from production, network and storage; feature OFF',()=>{
 const source=readFileSync(new URL('../src/rings-now-paginated-snapshot-source.mjs',import.meta.url),'utf8');
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\bfetch\s*\(|XMLHttpRequest|createClient|localStorage|indexedDB|sessionStorage|\.auth\./);
 assert.doesNotMatch(index,/rings-now-paginated-snapshot-source/);
 assert.doesNotMatch(sw,/rings-now-paginated-snapshot-source/);
 assert.match(index,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
});
