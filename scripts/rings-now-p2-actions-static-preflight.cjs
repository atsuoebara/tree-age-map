#!/usr/bin/env node
// Static-only repository inspection. Never connects to a DB or starts Actions.
'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const sql = read('docs/rings-now-single-statement-snapshot-CANDIDATE.sql');
const ci = read('.github/workflows/rings-now-pg17-isolated-candidate.yml');
const contract = read('docs/rings-now-p2-actions-implementation-contract-20261116.md');
const tests = [
  ['candidate function', sql.includes('public.rings_now_snapshot_candidate_v01()')],
  ['SECURITY INVOKER', sql.includes('SECURITY INVOKER')],
  ['1001 row cap', sql.includes('LIMIT 1001')],
  ['PUBLIC EXECUTE revoked', sql.includes('FROM PUBLIC;')],
  ['authenticated grant', sql.includes('TO authenticated;')],
  ['service role revoke', sql.includes('FROM service_role;')],
  ['standard runner', ci.includes('runs-on: ubuntu-latest')],
  ['synthetic PostgreSQL', ci.includes('postgres:17')],
  ['synthetic DB', ci.includes('rings_now_synthetic')],
  ['no Secrets reference', !ci.includes('secrets.')],
  ['synthetic target guards', ci.includes('SUPABASE_URL') && ci.includes('DATABASE_URL')],
  ['manual-only contract', contract.includes('workflow_dispatch')],
  ['contract NOT RUN', contract.includes('NOT RUN')]
];
let failed = false;
for (const [label, pass] of tests) {
  console.log((pass ? 'PASS ' : 'FAIL ') + label);
  if (!pass) failed = true;
}
for (const [label, text] of [['candidate SQL', sql], ['existing synthetic CI', ci]]) {
  console.log(label + ' SHA256: ' + crypto.createHash('sha256').update(text).digest('hex'));
}
console.log('STATIC ONLY: not a P2 Auth/JWT/PostgREST, billing, or runtime verification.');
if (failed) process.exitCode = 1;
