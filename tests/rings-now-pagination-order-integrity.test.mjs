import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRingsNowPaginatedSnapshotSource} from '../src/rings-now-paginated-snapshot-source.mjs';
import {createRingsNowAuthSnapshotBoundary} from '../src/rings-now-auth-snapshot-boundary.mjs';
import {createRingsNowCalendarSelectionAdapter} from '../src/rings-now-calendar-selection-adapter.mjs';

const OWNER='123e4567-e89b-42d3-a456-426614174000';
const start='2026-11-14T09:00:00.000Z';
const row=id=>({id,user_id:OWNER,activity_date:'2026-11-14',
 distance_km:5,started_at:start,deleted_at:null});
const sess=()=>({user:{id:OWNER}});
const build=rows=>createRingsNowPaginatedSnapshotSource({
 readSession:sess,readPage:async ({offset,limit})=>rows.slice(offset,offset+limit)
});
test('strict numeric ascending IDs across the 50-row boundary',async()=>{
 const ids=[...Array.from({length:50},(_,i)=>i+1),52,51];
 const s=build(ids.map(row));
 const response=await s.readOwnerScopedRows(OWNER);
 assert.equal(response.status,'blocked');
 assert.equal(response.reason,'page_order_or_id_invalid');
 assert.deepEqual(response.rows,[]);
});
test('out-of-order first page is denied, even if IDs are distinct',async()=>{
 const s=build([row(1),row(3),row(2)]);
 const response=await s.readOwnerScopedRows(OWNER);
 assert.equal(response.reason,'page_order_or_id_invalid');
 assert.deepEqual(response.rows,[]);
});
test('inter-page overlap in order without duplicate ID is denied',async()=>{
 const ids=[...Array.from({length:50},(_,i)=>100+i),1];
 const response=await build(ids.map(row)).readOwnerScopedRows(OWNER);
 assert.equal(response.reason,'page_order_or_id_invalid');
 assert.deepEqual(response.rows,[]);
});
test('invalid or unsafe numeric run ID is denied before downstream contract',async()=>{
 for(const id of ['9007199254740993',9007199254740992,'1.5','0','-1']){
  const response=await build([row(id)]).readOwnerScopedRows(OWNER);
  assert.equal(response.status,'blocked',String(id));
  assert.deepEqual(response.rows,[]);
 }
});
test('monotonically increasing gapped IDs pass, with all sanitized data',async()=>{
 const ids=[...Array.from({length:50},(_,i)=>i*2+1),105,111];
 const source=build(ids.map(row));
 const boundary=createRingsNowAuthSnapshotBoundary({
  readSession:sess,readOwnerScopedRows:source.readOwnerScopedRows
 });
 assert.equal((await boundary.refresh()).status,'owner_snapshot_ready');
 const adapter=createRingsNowCalendarSelectionAdapter({
  readRows:boundary.readRows,readCurrentUserId:boundary.readCurrentUserId,
  nowMs:()=>Date.parse('2026-11-14T10:00:00Z'),
  featureStartedAtMs:Date.parse('2026-11-13T10:00:00Z')
 });
 assert.equal(adapter.list().length,52);
 assert.equal(adapter.choose('111').status,'gachi_confirmation_required');
 assert.equal(adapter.confirmGachi(true).status,'selected_preview_only');
});
test('no live Auth/network/cache or production import',()=>{
 const src=readFileSync(new URL('../src/rings-now-paginated-snapshot-source.mjs',import.meta.url),'utf8');
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.doesNotMatch(src,/\bfetch\s*\(|XMLHttpRequest|createClient|localStorage|indexedDB|sessionStorage|onAuthStateChange/);
 assert.doesNotMatch(index,/rings-now-paginated-snapshot-source/);
 assert.doesNotMatch(sw,/rings-now-paginated-snapshot-source/);
 assert.match(index,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
});
