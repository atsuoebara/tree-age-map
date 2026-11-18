'use strict';
// Offline-only contract tests. Do not run P2 or dispatch Actions.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {inspectIsolatedManifest, inspectP2Preflight, inspectP2Postflight, inspectDisabledWorkflow} =
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
  assert.ok(result.failures.includes('manifest_not_in_phase'));
  assert.ok(result.failures.includes('execution_approval_missing'));
  for (const key of ['postgres','gotrue','postgrest']){
    assert.ok(!result.failures.includes('image_unpinned_' + key));
    assert.ok(manifest.images[key].reference.endsWith('@'+manifest.images[key].digest));
  }
  assert.equal(manifest.status,'BLOCKED_NOT_RUN');
  assert.equal(manifest.explicitExecutionApproval,false);
  assert.equal(manifest.checkoutCommit,null);
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
  const missingJobs = workflow.replace(/^jobs:\s*$/m, 'disabled_jobs:');
  assert.ok(inspectDisabledWorkflow(missingJobs).failures.includes('unexpected_job_topology'));
  const extraTopLevel = workflow.replace('jobs:', 'permissions:');
  assert.ok(inspectDisabledWorkflow(extraTopLevel).failures.includes('unexpected_job_topology'));
  const changedStep = workflow.replace(
    'actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683',
    'actions/checkout@v4');
  assert.ok(inspectDisabledWorkflow(changedStep).failures.includes('active_dependency_not_allowed'));
  assert.ok(inspectDisabledWorkflow(workflow.replace(
    'ref: ${{ github.sha }}','ref: main')).failures.includes('checkout_sha_binding_missing'));
  assert.ok(inspectDisabledWorkflow(workflow.replace(
    'fetch-depth: 2','fetch-depth: 1')).failures.includes('checkout_sha_binding_missing'));
  assert.ok(inspectDisabledWorkflow(workflow.replace(
    'node tests/rings-now-p2-g4-approval-child-cli.cjs',
    'echo skip-parent-check')).failures.includes('checkout_sha_binding_missing'));
  assert.ok(inspectDisabledWorkflow(workflow.replace(
    'persist-credentials: false','persist-credentials: true')).failures.includes('checkout_sha_binding_missing'));
  assert.ok(inspectDisabledWorkflow(workflow.replace(
    'timeout-minutes: 12','timeout-minutes: 60')).failures.includes('runner_budget_not_bounded'));
  assert.ok(inspectDisabledWorkflow(workflow.replace(
    'timeout-minutes: 12','timeout-minutes: 10')).failures.includes('runner_budget_not_bounded'));
  assert.ok(inspectDisabledWorkflow(workflow.replace(
    'timeout-minutes: 12','timeout-minutes: 13')).failures.includes('runner_budget_not_bounded'));
  assert.ok(inspectDisabledWorkflow(workflow.replace(
    'node tests/rings-now-p2-cli.cjs --isolated-once',
    'echo bypass')).failures.includes('cli_or_preflight_missing'));
  // Both strict-mode occurrences must be changed in the mutation test,
  // otherwise an earlier step can hide a broken CLI step.
  assert.ok(inspectDisabledWorkflow(workflow.replaceAll(
    'set -euo pipefail','set +e')).failures.includes('cli_or_preflight_missing'));
  // Even changing only the CLI step must be detected; retaining strict mode
  // in preflight must not create a false PASS.
  const cliOnlyMutation=workflow.replace(
    '          set -euo pipefail\n          # CLI emits only non-secret structured summary and ALWAYS exits 1 or 2.',
    '          set +e\n          # CLI emits only non-secret structured summary and ALWAYS exits 1 or 2.'
  );
  assert.ok(inspectDisabledWorkflow(cliOnlyMutation).failures.includes('cli_or_preflight_missing'));
  assert.ok(inspectDisabledWorkflow(workflow + '\n# upload-artifact@v4').failures.includes('unsafe_workflow_escape'));
  assert.ok(inspectDisabledWorkflow(workflow.replace(
    '    steps:', '    steps:\n      - name: bypass\n        uses: actions/upload-artifact@v4'))
      .failures.includes('active_dependency_not_allowed'));
  assert.ok(inspectDisabledWorkflow(workflow.replace(
    '    steps:', '    continue-on-error: true\n    steps:')).failures.includes('unsafe_workflow_escape'));
});
test('valid-looking pins cannot override other missing approvals', () => {
  const sha='a'.repeat(64);
  const next={...manifest, images:Object.fromEntries(
    ['postgres','gotrue','postgrest'].map(k=>[k,{reference:'example/'+k+'@sha256:'+sha,digest:'sha256:'+sha}])),
    checkoutCommit:'b'.repeat(40)};
  const result=inspectIsolatedManifest(next,{});
  assert.equal(result.pass,false);
  assert.equal(result.phase, 'preflight');
  assert.ok(!result.failures.includes('auth_http_not_proven'));
  assert.ok(inspectP2Postflight(next, {}).failures.includes('auth_http_not_proven'));
});
test('production credential variables are always rejected', () => {
  const result=inspectIsolatedManifest(manifest,{SUPABASE_URL:''});
  assert.ok(result.failures.includes('forbidden_env_supabase_url'));
});

test('preflight and postflight explicitly separate HTTP evidence', () => {
  const digest = 'sha256:' + 'a'.repeat(64);
  const ready = {...manifest,
    images:Object.fromEntries(['postgres','gotrue','postgrest'].map(k =>
      [k,{reference:'example/'+k+'@'+digest,digest}])),
    checkoutCommit:'b'.repeat(40),
    status:'READY_FOR_REVIEW',
    billingZeroAdditionalCost:'VERIFIED_FOR_THIS_RUN',
    independentAudit:'APPROVED_FOR_EXACT_HEAD',
    explicitExecutionApproval:true,
    authJwtCompatibility:'NOT_PROVEN'};
  // Syntactic preflight is not a runtime authorization. Actual workflow stays disabled.
  assert.deepEqual(inspectP2Preflight(ready, {}), {pass:true,phase:'preflight',failures:[]});
  assert.ok(inspectP2Postflight(ready, {}).failures.includes('auth_http_not_proven'));
  assert.ok(inspectIsolatedManifest(ready, {}, 'unknown').failures.includes('invalid_phase'));
  assert.ok(inspectP2Preflight({...ready, explicitExecutionApproval:false}, {})
    .failures.includes('execution_approval_missing'));
  assert.ok(inspectP2Preflight({...ready,status:'BLOCKED_NOT_RUN'}, {}).failures.includes('manifest_not_in_phase'));
  const claimed = {...ready,status:'EVIDENCE_RECORDED',authJwtCompatibility:'PROVEN_BY_ISOLATED_HTTP'};
  // Even postflight static PASS is just a declared marker, not witnessed evidence.
  assert.deepEqual(inspectP2Postflight(claimed, {}), {pass:true,phase:'postflight',failures:[]});
});
