'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildScenarios}=require('./rings-now-p2-synthetic-scenarios.cjs');
const {verifyScenarioObservation}=require('./rings-now-p2-observation-verifier.cjs');
const cases=buildScenarios();
const get=id=>cases.find(c=>c.id===id);
const success=id=>{
  const s=get(id);
  const rows=s.rows.filter(r=>r.user_id===s.viewer&&r.deleted_at===null)
    .map(r=>({...r}));
  return {httpStatus:200,body:{status:'candidate_snapshot',rows}};
};
test('accept expected zero/1000/other-owner/deleted/6-digit synthetic observations',()=>{
  for(const id of ['zero','one_thousand','other_owner_invisible','deleted_excluded','six_digit_timestamp']){
    assert.equal(verifyScenarioObservation(get(id),success(id)).matched,true);
  }
});
test('accept exact blocked reason without any rows',()=>{
  for(const id of ['one_thousand_one','missing_started_at','too_many_precedes_null']){
    const s=get(id);
    assert.equal(verifyScenarioObservation(s,{httpStatus:200,
      body:{status:'blocked',reason:s.expect.reason}}).matched,true);
  }
});
test('reject wrong block priority and leaking rows',()=>{
  const s=get('too_many_precedes_null');
  assert.throws(()=>verifyScenarioObservation(s,{httpStatus:200,
    body:{status:'blocked',reason:'missing_required_fields'}}));
  assert.throws(()=>verifyScenarioObservation(s,{httpStatus:200,
    body:{status:'blocked',reason:'too_many_rows',rows:[]}}));
});
test('reject foreign owner, deleted, reordered or extra keys',()=>{
  const s=get('other_owner_invisible');
  const a=success(s.id);a.body.rows[0].user_id='22222222-2222-4222-8222-222222222222';
  assert.throws(()=>verifyScenarioObservation(s,a));
  const b=success(s.id);b.body.rows[0].deleted_at='2026-11-11T00:00:00Z';
  assert.throws(()=>verifyScenarioObservation(s,b));
  const c=success(s.id);c.body.rows.reverse();
  assert.throws(()=>verifyScenarioObservation(s,c));
  const d=success(s.id);d.body.rows[0].unexpected=true;
  assert.throws(()=>verifyScenarioObservation(s,d));
});
test('reject fabricated success, missing response and unsupported boundary evidence',()=>{
  assert.throws(()=>verifyScenarioObservation(get('one_thousand_one'),success('one_thousand')));
  assert.throws(()=>verifyScenarioObservation(get('zero'),null));
  assert.throws(()=>verifyScenarioObservation(get('exact_eight_day_boundary'),
    {httpStatus:200,body:{status:'candidate_snapshot',rows:[]}}));
});
test('anonymous HTTP denial accepted, but body must not expose rows',()=>{
  assert.equal(verifyScenarioObservation(get('no_auth'),{httpStatus:401,
    body:{message:'permission denied'}}).kind,'http_auth_rejected');
  assert.throws(()=>verifyScenarioObservation(get('no_auth'),{httpStatus:403,
    body:{rows:[]}}));
});
