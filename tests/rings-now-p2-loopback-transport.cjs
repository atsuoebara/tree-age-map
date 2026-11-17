'use strict';
// Future isolated test transport. NOT invoked by any workflow or production code.
// Node HTTP only: no redirects, proxies, DNS lookup or TLS. No request on import.
const http = require('node:http');
const assert = require('node:assert/strict');
const MAX_RESPONSE_BYTES = 1048576; // 1000 synthetic rows may exceed 64KiB.
const TIMEOUT_MS = 3000;
const ABSOLUTE_DEADLINE_MS = 5000;
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
      let deadline;
      const req = http.request({
        hostname: host, port: Number(url.port), path: url.pathname,
        method: 'POST', agent: false, timeout: TIMEOUT_MS,
        headers: {
          authorization, 'content-type': 'application/json',
          accept: 'application/json', 'content-length': '2'
        }
      }, res => {
        let bytes = 0;
        const chunks = [];
        res.on('data', chunk => {
          bytes += chunk.length;
          if (bytes > MAX_RESPONSE_BYTES) {
            req.destroy(new Error('response too large'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          const status = res.statusCode;
          // Never return the body for failures: PostgREST may include
          // diagnostic text. No redirect handling; the caller rejects 3xx.
          if (status !== 200) return resolve({status});
          const contentType = res.headers['content-type'] || '';
          if (!/^application\\/json(?:;|$)/i.test(contentType))
            return reject(new Error('unexpected HTTP success content type'));
          try {
            const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
              throw Error('unexpected RPC payload shape');
            resolve({status, body: parsed});
          } catch {
            reject(new Error('malformed JSON RPC response'));
          }
        });
        res.on('error', reject);
      });
      // Absolute wall-clock deadline, independent of socket activity or trickle responses.
      deadline = setTimeout(() => req.destroy(new Error('HTTP absolute deadline exceeded')), ABSOLUTE_DEADLINE_MS);
      deadline.unref?.();
      req.on('close', () => clearTimeout(deadline));
      req.on('timeout', () => req.destroy(new Error('HTTP timeout')));
      req.on('error', reject);
      req.end('{}');
    });
  };
}
// Strict, pure result validation, not evidence that HTTP or JWT was run.
// The caller must supply independently authenticated transport results.
function assertSnapshotRpcResult(response,{subject,expectedCount,blockedReason}={}) {
  assert.ok(response && response.status === 200,'RPC did not return HTTP 200');
  const payload=response.body;
  assert.ok(payload && typeof payload==='object' && !Array.isArray(payload),
    'RPC body missing');
  if(blockedReason){
    assert.ok(['too_many_rows','unauthenticated','missing_required_fields']
      .includes(blockedReason),'unsupported blocked reason');
    assert.equal(payload.status,'blocked');
    assert.equal(payload.reason,blockedReason);
    assert.ok(!Object.hasOwn(payload,'rows'),'blocked response leaked rows');
    return 'RPC_BLOCKED_RESULT_SHAPE_ONLY';
  }
  assert.match(subject||'',/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/);
  assert.ok(Number.isInteger(expectedCount)&&expectedCount>=0&&expectedCount<=1000);
  assert.equal(payload.status,'candidate_snapshot');
  assert.ok(Array.isArray(payload.rows),'rows must be an array');
  assert.equal(payload.rows.length,expectedCount,'wrong owner row count');
  const ids=new Set();
  for(const row of payload.rows){
    assert.ok(row && typeof row==='object' && !Array.isArray(row));
    assert.equal(row.user_id,subject,'foreign user row present');
    assert.ok(row.id!==null && (typeof row.id==='number'||typeof row.id==='string'));
    assert.ok(!ids.has(String(row.id)),'duplicate row id');
    ids.add(String(row.id));
    assert.ok(row.activity_date && row.started_at);
    assert.equal(typeof row.distance_km,'number');
    assert.ok(Number.isFinite(row.distance_km));
    assert.equal(row.deleted_at,null);
  }
  return 'RPC_RESPONSE_SHAPE_ONLY_NOT_JWT_PROOF';
}
module.exports = { createLoopbackTransport, assertSnapshotRpcResult };
