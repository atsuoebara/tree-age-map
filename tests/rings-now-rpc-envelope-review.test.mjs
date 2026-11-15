import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewRingsNowRpcEnvelope as parse} from '../src/rings-now-rpc-envelope-review.mjs';
import {prepareRingsNowOwnerCalendarRows as prepare} from '../src/rings-now-calendar-owner-input-contract.mjs';
import {reviewSelectedCalendarRun} from '../src/ima-wo-shirou-calendar-selection-review.mjs';
import {createRingsNowAuthSnapshotBoundary} from '../src/rings-now-auth-snapshot-boundary.mjs';
const OWNER='123e4567-e89b-42d3-a456-426614174000';
const day='2026-11-15', start='2026-11-15T08:01:02.123456+09:00';
const row=(id,change={})=>({id,user_id:OWNER,activity_date:day,
 distance_km:5.4,started_at:start,deleted_at:null,...change});
const ok=rows=>({status:'candidate_snapshot',rows});
test('microsecond timestamp survives pure parser and calendar selection precisely as text',()=>{
 const result=parse(ok([row(1)]),{expectedOwnerId:OWNER});
 assert.equal(result.status,'rpc_envelope_review_only');
 assert.equal(result.rows[0].started_at,start);
 assert.deepEqual(Object.keys(result.rows[0]),['id','user_id','activity_date','distance_km','started_at','deleted_at']);
 assert.equal('ownerScoped' in result,false);
 assert.equal('unmodifiedSnapshot' in result,false);
 assert.equal(result.analysisAllowed,false);
 const prepared=prepare({ownerId:OWNER,sourceRows:result.rows,
  ownerScoped:true,unmodifiedSnapshot:true}); // synthetic assertions, NEVER Auth proof
 assert.equal(prepared.status,'owner_rows_only');
 assert.equal(prepared.rows[0].started_at,start);
 const review=reviewSelectedCalendarRun({row:prepared.rows[0],currentUserId:OWNER,
  selectedAsGachiRun:true,nowMs:Date.parse(start)+1000,
  featureStartedAtMs:Date.parse(start)-1000});
 assert.equal(review.status,'eligible_window_only');
});
test('pure parsed RPC cannot be directly fed to existing auth boundary as proof',async()=>{
 const payload=parse(ok([row(1)]),{expectedOwnerId:OWNER});
 const boundary=createRingsNowAuthSnapshotBoundary({
  readSession:()=>({user:{id:OWNER}}),
  readOwnerScopedRows:async()=>payload
 });
 const state=await boundary.refresh();
 assert.equal(state.status,'blocked');
 assert.deepEqual(boundary.readRows(),[]);
});
test('blocked RPC statuses preserve only strict known reasons; unexpected fields denied',()=>{
 for(const reason of ['unauthenticated','too_many_rows','missing_required_fields']){
  const result=parse({status:'blocked',reason},{expectedOwnerId:OWNER});
  assert.equal(result.reason,reason);
  assert.deepEqual(result.rows,[]);
 }
 for(const payload of [
  {status:'blocked',reason:'owner_snapshot_ready'},
  {status:'blocked',reason:'too_many_rows',rows:[row(1)]},
  {status:'candidate_snapshot',rows:[],ownerScoped:true},
  {status:'candidate_snapshot',rows:[],unmodifiedSnapshot:true},
  {status:'candidate_snapshot',rows:[row(1)],token:'private'},
  {status:'unknown',rows:[]},
 ])assert.equal(parse(payload,{expectedOwnerId:OWNER}).status,'blocked');
});
test('fail closed on foreign, unsorted, duplicate, deleted, null, extra, oversized and invalid fields',()=>{
 const cases=[
  [row(1,{user_id:'123e4567-e89b-42d3-a456-426614174001'})],
  [row(2),row(1)],
  [row(1),row('1')],
  [row(1,{deleted_at:'2026-11-15T09:00:00Z'})],
  [row(1,{started_at:null})],
  [row(1,{distance_km:null})],
  [row(1,{activity_date:null})],
  [row(1,{route:[[1,2]]})],
  [row('9007199254740992')],
  [row(0)],
  [row(1,{started_at:'2026-11-15T08:01:02.1234567+09:00'})],
  Array.from({length:1001},(_,i)=>row(i+1))
 ];
 for(const rows of cases){
  const output=parse(ok(rows),{expectedOwnerId:OWNER});
  assert.equal(output.status,'blocked',JSON.stringify(rows.slice(0,2)));
  assert.deepEqual(output.rows,[]);
 }
 assert.equal(parse(ok([row(1)]),{expectedOwnerId:'WRONG'}).status,'blocked');
});
test('no source network/Auth/storage; production is OFF and existing SW unmodified',()=>{
 const code=readFileSync(new URL('../src/rings-now-rpc-envelope-review.mjs',import.meta.url),'utf8');
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.doesNotMatch(code,/\bfetch\s*\(|XMLHttpRequest|createClient|localStorage|indexedDB|sessionStorage/);
 assert.doesNotMatch(index,/rings-now-rpc-envelope-review/);
 assert.doesNotMatch(sw,/rings-now-rpc-envelope-review/);
 assert.match(index,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
});
