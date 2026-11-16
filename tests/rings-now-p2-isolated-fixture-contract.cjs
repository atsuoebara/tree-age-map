'use strict';
// Static fail-closed fixture contract; does not connect to DB, Auth, or Actions.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const schema = fs.readFileSync(path.join(root, 'tests/fixtures/rings-now-p2-isolated-schema.sql'),'utf8');
const candidate = fs.readFileSync(path.join(root,'docs/rings-now-single-statement-snapshot-CANDIDATE.sql'),'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root,'tests/rings-now-p2-isolated-manifest.json'),'utf8'));
const requiredSchema = [
  /CREATE ROLE anon NOLOGIN NOINHERIT;/,
  /CREATE ROLE authenticated NOLOGIN NOINHERIT;/,
  /CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;/,
  /CREATE OR REPLACE FUNCTION auth\.uid\(\)/,
  /current_setting\('request\.jwt\.claim\.sub', true\)/,
  /ALTER TABLE public\.runs ENABLE ROW LEVEL SECURITY;/,
  /ALTER TABLE public\.runs FORCE ROW LEVEL SECURITY;/,
  /USING \(user_id = \(SELECT auth\.uid\(\)\)\)/,
  /GRANT SELECT ON public\.runs TO authenticated;/,
  /REVOKE ALL ON TABLE public\.runs FROM PUBLIC, anon, service_role;/
];
for(const rule of requiredSchema) assert.match(schema,rule);
assert.match(candidate,/SECURITY INVOKER/);
assert.match(candidate,/LIMIT 1001/);
assert.match(candidate,/REVOKE ALL ON FUNCTION public\.rings_now_snapshot_candidate_v01\(\) FROM PUBLIC/);
assert.equal(manifest.status,'BLOCKED_NOT_RUN');
assert.equal(manifest.explicitExecutionApproval,false);
assert.equal(manifest.billingZeroAdditionalCost,'NOT_VERIFIED');
for(const name of ['postgres','gotrue','postgrest']) assert.equal(manifest.images[name].digest,null);
console.log('P2 isolated fixture static contract PASS (NOT RUN: DB/Auth/HTTP/Actions)');
