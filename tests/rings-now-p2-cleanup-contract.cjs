'use strict';
// Rings Now P2: pure orchestration contract for a FUTURE isolated test runner.
// No network/process/DB operations, imports, env reads or work on module load.
// Functions are injected by a separately audited caller; this file proves no
// actual resources were removed and cannot handle hard process termination.
const assert = require('node:assert/strict');
const VERDICTS = new Set(['PASS','FAIL','NOT_PROVEN']);

async function runWithVerifiedCleanup({execute, cleanup, verifyCleanup}) {
  assert.equal(typeof execute, 'function', 'execute function required');
  assert.equal(typeof cleanup, 'function', 'cleanup function required');
  assert.equal(typeof verifyCleanup, 'function', 'verifyCleanup function required');

  let execution = 'NOT_PROVEN';
  let cleanupAttempted = false;
  let cleanupResult = 'NOT_PROVEN';
  let cleanupVerified = false;
  let executionError = false;
  let cleanupError = false;

  try {
    const observation = await execute();
    if (observation && VERDICTS.has(observation.status))
      execution = observation.status;
  } catch {
    executionError = true;
    execution = 'FAIL';
  } finally {
    // Both cleanup and verification must be attempted even when execute fails.
    cleanupAttempted = true;
    try {
      const outcome = await cleanup();
      cleanupResult = outcome && outcome.status === 'CLEAN'
        ? 'CLEAN' : 'NOT_PROVEN';
    } catch {
      cleanupError = true;
      cleanupResult = 'FAIL';
    }
    try {
      const check = await verifyCleanup();
      cleanupVerified = !!(check && check.verified === true);
    } catch {
      cleanupVerified = false;
    }
  }

  const status = execution === 'FAIL' || cleanupResult === 'FAIL' || cleanupError
    ? 'FAIL'
    : execution === 'PASS' && cleanupResult === 'CLEAN' && cleanupVerified
      ? 'PASS'
      : 'NOT_PROVEN';
  return Object.freeze({
    status, execution, cleanupAttempted, cleanupResult, cleanupVerified,
    executionError, cleanupError
  });
}
module.exports = {runWithVerifiedCleanup};
