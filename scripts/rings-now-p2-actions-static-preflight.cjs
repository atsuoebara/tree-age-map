#!/usr/bin/env node
// Static-only preflight: exact candidate bytes + bounded structural checks.
// No network, process execution, DB connection, writes, or Actions invocation.
'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p));
const sqlBytes = read('docs/rings-now-single-statement-snapshot-CANDIDATE.sql');
const sql = sqlBytes.toString('utf8');
const ci = read('.github/workflows/rings-now-pg17-isolated-candidate.yml').toString('utf8');
const contract = read('docs/rings-now-p2-actions-implementation-contract-20261116.md').toString('utf8');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const EXPECTED_SQL_SHA256 = 'c8bb8bfdeb1e2e88bea422aa76c27d094127bdea';
const results = [];
const check = (name, condition) => results.push([name, Boolean(condition)]);
// Remove line comments before structural checks; not a full SQL parser.
// SHA256 exact-byte equality is the primary SQL drift gate.
const sqlBody = sql.replace(/^\s*--.*$/gm, '');
check('candidate SQL byte length 4033', sqlBytes.length === 4033);
check('candidate SQL expected SHA256', hash(sqlBytes) === EXPECTED_SQL_SHA256);
check('SQL function declaration', /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.rings_now_snapshot_candidate_v01\s*\(\s*\)/i.test(sqlBody));
check('SQL SECURITY INVOKER outside comments', /\bSECURITY\s+INVOKER\b/i.test(sqlBody) && !/\bSECURITY\s+DEFINER\b/i.test(sqlBody));
check('SQL 1001 cap outside comments', /\bLIMIT\s+1001\b/i.test(sqlBody));
check('SQL explicit ACL outside comments', [
  /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.rings_now_snapshot_candidate_v01\(\)\s+FROM\s+PUBLIC\s*;/i,
  /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.rings_now_snapshot_candidate_v01\(\)\s+FROM\s+anon\s*;/i,
  /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.rings_now_snapshot_candidate_v01\(\)\s+FROM\s+service_role\s*;/i,
  /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.rings_now_snapshot_candidate_v01\(\)\s+TO\s+authenticated\s*;/i
].every(re => re.test(sqlBody)));
// Inspect the complete existing synthetic workflow, not only variable names.
const yamlLines = ci.split(/\r?\n/);
const jobNames = yamlLines.filter(l => /^  [A-Za-z][\w-]*:\s*$/.test(l) && !/^  (pull_request|workflow_dispatch):/.test(l));
check('single synthetic job', /^jobs:\s*$/m.test(ci) && jobNames.length === 1 && jobNames[0].trim() === 'synthetic-postgres:');
check('standard runner only', (ci.match(/\bruns-on\s*:/g) || []).length === 1 && /^    runs-on:\s*ubuntu-latest\s*$/m.test(ci));
check('PostgreSQL 17 synthetic service', /^        image:\s*postgres:17\s*$/m.test(ci) && /^          POSTGRES_DB:\s*rings_now_synthetic\s*$/m.test(ci));
check('synthetic-only env', /^      PGHOST:\s*localhost\s*$/m.test(ci) && /^      PGDATABASE:\s*rings_now_synthetic\s*$/m.test(ci));
check('explicit empty production env guards', [
  /test -z "\$\{SUPABASE_URL:-\}"/,
  /test -z "\$\{DATABASE_URL:-\}"/
].every(re => re.test(ci)));
check('read-only token permissions', /^permissions:\s*\n  contents:\s*read\s*$/m.test(ci));
check('no secrets references', !/\bsecrets\s*\./i.test(ci));
check('manual-only contract present', contract.includes('workflow_dispatch') && contract.includes('NOT RUN'));
let failed = false;
for (const [name, ok] of results) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name);
  if (!ok) failed = true;
}
console.log('candidate SQL SHA256:', hash(sqlBytes));
console.log('synthetic workflow SHA256:', hash(Buffer.from(ci)));
console.log('STATIC ONLY: not a P2 Auth/JWT/PostgREST, billing, or runtime verification.');
console.log('Regex checks are not semantic SQL/YAML validation; no proof of isolation or effective ACL.');
if (failed) process.exitCode = 1;
