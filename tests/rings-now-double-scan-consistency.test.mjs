import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRingsNowPaginatedSnapshotSource} from '../src/rings-now-paginated-snapshot-source.mjs';
import {createRingsNowDoubleScanSource} from '../src/rings-now-double-scan-source.mjs';
import {createRingsNowAuthSnapshotBoundary} from '../src/rings-now-auth-snapshot-boundary.mjs';
import {createRingsNowAuthTransitionEpochGate} from '../src/rings-now-auth-transition-epoch-gate.mjs';
import {createRingsNowCalendarSelectionAdapter} from '../src/rings-now-calendar-selection-adapter.mjs';

const OWNER='123e4567-e89b-42d3-a456-426614174000';
const START='2026-11-14T09:00:00.000Z';
const row=id=>({id,user_id:OWNER,activity_date:'2026-11-14',
 distance_km:5,started_at:START,deleted_at:null,route:[[35,139]],heart_rate:160});
const session=()=>({user:{id:OWNER}});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
function sourceFrom(readPage,readSession=session){
 const paged=createRingsNowPaginatedSnapshotSource({readSession,readPage});
 return {paged,source:createRingsNowDoubleScanSource({readSession,source:paged})};
}
test('stable 52-run dataset read twice; integrates #140 -> #143 -> #137',async()=>{
 let active=OWNER,notify,adapter;
 const data=Array.from({length:52},(_,i)=>row(i+1)),calls=[];
 const readSession=()=>active?{user:{id:active}}:null;
 const {source}=sourceFrom(async request=>{
  calls.push(request.offset);
  return data.slice(request.offset,request.offset+request.limit);
 },readSession);
 const boundary=createRingsNowAuthSnapshotBoundary({
  readSession,readOwnerScopedRows:source.readOwnerScopedRows
 });
 const gate=createRingsNowAuthTransitionEpochGate({
  boundary,source,subscribeAuthChanges:fn=>{notify=fn;return()=>{}},
  onInvalidateSelection:()=>adapter?.invalidate()
 });
 adapter=createRingsNowCalendarSelectionAdapter({
  readRows:gate.readRows,readCurrentUserId:gate.readCurrentUserId,
  nowMs:()=>Date.parse('2026-11-14T10:00:00Z'),
  featureStartedAtMs:Date.parse('2026-11-13T10:00:00Z')
 });
 assert.equal((await gate.refresh()).status,'owner_snapshot_ready');
 assert.deepEqual(calls,[0,50,0,50]);
 assert.equal(adapter.list().length,52);
 assert.equal(adapter.choose('52').status,'gachi_confirmation_required');
 assert.equal(adapter.confirmGachi(true).status,'selected_preview_only');
 assert.equal(adapter.readContext().row.id,'52');
 assert.equal('route' in adapter.readContext().row,false);
 assert.equal('heart_rate' in adapter.readContext().row,false);
 active=null;notify();active=OWNER;notify();
 assert.equal((await gate.refresh()).status,'owner_snapshot_ready');
 assert.equal(adapter.readContext(),null);
 gate.destroy();
});
test('delete before offset 50 silently skips ID 51 in first scan: mismatch blocks',async()=>{
 let data=Array.from({length:52},(_,i)=>row(i+1)),calls=0;
 const {source}=sourceFrom(async ({offset,limit})=>{
  calls++;
  if(calls===2)data=data.slice(1);
  return data.slice(offset,offset+limit);
 });
 const result=await source.readOwnerScopedRows(OWNER);
 assert.equal(result.status,'blocked');
 assert.equal(result.reason,'scan_mismatch');
 assert.deepEqual(result.rows,[]);
 assert.equal(calls,4);
});
test('update a displayed field between scans blocks all rows',async()=>{
 let scan=0;
 const {source}=sourceFrom(async ({offset})=>{
  if(offset!==0)return [];
  scan++;
  return [{...row(1),distance_km:scan===1?5:6}];
 });
 const result=await source.readOwnerScopedRows(OWNER);
 assert.equal(result.reason,'scan_mismatch');
 assert.deepEqual(result.rows,[]);
});
test('a foreign row / invalid order causes an entire scan to fail',async()=>{
 for(const bad of [
  [row(1),{...row(2),user_id:'123e4567-e89b-42d3-a456-426614174001'}],
  [row(2),row(1)],
 ]){
  const {source}=sourceFrom(async()=>bad);
  const result=await source.readOwnerScopedRows(OWNER);
  assert.equal(result.reason,'first_scan_invalid');
  assert.deepEqual(result.rows,[]);
 }
});
test('logout and explicit clear while second pass is waiting discard all',async()=>{
 let active=OWNER,scan=0;
 const d=deferred();
 const readSession=()=>active?{user:{id:active}}:null;
 const {source}=sourceFrom(async ()=>{
  scan++;
  return scan===2?d.promise:[row(1)];
 },readSession);
 const pending=source.readOwnerScopedRows(OWNER);
 for(let i=0;i<10&&scan<2;i++)await Promise.resolve();
 assert.equal(scan,2);
 active=null;source.clear();active=OWNER;
 d.resolve([row(1)]);
 const result=await pending;
 assert.equal(result.status,'blocked');
 assert.equal(result.reason,'session_invalidated');
 assert.deepEqual(result.rows,[]);
});
test('the doubled scan cannot claim live RLS or transaction consistency',()=>{
 const src=readFileSync(new URL('../src/rings-now-double-scan-source.mjs',import.meta.url),'utf8');
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.match(src,/NOT a transaction, repeatable-read snapshot or proof of RLS/);
 assert.doesNotMatch(src,/\bfetch\s*\(|XMLHttpRequest|createClient|indexedDB|localStorage|sessionStorage|onAuthStateChange/);
 assert.doesNotMatch(index,/rings-now-double-scan-source/);
 assert.doesNotMatch(sw,/rings-now-double-scan-source/);
 assert.match(index,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
});
