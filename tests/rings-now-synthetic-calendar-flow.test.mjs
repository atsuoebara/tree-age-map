import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeSyntheticCalendarFlow,MAX_AGE_SECONDS} from '../src/rings-now-synthetic-calendar-flow.mjs';
const base=Date.parse('2026-11-14T09:00:00Z');
const rows=[
 {id:'demo-morning',date:'2026-11-14',distanceKm:5,startedAt:'2026-11-14T09:00:00Z',splits:[300,310,320,330,340]},
 {id:'demo-evening',date:'2026-11-14',distanceKm:8,startedAt:'2026-11-14T09:30:00Z',splits:[345,346,347,348,349,350,351,352]}
];
test('same calendar day has two distinct runs with preserved date and distance',()=>{
 const flow=makeSyntheticCalendarFlow(rows,{nowMs:()=>base+3600000});
 assert.equal(flow.rows().length,2);
 assert.equal(flow.select('demo-morning').status,'gachi_confirmation_required');
 assert.equal(flow.confirmGachi(true).splits.length,5);
 const other=flow.select('demo-evening');
 assert.equal(other.status,'gachi_confirmation_required');
 assert.equal(other.row.distanceKm,8);
 assert.equal(flow.confirmGachi(true).splits.length,8);
});
test('gachi confirmation is required per selection and is cleared on switch',()=>{
 const flow=makeSyntheticCalendarFlow(rows,{nowMs:()=>base+3600000});
 assert.equal(flow.select('demo-morning').status,'gachi_confirmation_required');
 assert.equal(flow.confirmGachi('true').status,'gachi_confirmation_required');
 assert.equal(flow.confirmGachi(true).status,'synthetic_preview_only');
 assert.equal(flow.select('demo-evening').status,'gachi_confirmation_required');
 assert.equal(flow.clear().status,'not_selected');
});
test('8-day boundary allowed; one millisecond later expired and not restored by clock',()=>{
 let current=base+MAX_AGE_SECONDS*1000;
 const flow=makeSyntheticCalendarFlow(rows,{nowMs:()=>current});
 flow.select('demo-morning');assert.equal(flow.confirmGachi(true).status,'synthetic_preview_only');
 current++;
 assert.equal(flow.snapshot().status,'expired');
 current=base+1000;
 assert.equal(flow.snapshot().status,'not_selected');
});
test('future and invalid timestamps fail closed',()=>{
 let now=base-1;const f=makeSyntheticCalendarFlow(rows,{nowMs:()=>now});
 assert.equal(f.select('demo-morning').status,'expired');
 assert.throws(()=>makeSyntheticCalendarFlow([{...rows[0],id:'live-account'}],{nowMs:()=>base}));
 assert.throws(()=>makeSyntheticCalendarFlow([...rows,rows[0]],{nowMs:()=>base}));
});
test('results never grant real FIT, production, or external verification',()=>{
 const flow=makeSyntheticCalendarFlow(rows,{nowMs:()=>base+3600000});
 flow.select('demo-morning');const r=flow.confirmGachi(true);
 assert.equal(r.realFitAllowed,false);assert.equal(r.productionAllowed,false);
 assert.equal(r.analysisAllowed,false);
});
test('isolated preview is not imported in index or service worker',()=>{
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 const src=readFileSync(new URL('../src/rings-now-synthetic-calendar-flow.mjs',import.meta.url),'utf8');
 assert.match(index,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
 assert.doesNotMatch(index,/rings-now-synthetic-calendar-flow/);
 assert.doesNotMatch(sw,/rings-now-synthetic-calendar-flow/);
 for(const re of [/\bfetch\s*\(/,/\bXMLHttpRequest\b/,/\bWebSocket\b/,/\blocalStorage\b/,/\bindexedDB\b/])assert.doesNotMatch(src,re);
});
