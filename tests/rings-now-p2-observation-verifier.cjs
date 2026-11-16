'use strict';
// Pure comparison of supplied P2 observations to synthetic expectations.
// Does not send HTTP, execute SQL, or establish observation provenance.
const assert = require('node:assert/strict');
const {OWNER_A, OWNER_B} = require('./rings-now-p2-synthetic-scenarios.cjs');
const REQUIRED = ['activity_date','deleted_at','distance_km','id','started_at','user_id'];
function verifyScenarioObservation(scenario, observation) {
  assert.ok(scenario && typeof scenario === 'object', 'scenario required');
  assert.ok(observation && typeof observation === 'object' && !Array.isArray(observation),
    'observation required');
  assert.ok(Number.isInteger(observation.httpStatus), 'HTTP status required');
  if (scenario.id === 'exact_eight_day_boundary') {
    assert.fail('boundary is NOT PROVEN by the snapshot RPC: use separate microsecond-precise gate');
  }
  if (scenario.id === 'no_auth' && [401,403].includes(observation.httpStatus)) {
    assert.equal(observation.body?.rows, undefined, 'rejected response exposed rows');
    return Object.freeze({caseId:scenario.id, matched:true, kind:'http_auth_rejected'});
  }
  assert.equal(observation.httpStatus,200,'unexpected HTTP status');
  const result = observation.body;
  assert.ok(result && typeof result === 'object' && !Array.isArray(result),
    'JSON object body required');
  if (scenario.expect.status === 'blocked') {
    assert.deepEqual(Object.keys(result).sort(), ['reason','status']);
    assert.equal(result.status,'blocked');
    assert.equal(result.reason,scenario.expect.reason);
    return Object.freeze({caseId:scenario.id,matched:true,kind:'rpc_blocked'});
  }
  assert.equal(result.status,'candidate_snapshot');
  assert.deepEqual(Object.keys(result).sort(), ['rows','status']);
  assert.ok(Array.isArray(result.rows), 'rows must be array');
  assert.equal(result.rows.length,scenario.expect.rowCount);
  const expected = scenario.rows.filter(row=>
    row.user_id===scenario.viewer && row.deleted_at===null);
  assert.equal(expected.length,scenario.expect.rowCount,'fixture inconsistent');
  const expectedIds=expected.map(row=>row.id).sort((a,b)=>a-b);
  const seenIds=[];
  for (const row of result.rows) {
    assert.ok(row && typeof row==='object' && !Array.isArray(row),'row must be object');
    assert.deepEqual(Object.keys(row).sort(),REQUIRED);
    assert.equal(row.user_id,scenario.viewer,'cross-owner exposure');
    assert.equal(row.deleted_at,null,'deleted row exposure');
    assert.ok(Number.isSafeInteger(row.id),'integer ID required');
    assert.ok(Number.isFinite(row.distance_km),'finite distance required');
    assert.equal(typeof row.activity_date,'string');
    assert.equal(typeof row.started_at,'string');
    seenIds.push(row.id);
  }
  assert.deepEqual(seenIds,expectedIds,'unexpected IDs or ordering');
  return Object.freeze({caseId:scenario.id,matched:true,kind:'rpc_snapshot'});
}
module.exports={verifyScenarioObservation};
