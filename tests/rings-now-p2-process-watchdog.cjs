'use strict';
// OFFLINE ONLY, NOT WIRED TO ACTIONS OR P2. Kills a dedicated child process group.
// No process is spawned when imported. Linux standard runner only.
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const MAX_STAGE_MS = 540000; // reserve >=60 seconds of the 10-minute job for runner teardown
const MAX_GRACE_MS = 5000;

function runBoundedChild({ script, args = [], timeoutMs, graceMs = 200, env = {}, spawnImpl = spawn }) {
  assert.equal(process.platform, 'linux', 'Linux-only process group semantics');
  assert.equal(typeof script, 'string');
  assert.ok(script.startsWith('/') && script.endsWith('.cjs'), 'absolute .cjs script required');
  assert.ok(Array.isArray(args) && args.every(a => typeof a === 'string'), 'string args only');
  assert.ok(Number.isSafeInteger(timeoutMs) && timeoutMs >= 1 && timeoutMs <= MAX_STAGE_MS);
  assert.ok(Number.isSafeInteger(graceMs) && graceMs >= 1 && graceMs <= MAX_GRACE_MS);
  assert.ok(env !== null && typeof env === 'object' && !Array.isArray(env));
  assert.equal(typeof spawnImpl, 'function', 'spawn implementation required');
  // Explicit env: do not inherit production secrets, access tokens or proxies.
  const child = spawnImpl(process.execPath, [script, ...args], {
    detached: true, shell: false, stdio: ['ignore','ignore','ignore'], env,
  });
  let timedOut = false;
  let termSent = false;
  let killSent = false;
  let timer;
  let escalation;
  let errorFallback;
  let spawnError = null;
  let settled = false;
  let closed = false;
  let closeCode = null;
  let closeSignal = null;
  const finish = (resolve, missingCloseFallback = false) => {
    if (!closed && !missingCloseFallback) return;
    if (timedOut && !killPhaseDone && !missingCloseFallback) return;
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    clearTimeout(escalation);
    clearTimeout(errorFallback);
    resolve(Object.freeze({
      status: !timedOut && !spawnError && closeCode === 0 ? 'PASS' : 'FAIL',
      timedOut, termSent, killSent, exitCode:closeCode, exitSignal:closeSignal,
      spawnError, childClosed:closed, groupTerminationVerified:false,
    }));
  };
  let killPhaseDone = false;
  const sendGroup = signal => {
    if (!child.pid) return false;
    try { process.kill(-child.pid, signal); return true; }
    catch (e) { if (e.code === 'ESRCH') return false; throw e; }
  };
  return new Promise(resolve => {
    // Attach both handlers to avoid unhandled errors on failed spawn.
    child.on('error', err => {
      spawnError = err?.code || 'SPAWN_ERROR';
      // Normally Node emits 'close' after 'error'. A defensive fallback
      // settles FAIL if that contract is violated. Do not claim child closed.
      if (settled || errorFallback) return;
      errorFallback = setTimeout(() => {
        try { killSent = sendGroup('SIGKILL') || killSent; }
        catch { /* signal delivery unproven; result is still FAIL */ }
        finish(resolve, true);
      }, graceMs);
    });
    child.on('close', (code, signal) => {
      closed = true; closeCode = code; closeSignal = signal;
      finish(resolve);
    });
    timer = setTimeout(() => {
      if (closed || settled) return;
      timedOut = true;
      try { termSent = sendGroup('SIGTERM'); }
      catch { /* escalation still attempted; no false PASS */ }
      escalation = setTimeout(() => {
        // Important: child close may precede this callback; do not cancel it.
        // TERM does not prove grandchildren stopped.
        try { killSent = sendGroup('SIGKILL'); }
        catch { /* result remains FAIL */ }
        killPhaseDone = true;
        // A missing 'close' must not leave an unbounded pending Promise.
        // Close has NOT been established, so report childClosed=false.
        finish(resolve, true);
      }, graceMs);
    }, timeoutMs);
  });
}
module.exports = { runBoundedChild, MAX_STAGE_MS, MAX_GRACE_MS };
