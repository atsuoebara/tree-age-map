'use strict';
// Pure P2 Auth/PostgREST response assertions. No I/O, network, DB or process calls.
// Only synthetic test inputs may be supplied. Not a runnable P2 test by itself.
const assert = require('node:assert/strict');

function parseJwtPayload(token) {
  assert.equal(typeof token, 'string', 'JWT must be a string');
  const parts = token.split('.');
  assert.equal(parts.length, 3, 'JWT must have three segments');
  assert.match(parts[1], /^[A-Za-z0-9_-]+$/, 'JWT payload must be base64url');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  assert.ok(payload && typeof payload === 'object' && !Array.isArray(payload));
  return payload;
}
function assertJwtClaims(token, expected) {
  const claims = parseJwtPayload(token);
  assert.equal(claims.sub, expected.sub, 'JWT sub mismatch');
  assert.equal(claims.role, expected.role, 'JWT role mismatch');
  assert.equal(claims.aud, expected.aud, 'JWT aud mismatch');
  assert.ok(Number.isInteger(claims.exp), 'JWT exp must be integer epoch seconds');
  assert.ok(claims.exp > 0, 'JWT exp must be positive');
  // Parsing claims is NOT signature verification. The real PostgREST server must verify JWT.
  return claims;
}
function assertNoOtherOwnerRows(result, ownerId) {
  assert.equal(result && result.status, 'candidate_snapshot', 'snapshot not successful');
  assert.ok(Array.isArray(result.rows), 'snapshot rows must be an array');
  assert.ok(result.rows.length <= 1000, 'snapshot exceeds 1000');
  const required = ['id', 'user_id', 'activity_date', 'distance_km', 'started_at', 'deleted_at'];
  for (const row of result.rows) {
    assert.deepEqual(Object.keys(row).sort(), [...required].sort(), 'snapshot row keys differ');
    assert.equal(row.user_id, ownerId, 'cross-owner row exposed');
    for (const field of ['id', 'user_id', 'activity_date', 'distance_km', 'started_at']) {
      assert.notEqual(row[field], null, 'required field is null: ' + field);
    }
    assert.equal(row.deleted_at, null, 'deleted row exposed');
  }
}
function assertBlocked(result, reason) {
  assert.equal(result && result.status, 'blocked', 'expected blocked response');
  assert.equal(result.reason, reason, 'unexpected block reason');
  assert.ok(!('rows' in result), 'blocked response must not include rows');
}
function assertHttpRejected(response) {
  assert.ok(response && Number.isInteger(response.status), 'HTTP status missing');
  assert.ok(response.status === 401 || response.status === 403, 'expected HTTP auth rejection');
}
function assertExpired(claims, nowSeconds) {
  assert.ok(Number.isInteger(nowSeconds), 'clock must be integer epoch seconds');
  assert.ok(claims.exp <= nowSeconds, 'JWT is not expired');
  // This alone cannot prove the server rejected the token: assertHttpRejected must also pass.
}
// Atomic assertion for the future runner: neither expiry nor server rejection alone passes.
// Runner must supply the exact token used for the HTTP request and the real response;
// this pure helper cannot itself prove that provenance or cryptographic signature.
function assertExpiredTokenRejected(observation) {
  assert.ok(observation && typeof observation === 'object' && !Array.isArray(observation),
    'expiry observation missing');
  assert.ok(Object.hasOwn(observation, 'token'), 'request token missing');
  assert.ok(Object.hasOwn(observation, 'response'), 'server response missing');
  assert.ok(Object.hasOwn(observation, 'nowSeconds'), 'observation time missing');
  const claims = parseJwtPayload(observation.token);
  assert.ok(Number.isInteger(claims.exp) && claims.exp > 0, 'JWT exp invalid');
  assertExpired(claims, observation.nowSeconds);
  assertHttpRejected(observation.response);
  return true;
}
module.exports = {
  parseJwtPayload, assertJwtClaims, assertNoOtherOwnerRows,
  assertBlocked, assertHttpRejected, assertExpired, assertExpiredTokenRejected
};
