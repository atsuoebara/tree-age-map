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
// These are static declaration checks, NOT execution permission or evidence of
// actual Auth, billing, registry integrity or runtime isolation.
// Phase 1: before a separately approved isolated run, real HTTP proof is
// necessarily unavailable. Phase 2: after a run, require its evidence marker.
function inspectIsolatedManifest(manifest, env = {}, phase = 'preflight') {
  const failures = [];
  const fail = (code) => failures.push(code);
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return {pass:false, failures:['invalid_manifest']};
  }
  if (phase !== 'preflight' && phase !== 'postflight')
    fail('invalid_phase');
  if (manifest.schemaVersion !== 1) fail('unknown_manifest_schema');
  const expectedStatus = phase === 'postflight'
    ? 'EVIDENCE_RECORDED' : 'READY_FOR_REVIEW';
  if (manifest.status !== expectedStatus)
    fail('manifest_not_in_phase');
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
  if (phase === 'postflight' &&
      manifest.authJwtCompatibility !== 'PROVEN_BY_ISOLATED_HTTP')
    fail('auth_http_not_proven');
  if (phase === 'preflight' &&
      !['NOT_PROVEN', 'PROVEN_BY_ISOLATED_HTTP'].includes(manifest.authJwtCompatibility))
    fail('auth_http_status_invalid');
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
  return {pass:failures.length === 0, phase, failures};
}
function inspectP2Preflight(manifest, env = {}) {
  return inspectIsolatedManifest(manifest, env, 'preflight');
}
function inspectP2Postflight(manifest, env = {}) {
  return inspectIsolatedManifest(manifest, env, 'postflight');
}
function inspectDisabledWorkflow(source) {
  assert.equal(typeof source, 'string');
  const failures = [];
  if (!/^on:\s*\n  workflow_dispatch:\s*$/m.test(source))
    failures.push('not_exact_manual_trigger');
  if (/^\s+(?:push|pull_request|schedule|workflow_call|repository_dispatch):/m.test(source))
    failures.push('automatic_trigger');
  // A disabled job is insufficient when a second executable job can be added.
  // Restrict detection to the jobs mapping. Top-level permissions and
  // concurrency also have two-space keys and must not be counted as jobs.
  const jobsSection = source.match(/^jobs:\s*\n([\s\S]*)$/m);
  const jobNames = jobsSection
    ? [...jobsSection[1].matchAll(/^  ([A-Za-z][\w-]*):\s*$/gm)].map(m => m[1])
    : [];
  if (jobNames.length !== 1 || jobNames[0] !== 'isolated-p2')
    failures.push('unexpected_job_topology');
  if (!/^  isolated-p2:\s*\n    if:\s*\$\{\{ false \}\}/m.test(source))
    failures.push('hard_stop_missing');
  // The only dormant dependency allowed is this exact immutable checkout action.
  // Forbid all other actions, services, containers and dynamic ref selectors.
  const uses=[...source.matchAll(/^\s+uses:\s*([^\s#]+).*$/gm)].map(m=>m[1]);
  if(uses.length!==1||
     uses[0]!=='actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683'||
     /^\s*(?:services|container):/m.test(source))
    failures.push('active_dependency_not_allowed');
  if(!/^\s+ref:\s*\$\{\{ github\.sha \}\}\s*$/m.test(source)||
     !/^\s+persist-credentials:\s*false\s*$/m.test(source)||
     !/^\s+fetch-depth:\s*1\s*$/m.test(source)||
     !source.includes('test "$(git rev-parse HEAD)" = "$GITHUB_SHA"'))
    failures.push('checkout_sha_binding_missing');
  if(!/^\s+runs-on:\s*ubuntu-latest\s*$/m.test(source)||
     !/^\s+timeout-minutes:\s*10\s*$/m.test(source)||
     !/^concurrency:\s*\n  group:\s*rings-now-p2-isolated-manual\s*\n  cancel-in-progress:\s*false\s*$/m.test(source))
    failures.push('runner_budget_not_bounded');
  // The fail-fast shell option must belong to the ACTUAL CLI step,
  // not merely to an earlier validation step. Preserve the exact step name
  // and require strict mode immediately after the CLI step's run block.
  const cliMarker='      - name: Run one isolated probe; keep non-proven outcome red (dormant)';
  const cliSections=source.split(cliMarker);
  const cliStep=cliSections.length===2 ? cliSections[1] : '';
  if(cliSections.length!==2||
     !/^\s*shell: bash\s*\n\s*run: \|\s*\n\s*set -euo pipefail\s*\n/.test(cliStep)||
     !cliStep.includes('node tests/rings-now-p2-cli.cjs --isolated-once')||
     !source.includes('g.inspectP2Preflight(m,process.env)'))
    failures.push('cli_or_preflight_missing');
  if(/(?:upload-artifact|cache@|larger-runner|self-hosted|continue-on-error|\|\|\s*true|\$\{\{\s*secrets\.)/i.test(source))
    failures.push('unsafe_workflow_escape');
  if (/\$\{\{\s*secrets\./i.test(source))
    failures.push('secret_reference');
  if (!/^permissions:\s*\n  contents:\s*read\s*$/m.test(source))
    failures.push('permissions_mismatch');
  return {pass:failures.length === 0, failures};
}
module.exports = {inspectIsolatedManifest, inspectP2Preflight, inspectP2Postflight, inspectDisabledWorkflow};
