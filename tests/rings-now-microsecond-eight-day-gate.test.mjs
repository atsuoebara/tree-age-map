import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewSelectedCalendarRun as review} from '../src/ima-wo-shirou-calendar-selection-review.mjs';
import {assessImaWoShirouEligibility as assess,EIGHT_DAYS_SECONDS} from '../src/ima-wo-shirou-eight-day-eligibility.mjs';
const start='2026-11-15T08:01:02.123456+09:00';
const floor=Date.parse(start),window=691200000;
const row={id:10,user_id:'user-a',activity_date:'2026-11-15',
 distance_km:5,started_at:start,deleted_at:null};
const call=(nowMs,changes={})=>review({row,currentUserId:'user-a',
 selectedAsGachiRun:true,featureStartedAtMs:floor-1,nowMs,...changes});
test('fractional 6-digit start: millisecond clock immediately before start is future',()=>{
 assert.equal(call(floor).reason,'future_activity_not_eligible');
 assert.equal(call(floor+1).status,'eligible_window_only');
});
test('fractional 6-digit start: final representable ms is valid; next ms expires',()=>{
 assert.equal(call(floor+window).status,'eligible_window_only');
 assert.equal(call(floor+window+1).reason,'eight_day_window_expired');
 assert.equal(call(floor+window+5).reason,'eight_day_window_expired');
});
test('exact ms start preserves inclusive boundary and +1 ms expiration',()=>{
 const exact='2026-11-15T08:01:02.123000+09:00';
 const exactRow={...row,started_at:exact};
 assert.equal(call(floor+window,{row:exactRow}).status,'eligible_window_only');
 assert.equal(call(floor+window+1,{row:exactRow}).reason,'eight_day_window_expired');
});
test('various microsecond fractions and UTC offsets preserve precision',()=>{
 for(const source of [
  '2026-11-15T00:00:00.000001Z',
  '2026-11-15T00:00:00.001999Z',
  '2026-11-15T08:01:02.999999+09:00',
  '2026-11-15T08:01:02.1+09:00',
  '2026-11-15T08:01:02+09:00'
 ]){
  const ms=Date.parse(source);
  const r={...row,started_at:source};
  assert.equal(call(ms+window,{row:r,featureStartedAtMs:ms-1}).status,'eligible_window_only',source);
  assert.equal(call(ms+window+1,{row:r,featureStartedAtMs:ms-1}).reason,'eight_day_window_expired',source);
 }
});
test('rollout remains explicit; fractional starts before rollout block',()=>{
 assert.equal(call(floor+1,{featureStartedAtMs:floor+1}).reason,'pre_feature_activity_not_eligible');
 assert.equal(call(floor+1,{featureStartedAtMs:null}).reason,'timestamp_missing_or_invalid');
 assert.equal(call(floor+1,{selectedAsGachiRun:false}).reason,'user_selection_required');
});
test('malformed exact start arguments cannot bypass ms clock gate',()=>{
 const base={selectedAsGachiRun:true,startedAtMs:floor,nowMs:floor+1,
 featureStartedAtMs:floor-1,maxAgeSeconds:EIGHT_DAYS_SECONDS};
 for(const startedAtMicros of [null,1,BigInt(floor+1)*1000n,-1n,'x'])
  assert.equal(assess({...base,startedAtMicros}).reason,'timestamp_missing_or_invalid');
 assert.equal(assess({...base,startedAtMicros:BigInt(floor)*1000n+456n}).eligible,true);
 assert.equal(assess({...base,maxAgeSeconds:691199,startedAtMicros:BigInt(floor)*1000n+456n}).eligible,false);
});
test('No real data connection, runtime fetch or release switch',()=>{
 const time=readFileSync(new URL('../src/ima-wo-shirou-calendar-selection-review.mjs',import.meta.url),'utf8');
 const gate=readFileSync(new URL('../src/ima-wo-shirou-eight-day-eligibility.mjs',import.meta.url),'utf8');
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 for(const code of [time,gate])assert.doesNotMatch(code,/\bfetch\s*\(|XMLHttpRequest|createClient|localStorage|indexedDB|sessionStorage/);
 assert.match(index,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
 assert.doesNotMatch(index,/startedAtMicros/);
 assert.doesNotMatch(sw,/startedAtMicros/);
});
