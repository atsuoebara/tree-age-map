import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRingsNowCalendarSelectionAdapter as create} from '../src/rings-now-calendar-selection-adapter.mjs';
const HOUR=3600000,DAY8=691200000,BASE=Date.parse('2026-11-14T10:00:00.000Z');
const row=(id,distance,started=BASE-HOUR)=>({
  id,user_id:'7',activity_date:'2026-11-14',distance_km:distance,
  started_at:new Date(started).toISOString(),deleted_at:null
});
function fixture(opts={}){
 let now=opts.now??BASE,owner=opts.owner??'7',rows=opts.rows??[row(11,5),row(12,8)];
 const adapter=create({readRows:()=>rows,readCurrentUserId:()=>owner,
   nowMs:()=>now,featureStartedAtMs:Object.hasOwn(opts,'start')?opts.start:BASE-2*DAY8});
 return {adapter,setTime:v=>now=v,setRows:v=>rows=v,setOwner:v=>owner=v};
}
test('same date runs remain separate and chosen one needs strict gachi confirmation',()=>{
 const f=fixture(),a=f.adapter;
 assert.deepEqual(a.list(),[
  {id:'11',activityDate:'2026-11-14',distanceKm:5},
  {id:'12',activityDate:'2026-11-14',distanceKm:8}
 ]);
 assert.equal(a.readContext(),null);
 assert.equal(a.choose('11').status,'gachi_confirmation_required');
 assert.equal(a.readContext(),null);
 assert.equal(a.confirmGachi('true').status,'blocked');
 assert.equal(a.readContext(),null);
 a.choose('11');assert.equal(a.confirmGachi(true).status,'selected_preview_only');
 assert.equal(a.readContext()?.row.id,11);
 assert.equal(a.choose('12').status,'gachi_confirmation_required');
 assert.equal(a.readContext(),null);
 assert.equal(a.confirmGachi(true).status,'selected_preview_only');
 assert.equal(a.readContext()?.row.id,12);
});
test('no feature start, wrong ownership, duplicate IDs, invalid rows fail closed',()=>{
 const noStart=fixture({start:null});assert.equal(noStart.adapter.choose(11).status,'blocked');
 const f=fixture();f.setOwner('8');assert.deepEqual(f.adapter.list(),[]);
 assert.equal(f.adapter.choose(11).status,'blocked');
 const d=fixture({rows:[row(11,5),row('11',8)]});
 assert.deepEqual(d.adapter.list(),[]);
 assert.equal(d.adapter.choose(11).status,'blocked');
});
test('8 day boundary is inclusive but +1ms invalid; expiry cannot be revived',()=>{
 const started=BASE-DAY8;
 const f=fixture({rows:[row(11,5,started)],start:BASE-DAY8-1000});
 assert.equal(f.adapter.choose(11).status,'gachi_confirmation_required');
 assert.equal(f.adapter.confirmGachi(true).status,'selected_preview_only');
 f.setTime(BASE+1);
 assert.equal(f.adapter.readContext(),null);
 f.setTime(BASE);
 assert.equal(f.adapter.readContext(),null);
 assert.equal(f.adapter.choose(11).status,'blocked');
});
test('clock rollback invalidates selection; no future start or late import revival',()=>{
 const f=fixture();f.adapter.choose(11);f.adapter.confirmGachi(true);
 f.setTime(BASE-1);assert.equal(f.adapter.readContext(),null);
 f.setTime(BASE);assert.equal(f.adapter.readContext(),null);
 const future=fixture({rows:[row(21,3,BASE+1)]});
 assert.equal(future.adapter.choose(21).status,'blocked');
});
test('delete, owner change and row mutations cannot be retained',()=>{
 const f=fixture();f.adapter.choose(11);f.adapter.confirmGachi(true);
 f.setRows([row(12,8)]);assert.equal(f.adapter.readContext(),null);
 assert.equal(f.adapter.confirmGachi(true).status,'blocked');
 const g=fixture();g.adapter.choose(11);g.adapter.confirmGachi(true);
 g.setRows([{...row(11,5),deleted_at:'2026-11-14T10:00:00Z'},row(12,8)]);
 assert.equal(g.adapter.readContext(),null);
 const h=fixture();h.adapter.choose(11);h.adapter.confirmGachi(true);
 h.setOwner('8');assert.equal(h.adapter.readContext(),null);
});
test('manual invalidation never restores confirmation',()=>{
 const f=fixture(),a=f.adapter;a.choose(11);a.confirmGachi(true);
 a.invalidate();assert.equal(a.readContext(),null);
 assert.equal(a.confirmGachi(true).status,'blocked');
});
test('not wired to public app, network, storage, FIT reading, or Supabase',()=>{
 const source=readFileSync(new URL('../src/rings-now-calendar-selection-adapter.mjs',import.meta.url),'utf8');
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\bfetch\s*\(|XMLHttpRequest|WebSocket|indexedDB|localStorage|sessionStorage|createClient|\.arrayBuffer\s*\(/);
 for(const text of [index,sw])assert.doesNotMatch(text,/rings-now-calendar-selection-adapter/);
 assert.match(index,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
});
