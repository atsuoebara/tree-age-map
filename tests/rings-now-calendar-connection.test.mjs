import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRingsNowCalendarConnection} from '../src/rings-now-calendar-connection.mjs';
const owner='12345678-1234-1234-1234-123456789abc';
const now=Date.parse('2026-11-27T12:00:00Z');
const row={id:1,user_id:owner,activity_date:'2026-11-26',distance_km:5,started_at:'2026-11-26T12:00:00.123456Z',deleted_at:null};
function setup({rollout=now-2*86400000,rows=[row],rpc}={}){
 let listener,session={user:{id:owner}},calls=0,invalidations=0;
 const connection=createRingsNowCalendarConnection({
  client:{rpc:async name=>{calls++;assert.equal(name,'rings_now_snapshot_candidate_v03');
   return rpc?rpc():{data:{status:'candidate_snapshot',rows},error:null}}},
  readSession:()=>session,subscribeAuthChanges:fn=>{listener=fn;return ()=>{listener=null}},
  nowMs:()=>now,featureStartedAtMs:rollout,onInvalidate:()=>invalidations++});
 return {connection,auth:()=>listener(),logout:()=>{session=null;listener()},calls:()=>calls,
  invalidations:()=>invalidations};
}
test('exact run ID and date, explicit gachi confirmation, no analysis permission',async()=>{
 const {connection:c,calls}=setup({rows:[row,{...row,id:2}]});
 assert.equal((await c.choose('2',owner,row.activity_date)).status,'gachi_confirmation_required');
 assert.equal(c.readContext(),null);
 const result=c.confirmGachi(true);
 assert.equal(result.status,'selected_preview_only');
 assert.equal(result.realFitAllowed,false);
 assert.equal(c.readContext().row.id,'2');
 assert.equal(calls(),1);
 c.clear();assert.equal(c.readContext(),null);c.destroy();
});
test('null rollout never requests RPC',async()=>{
 const {connection:c,calls}=setup({rollout:null});
 assert.equal((await c.choose('1',owner,row.activity_date)).status,'blocked');
 assert.equal(calls(),0);c.destroy();
});
test('foreign owner, wrong day, deleted or missing row cannot be selected',async()=>{
 for(const rows of [[{...row,user_id:'abcdefab-1234-1234-1234-123456789abc'}],[{...row,deleted_at:row.started_at}],[]]){
  const {connection:c}=setup({rows});
  assert.equal((await c.choose('1',owner,row.activity_date)).status,'blocked');c.destroy();
 }
 const {connection:c}=setup();
 assert.equal((await c.choose('1',owner,'2026-11-25')).status,'blocked');c.destroy();
});
test('same-owner auth event invalidates pending request and confirmed selection',async()=>{
 let release;const p=new Promise(r=>release=r);
 const {connection:c,auth}=setup({rpc:()=>p});
 const pending=c.choose('1',owner,row.activity_date);auth();
 release({data:{status:'candidate_snapshot',rows:[row]},error:null});
 assert.equal((await pending).status,'blocked');
 assert.equal(c.readContext(),null);c.destroy();
 const second=setup();await second.connection.choose('1',owner,row.activity_date);
 second.connection.confirmGachi(true);second.auth();assert.equal(second.connection.readContext(),null);
 second.connection.destroy();
});
test('overlapping selections reject older response',async()=>{
 const releases=[];const {connection:c}=setup({rpc:()=>new Promise(r=>releases.push(r))});
 const a=c.choose('1',owner,row.activity_date),b=c.choose('2',owner,row.activity_date);
 const data={data:{status:'candidate_snapshot',rows:[row,{...row,id:2}]},error:null};
 releases[1](data);assert.equal((await b).status,'gachi_confirmation_required');
 releases[0](data);assert.equal((await a).status,'blocked');
 c.confirmGachi(true);assert.equal(c.readContext().row.id,'2');c.destroy();
});
