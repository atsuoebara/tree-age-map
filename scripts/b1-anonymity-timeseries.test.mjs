import assert from 'node:assert/strict';
// B-1 synthetic-only multi-year, time-series attack illustrations.
// Distinguish existing all-time, start-country totals from hypothetical consented annual B-1 data.
const round=(n,step)=>Math.round(n/step)*step;
const events=[
 {time:1,year:2025,user:'a',km:40,start:'JP',eligible:true},
 {time:2,year:2025,user:'b',km:60,start:'JP',eligible:true},
 {time:3,year:2026,user:'a',km:50,start:'JP',eligible:true},
 {time:4,year:2026,user:'b',km:60,start:'JP',eligible:true},
 {time:5,year:2026,user:'c',km:30,start:'JP',eligible:false},
];
const sum=a=>a.reduce((v,r)=>v+r.km,0);
const allTimeAt=t=>sum(events.filter(r=>r.time<=t&&r.start==='JP'));
const annual=(year)=>round(sum(events.filter(r=>r.year===year&&r.eligible)),10);
assert.equal(annual(2025),100);
assert.equal(annual(2026),110);
// Repeated public observations can disclose a newly imported run if its change is isolated.
const observedDelta=allTimeAt(3)-allTimeAt(2);
assert.equal(observedDelta,50);
console.log('FINDING time series: isolated new activity exposes 50km increment (not necessarily identity).');
// With external knowledge of stable other contributor, annual differences isolate a user's change.
const other2025=60,other2026=60;
assert.equal((annual(2026)-other2026)-(annual(2025)-other2025),10);
console.log('FINDING multiple years: known other-year contributions expose +10km change.');
// An ineligible new run changes existing all-time public total, not B-1.
assert.equal(allTimeAt(5)-allTimeAt(4),30);
assert.equal(annual(2026),110);
// Without an explicit overlap assumption, all-time total cannot be equated to the annual consented sum.
assert.notEqual(allTimeAt(5),annual(2026));
// In actual service, caching and intervening updates may obscure timings; this is a worst-case attack illustration.
console.log('LIMITS: synthetic example only; no live timing, real-world user identification, cache, DB concurrency or release safety verified.');
