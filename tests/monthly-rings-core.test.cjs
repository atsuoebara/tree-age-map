/* Run with: node tests/monthly-rings-core.test.cjs */
const assert = require('node:assert/strict');
const {monthSummary,compare,shiftMonth,series,toRoute} = require('../monthly-rings-core.js');
const run = (date,distance,latlngs=[]) => ({date,distance,latlngs});
const activities = [
  run('2026-10-02T10:00:00',5,[[36.4,139.1],[36.41,139.11]]),
  run('2026-10-14T12:00:00',10),
  run('2026-09-03T10:00:00',8,[[36.5,139.0],[36.5,139.1]]),
  run('2025-10-08T10:00:00',7),
  run('invalid',123)
];
assert.equal(shiftMonth('2026-01',-1),'2025-12');
assert.equal(shiftMonth('2026-10',-12),'2025-10');
assert.throws(()=>shiftMonth('2026-13',1),/YYYY-MM/);
assert.equal(monthSummary(activities,'2026-10').runCount,2);
assert.equal(monthSummary(activities,'2026-10').distanceKm,15);
assert.equal(monthSummary(activities,'2026-10').withGpsCount,1);
assert.equal(monthSummary(activities,'2026-11').runCount,0);
assert.equal(monthSummary(activities,'2026-11').distanceKm,0);
const comparison = compare(activities,'2026-10');
assert.deepEqual(comparison.previousDelta,{runs:1,km:7});
assert.deepEqual(comparison.priorYearDelta,{runs:1,km:8});
assert.equal(series(activities,'2026-10')[0].routes.length,1);
assert.deepEqual(toRoute({latlngs:[{lat:36,lng:139},{lat:36.1,lng:139.1},[NaN,0]]}),[[36,139],[36.1,139.1]]);
activities.push(run('2025-10-20T10:00:00',3));
assert.equal(compare(activities,'2026-10').priorYear.distanceKm,10); // later import reflected
console.log('Monthly Rings A-1 data-core tests: PASS');
