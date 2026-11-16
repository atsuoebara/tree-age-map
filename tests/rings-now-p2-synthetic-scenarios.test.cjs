'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {OWNER_A,OWNER_B,START,END_8D,makeRows,buildScenarios} =
  require('./rings-now-p2-synthetic-scenarios.cjs');
test('ten deterministic synthetic scenarios with unique IDs',()=>{
  const scenarios=buildScenarios();
  assert.equal(scenarios.length,10);
  assert.equal(new Set(scenarios.map(s=>s.id)).size,10);
  assert.equal(scenarios.find(s=>s.id==='one_thousand').rows.length,1000);
  assert.equal(scenarios.find(s=>s.id==='one_thousand_one').rows.length,1001);
});
test('cross-owner scenario keeps synthetic owners separate',()=>{
  const c=buildScenarios().find(s=>s.id==='other_owner_invisible');
  assert.equal(c.rows.filter(r=>r.user_id===OWNER_A).length,2);
  assert.equal(c.rows.filter(r=>r.user_id===OWNER_B).length,3);
  assert.equal(c.expect.rowCount,2);
});
test('NULL and too_many_rows precedence expectations are explicit',()=>{
  const cases=buildScenarios();
  assert.equal(cases.find(c=>c.id==='missing_started_at').expect.reason,'missing_required_fields');
  const many=cases.find(c=>c.id==='too_many_precedes_null');
  assert.equal(many.rows.length,1001);
  assert.equal(many.rows.filter(r=>r.started_at===null).length,1);
  assert.equal(many.expect.reason,'too_many_rows');
});
test('deleted rows and timestamp precision encoded in source data',()=>{
  const cases=buildScenarios();
  assert.equal(cases.find(c=>c.id==='deleted_excluded').rows.filter(r=>r.deleted_at===null).length,2);
  assert.match(START,/\.\d{6}\+00:00$/);
  assert.match(END_8D,/\.\d{6}\+00:00$/);
  assert.equal((Date.parse(END_8D)-Date.parse(START))/1000,691200);
});
test('reject non-synthetic identities and unbounded sizes',()=>{
  assert.throws(()=>makeRows('33333333-3333-4333-8333-333333333333',1));
  assert.throws(()=>makeRows(OWNER_A,1002));
  assert.throws(()=>makeRows(OWNER_B,-1));
});
