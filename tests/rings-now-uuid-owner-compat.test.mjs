import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareRingsNowOwnerCalendarRows as prepare} from '../src/rings-now-calendar-owner-input-contract.mjs';
import {createRingsNowCalendarSelectionAdapter as create} from '../src/rings-now-calendar-selection-adapter.mjs';
const USER='123e4567-e89b-42d3-a456-426614174000';
const OTHER='123e4567-e89b-42d3-a456-426614174001';
const NOW=Date.parse('2026-11-14T10:00:00.000Z');
const makeRow=(id,user_id=USER)=>({id,user_id,activity_date:'2026-11-14',
  started_at:'2026-11-14T09:00:00.000Z',distance_km:id===1?5:8,deleted_at:null,
  private_latitude:36.5,heart_rate:145});
const scoped=(rows,owner=USER)=>prepare({ownerId:owner,sourceRows:rows,
 ownerScoped:true,unmodifiedSnapshot:true});
test('UUID owner, numeric run IDs: minimal snapshot and separate same-day selections',()=>{
 const result=scoped([makeRow(1),makeRow(2)]);
 assert.equal(result.status,'owner_rows_only');
 assert.deepEqual(result.rows.map(r=>Object.keys(r)),[[
   'id','user_id','activity_date','distance_km','started_at','deleted_at'
 ],['id','user_id','activity_date','distance_km','started_at','deleted_at']]);
 assert.equal(JSON.stringify(result).includes('private_latitude'),false);
 const a=create({readRows:()=>result.rows,readCurrentUserId:()=>USER,
   nowMs:()=>NOW,featureStartedAtMs:NOW-2*86400000});
 assert.deepEqual(a.list().map(x=>x.id),['1','2']);
 assert.equal(a.choose('1').status,'gachi_confirmation_required');
 assert.equal(a.readContext(),null);
 assert.equal(a.confirmGachi(true).status,'selected_preview_only');
 assert.equal(a.readContext().currentUserId,USER);
 assert.equal(a.readContext().row.id,'1');
 assert.equal(a.choose('2').status,'gachi_confirmation_required');
 assert.equal(a.readContext(),null);
 assert.equal(a.confirmGachi(true).status,'selected_preview_only');
 assert.equal(a.readContext().row.id,'2');
});
test('different UUID owner anywhere rejects whole snapshot, including deleted foreign row',()=>{
 for(const foreign of [makeRow(2,OTHER),{...makeRow(2,OTHER),deleted_at:'now'}]){
  const result=scoped([makeRow(1),foreign]);
  assert.equal(result.status,'blocked');
  assert.deepEqual(result.rows,[]);
 }
});
test('malformed owners and run ids are rejected, numeric compatibility stays isolated',()=>{
 for(const bad of ['123e4567-e89b-42d3-a456-42661417400','123e4567-e89b-42d3-a456-42661417400z','123E4567-E89B-42D3-A456-426614174000', '0', 0,{},null]){
  const r=scoped([makeRow(1)],bad);assert.equal(r.status,'blocked');
 }
 assert.equal(scoped([{...makeRow(1),id:'123e4567-e89b-42d3-a456-426614174000'}]).status,'blocked');
 const legacy=scoped([makeRow(1,'7')],'7');
 assert.equal(legacy.status,'owner_rows_only');
});
test('changed logged-in UUID invalidates chosen selection',()=>{
 const result=scoped([makeRow(1)]);
 let user=USER;
 const a=create({readRows:()=>result.rows,readCurrentUserId:()=>user,
   nowMs:()=>NOW,featureStartedAtMs:NOW-2*86400000});
 a.choose(1);a.confirmGachi(true);
 assert.equal(a.readContext()?.currentUserId,USER);
 user=OTHER;
 assert.equal(a.readContext(),null);
 user=USER;
 assert.equal(a.readContext(),null);
});
test('production gate remains off and UUID support cannot imply actual authentication',()=>{
 const contract=readFileSync(new URL('../src/rings-now-calendar-owner-input-contract.mjs',import.meta.url),'utf8');
 const adapter=readFileSync(new URL('../src/rings-now-calendar-selection-adapter.mjs',import.meta.url),'utf8');
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.match(contract,/ownerScoped!==true/);
 assert.match(contract,/unmodifiedSnapshot!==true/);
 assert.match(index,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
 for(const s of [contract,adapter]){
   assert.doesNotMatch(s,/\bfetch\s*\(|XMLHttpRequest|createClient|localStorage|indexedDB|sessionStorage/);
 }
 for(const s of [index,sw])assert.doesNotMatch(s,/rings-now-auth-uuid-owner-compat/);
});
