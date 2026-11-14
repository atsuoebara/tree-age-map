import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareRingsNowOwnerCalendarRows as prepare} from '../src/rings-now-calendar-owner-input-contract.mjs';
import {createRingsNowCalendarSelectionAdapter} from '../src/rings-now-calendar-selection-adapter.mjs';
const now=Date.parse('2026-11-14T10:00:00.000Z');
const row=(id,distance,more={})=>({
 id,user_id:'7',activity_date:'2026-11-14',
 distance_km:distance,started_at:'2026-11-14T09:00:00.000Z',
 deleted_at:null,location:'should never be exported',heart_rate:150,...more
});
const call=(rows,options={})=>prepare({
 ownerId:'7',sourceRows:rows,ownerScoped:true,unmodifiedSnapshot:true,...options
});
test('owner-only live rows retain calendar date and distance, drop extras and deletions',()=>{
 const result=call([row(11,5),row(12,8),row(13,2,{deleted_at:'2026-11-14T10:00:00Z'})]);
 assert.equal(result.status,'owner_rows_only');
 assert.deepEqual(result.rows,[
  {id:'11',user_id:'7',activity_date:'2026-11-14',distance_km:5,started_at:'2026-11-14T09:00:00.000Z',deleted_at:null},
  {id:'12',user_id:'7',activity_date:'2026-11-14',distance_km:8,started_at:'2026-11-14T09:00:00.000Z',deleted_at:null}
 ]);
 assert.ok(Object.isFrozen(result.rows));
 assert.ok(Object.isFrozen(result.rows[0]));
 assert.equal(JSON.stringify(result).includes('heart_rate'),false);
 assert.equal(JSON.stringify(result).includes('location'),false);
});
test('one foreign row is a total failure, even if deleted',()=>{
 for(const candidate of [row(12,8,{user_id:'8'}),row(12,8,{user_id:'8',deleted_at:'x'})]){
  const output=call([row(11,5),candidate]);
  assert.equal(output.status,'blocked');
  assert.deepEqual(output.rows,[]);
 }
});
test('fail closed unless explicit owner scoping and immutable snapshot are asserted',()=>{
 const rows=[row(11,5)];
 assert.equal(prepare({ownerId:'7',sourceRows:rows}).status,'blocked');
 assert.equal(call(rows,{ownerScoped:'true'}).status,'blocked');
 assert.equal(call(rows,{unmodifiedSnapshot:1}).status,'blocked');
 assert.equal(call(rows,{ownerId:null}).status,'blocked');
});
test('duplicate ids, invalid fields, wrong owner, excessive rows fail closed',()=>{
 for(const sourceRows of [
  [row(11,5),row('11',8)],
  [row(0,5)],
  [row(11,NaN)],
  [row(11,5,{started_at:null})],
  [row(11,5,{activity_date:'2026-11-14T09:00:00Z'})],
  new Array(1001).fill(row(11,5))
 ]){
  const output=call(sourceRows);
  assert.equal(output.status,'blocked');
  assert.deepEqual(output.rows,[]);
 }
});
test('sanitized owner snapshot interoperates with isolated calendar-selection gate',()=>{
 const result=call([row(11,5),row(12,8)]);
 assert.equal(result.status,'owner_rows_only');
 const a=createRingsNowCalendarSelectionAdapter({
  readRows:()=>result.rows,readCurrentUserId:()=> '7',nowMs:()=>now,
  featureStartedAtMs:now-2*86400000
 });
 assert.equal(a.list().length,2);
 assert.equal(a.choose('12').status,'gachi_confirmation_required');
 assert.equal(a.readContext(),null);
 assert.equal(a.confirmGachi(true).status,'selected_preview_only');
 assert.equal(a.readContext().row.id,'12');
 assert.equal(a.readContext().row.distance_km,8);
});
test('source and existing production files remain disconnected and off',()=>{
 const code=readFileSync(new URL('../src/rings-now-calendar-owner-input-contract.mjs',import.meta.url),'utf8');
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.doesNotMatch(code,/\bfetch\s*\(|XMLHttpRequest|createClient|localStorage|indexedDB|sessionStorage|\.from\s*\(/);
 assert.doesNotMatch(index,/rings-now-calendar-owner-input-contract/);
 assert.doesNotMatch(sw,/rings-now-calendar-owner-input-contract/);
 assert.match(index,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
});
