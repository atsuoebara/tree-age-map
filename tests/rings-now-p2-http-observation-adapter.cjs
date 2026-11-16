'use strict';
// Dependency-injected HTTP observation for a future isolated P2 runner.
// No fetch import, network endpoint, credentials, env reads, or execution on import.
// The caller must supply a pre-audited local-only transport and real server provenance.
const assert = require('node:assert/strict');
const { assertExpiredTokenRejected } = require('./rings-now-p2-auth-http-assertions.cjs');

async function observeExpiredTokenRejection({ token, nowSeconds, request, endpoint }) {
  assert.equal(typeof token, 'string', 'token missing');
  assert.ok(token.length > 0, 'empty token');
  assert.ok(Number.isInteger(nowSeconds), 'observation time must be integer seconds');
  assert.equal(typeof request, 'function', 'audited transport required');
  assert.equal(typeof endpoint, 'string', 'endpoint required');
  let url;
  try { url = new URL(endpoint); } catch { assert.fail('invalid endpoint URL'); }
  assert.equal(url.protocol, 'http:', 'only isolated HTTP endpoint permitted');
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'endpoint must be loopback');
  assert.equal(url.username, '', 'URL credentials forbidden');
  assert.equal(url.password, '', 'URL credentials forbidden');
  assert.equal(url.search, '', 'URL query forbidden');
  assert.equal(url.hash, '', 'URL fragment forbidden');
  assert.ok(url.port, 'explicit isolated port required');
  // request must send exactly this token; adapter cannot independently prove transport behavior.
  const response = await request(Object.freeze({
    endpoint: url.href,
    method: 'POST',
    authorization: 'Bearer ' + token,
    body: Object.freeze({})
  }));
  assertExpiredTokenRejected({ token, nowSeconds, response });
  return Object.freeze({ verified: true, httpStatus: response.status });
}
module.exports = { observeExpiredTokenRejection };
