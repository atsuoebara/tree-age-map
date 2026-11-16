'use strict';
// P2 isolated-stack configuration gate. Static only: no network, Docker,
// database, subprocess, or workflow execution. Never imports production settings.
const assert = require('node:assert/strict');
const IMAGE_KEYS = Object.freeze(['postgres', 'gotrue', 'postgrest']);
const SHA256_DIGEST = /^sha256:[a-f0-9]{64}$/;
const REF_DIGEST = /^([a-z0-9][a-z0-9._/-]*)(?:@sha256:[a-f0-9]{64})$/;
const FORBIDDEN_ENV = [
  'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY',
  'DATABASE_URL', 'PGHOST', 'PGPASSWORD', 'GOTRUE_JWT_SECRET',
  'POSTGREST_JWT_SECRET'
];
function inspectIsolatedManifest(manifest, env = {}) {
  const failures = [];
  const fail = (code) => failures.push(code);
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return {pass:false, failures:['invalid_manifest']};
  }
  if (manifest.schemaVersion !== 1) fail('unknown_manifest_schema');
  for (const key of IMAGE_KEYS) {
    const image = manifest.images?.[key];
    if (!image || typeof image.reference !== 'string' ||
        typeof image.digest !== 'string' ||
        !SHA256_DIGEST.test(image.digest) ||
        !REF_DIGEST.test(image.reference) ||
        !image.reference.endsWith('@' + image.digest)) {
      fail('image_unpinned_' + key);
    }
  }
  if (!/^[a-f0-9]{40}$/.test(manifest.checkoutCommit || ''))
    fail('checkout_commit_unpinned');
  if (manifest.authJwtCompatibility !== 'PROVEN_BY_ISOLATED_HTTP')
    fail('auth_http_not_proven');
  if (manifest.billingZeroAdditionalCost !== 'VERIFIED_FOR_THIS_RUN')
    fail('billing_not_verified');
  if (manifest.independentAudit !== 'APPROVED_FOR_EXACT_HEAD')
    fail('independent_audit_missing');
  if (manifest.explicitExecutionApproval !== true)
    fail('execution_approval_missing');
  if (manifest.productionAccess !== false)
    fail('production_access_not_denied');
  for (const key of FORBIDDEN_ENV) {
    if (Object.prototype.hasOwnProperty.call(env, key))
      fail('forbidden_env_' + key.toLowerCase());
  }
  return {pass:failures.length === 0, failures};
}
function inspectDisabledWorkflow(source) {
  assert.equal(typeof source, 'string');
  const failures = [];
  if (!/^on:\s*\n  workflow_dispatch:\s*$/m.test(source))
    failures.push('not_exact_manual_trigger');
  if (/^\s+(?:push|pull_request|schedule|workflow_call|repository_dispatch):/m.test(source))
    failures.push('automatic_trigger');
  if (!/^    if:\s*\$\{\{ false \}\}/m.test(source))
    failures.push('hard_stop_missing');
  if (/\$\{\{\s*secrets\./i.test(source))
    failures.push('secret_reference');
  if (!/^permissions:\s*\n  contents:\s*read\s*$/m.test(source))
    failures.push('permissions_mismatch');
  return {pass:failures.length === 0, failures};
}
module.exports = {inspectIsolatedManifest, inspectDisabledWorkflow};
