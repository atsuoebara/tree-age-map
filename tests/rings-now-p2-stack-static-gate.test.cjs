'use strict';
// Offline-only contract tests. Do not run P2 or dispatch Actions.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {inspectIsolatedManifest, inspectDisabledWorkflow} =
  require('./rings-now-p2-stack-static-gate.cjs');
const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(
  path.join(root, 'tests/rings-now-p2-isolated-manifest.json'), 'utf8'));
const workflow = fs.readFileSync(path.join(
  root,'.github/workflows/rings-now-p2-isolated-manual.yml'),'utf8');
test('real checked-in manifest remains BLOCKED', () => {
  const result = inspectIsolatedManifest(manifest, {});
  assert.equal(result.pass, false);
  assert.ok(result.failures.includes('billing_not_verified'));
  assert.ok(result.failures.includes('execution_approval_missing'));
  for (const key of ['postgres','gotrue','postgrest'])
    assert.ok(result.failures.includes('image_unpinned_' + key));
});
test('workflow remains manual and hard stopped', () => {
  assert.deepEqual(inspectDisabledWorkflow(workflow), {pass:true,failures:[]});
  assert.ok(inspectDisabledWorkflow(workflow.replace(
    'if: ${{ false }}', 'if: ${{ true }}')).failures.includes('hard_stop_missing'));
  assert.ok(inspectDisabledWorkflow(workflow.replace(
    '  workflow_dispatch:', '  push:')).failures.includes('not_exact_manual_trigger'));
  const extraJob = workflow + '\n  bypass-job:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo bypass\n';
  assert.ok(inspectDisabledWorkflow(extraJob).failures.includes('unexpected_job_topology'));
  // Top-level permissions/concurrency are not extra jobs; removing jobs must fail.
  const missingJobs = workflow.replace(/^jobs:\\s*$/m, 'disabled_jobs:');
  assert.ok(inspectDisabledWorkflow(missingJobs).failures.includes('unexpected_job_topology'));
  const changedStep = workflow.replace('run: exit 1', 'uses: actions/checkout@v4');
  assert.ok(inspectDisabledWorkflow(changedStep).failures.includes('active_dependency_not_allowed'));
});
test('valid-looking pins cannot override other missing approvals', () => {
  const sha='a'.repeat(64);
  const next={...manifest, images:Object.fromEntries(
    ['postgres','gotrue','postgrest'].map(k=>[k,{reference:'example/'+k+'@sha256:'+sha,digest:'sha256:'+sha}])),
    checkoutCommit:'b'.repeat(40)};
  const result=inspectIsolatedManifest(next,{});
  assert.equal(result.pass,false);
  assert.ok(result.failures.includes('auth_http_not_proven'));
});
test('production credential variables are always rejected', () => {
  const result=inspectIsolatedManifest(manifest,{SUPABASE_URL:''});
  assert.ok(result.failures.includes('forbidden_env_supabase_url'));
});
