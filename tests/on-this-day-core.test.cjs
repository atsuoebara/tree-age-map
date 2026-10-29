const assert=require('node:assert/strict');
const core=require('../on-this-day-core.js');
assert.equal(core.lastYearDay('2026-10-29'),'2025-10-29');
assert.equal(core.lastYearDay('2024-02-29'),'2023-02-28');
assert.equal(core.lastYearDay('2026-02-28'),'2025-02-28');
assert.equal(core.lastYearDay('bad'),null);
assert.equal(core.parseDay('2026-02-30'),null);
const data=[
 {activity_date:'2025-10-29',distance_km:5},
 {activity_date:'2025-10-29',distance_km:12.5},
 {activity_date:'2026-10-29',distance_km:7},
 {activity_date:'2025-10-30',distance_km:100},
 {activity_date:'2025-10-29',distance_km:-4}
];
const x=core.compare(data,'2026-10-29');
assert.equal(x.lastYear.count,3);
assert.equal(x.lastYear.distanceKm,17.5);
assert.equal(x.today.count,1);
assert.equal(x.today.distanceKm,7);
assert.equal(core.summarize([], '2025-10-29').count,0);
assert.equal(core.dateOf({activity_date:'2025-10-29T23:58:00+09:00'}),'2025-10-29');
console.log('A-3 On This Day core: PASS');
