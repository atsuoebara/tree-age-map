'use strict';
// Isolated P2 synthetic scenarios ONLY. Pure data; no DB, I/O or network.
// This does not execute candidate SQL or prove RLS/PostgREST behavior.
const assert = require('node:assert/strict');
const OWNER_A = '11111111-1111-4111-8111-111111111111';
const OWNER_B = '22222222-2222-4222-8222-222222222222';
const START = '2026-11-10T00:00:00.123456+00:00';
const END_8D = '2026-11-18T00:00:00.123456+00:00';
function makeRows(owner, count, { startId = 1, startedAt = START } = {}) {
  assert.ok([OWNER_A, OWNER_B].includes(owner), 'synthetic owner only');
  assert.ok(Number.isInteger(count) && count >= 0 && count <= 1001, 'bounded row count');
  assert.ok(Number.isSafeInteger(startId) && startId > 0);
  return Array.from({length:count}, (_, i) => Object.freeze({
    id: startId+i,
    user_id: owner,
    activity_date: '2026-11-10',
    distance_km: 5,
    started_at: startedAt,
    deleted_at: null
  }));
}
function buildScenarios() {
  const base = makeRows(OWNER_A, 2);
  const foreign = makeRows(OWNER_B, 3, {startId:2000});
  const cases = [
    {id:'zero', rows:[], viewer:OWNER_A, expect:{status:'candidate_snapshot', rowCount:0}},
    {id:'one_thousand', rows:makeRows(OWNER_A,1000), viewer:OWNER_A,
      expect:{status:'candidate_snapshot',rowCount:1000}},
    {id:'one_thousand_one', rows:makeRows(OWNER_A,1001), viewer:OWNER_A,
      expect:{status:'blocked',reason:'too_many_rows'}},
    {id:'missing_started_at', rows:[...base,{...makeRows(OWNER_A,1,{startId:3})[0],started_at:null}],
      viewer:OWNER_A,expect:{status:'blocked',reason:'missing_required_fields'}},
    {id:'too_many_precedes_null', rows:[
      ...makeRows(OWNER_A,1000),
      {...makeRows(OWNER_A,1,{startId:1001})[0],started_at:null}],
      viewer:OWNER_A,expect:{status:'blocked',reason:'too_many_rows'}},
    {id:'other_owner_invisible',rows:[...base,...foreign],viewer:OWNER_A,
      expect:{status:'candidate_snapshot',rowCount:2}},
    {id:'deleted_excluded',rows:[...base,
      {...makeRows(OWNER_A,1,{startId:3})[0],deleted_at:'2026-11-11T00:00:00+00:00'}],
      viewer:OWNER_A,expect:{status:'candidate_snapshot',rowCount:2}},
    {id:'six_digit_timestamp',rows:makeRows(OWNER_A,1,{startedAt:START}),viewer:OWNER_A,
      expect:{status:'candidate_snapshot',rowCount:1}},
    {id:'exact_eight_day_boundary', rows:makeRows(OWNER_A,1,{startedAt:START}),
      viewer:OWNER_A,now:END_8D,expect:{expiryBoundary:'exact_691200_seconds'}},
    {id:'no_auth',rows:base,viewer:null,expect:{status:'blocked',reason:'unauthenticated'}}
  ];
  return Object.freeze(cases.map(c=>Object.freeze({
    ...c,
    rows:Object.freeze(c.rows.map(r=>Object.freeze(r))),
    expect:Object.freeze(c.expect)
  })));
}
module.exports={OWNER_A,OWNER_B,START,END_8D,makeRows,buildScenarios};
