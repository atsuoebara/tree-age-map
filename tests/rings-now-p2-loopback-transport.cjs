'use strict';
// Future isolated test transport. NOT invoked by any workflow or production code.
// Node HTTP only: no redirects, proxies, DNS lookup or TLS. No request on import.
const http = require('node:http');
const assert = require('node:assert/strict');
const MAX_RESPONSE_BYTES = 65536;
const TIMEOUT_MS = 3000;
function createLoopbackTransport() {
  return async function request({ endpoint, method, authorization, body }) {
    assert.equal(method, 'POST');
    assert.equal(typeof authorization, 'string');
    assert.match(authorization, /^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    const url = new URL(endpoint);
    assert.equal(url.protocol, 'http:');
    assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
    assert.ok(url.port);
    assert.equal(url.username, '');
    assert.equal(url.password, '');
    assert.equal(url.search, '');
    assert.equal(url.hash, '');
    assert.ok(/^\/rpc\/rings_now_snapshot_candidate_v01\/?$/.test(url.pathname),
      'unexpected RPC path');
    assert.deepEqual(body, {});
    // Force direct loopback socket; URL hostname is never resolved.
    const host = url.hostname === '[::1]' ? '::1' : '127.0.0.1';
    return await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: host, port: Number(url.port), path: url.pathname,
        method: 'POST', agent: false, timeout: TIMEOUT_MS,
        headers: {
          authorization, 'content-type': 'application/json',
          accept: 'application/json', 'content-length': '2'
        }
      }, res => {
        let bytes = 0;
        res.on('data', chunk => {
          bytes += chunk.length;
          if (bytes > MAX_RESPONSE_BYTES) {
            req.destroy(new Error('response too large'));
            return;
          }
          // No redirect handling. 3xx status is passed through and rejected by caller.
        });
        res.on('end', () => resolve({status: res.statusCode}));
        res.on('error', reject);
      });
      req.on('timeout', () => req.destroy(new Error('HTTP timeout')));
      req.on('error', reject);
      req.end('{}');
    });
  };
}
module.exports = { createLoopbackTransport };
