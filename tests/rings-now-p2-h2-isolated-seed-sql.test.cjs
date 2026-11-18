'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {buildH2IsolatedSeedSql}=require('./rings-now-p2-h2-isolated-seed-sql.cjs');
const A='12345678-1234-4234-8234-123456789abc';
const B='87654321-4321-4321-8321-abcdef123456';
test('only two distinct valid, lower-case GoTrue UUID literals are substituted',()=>{
 const sql=buildH2IsolatedSeedSql({ownerA:A.toUpperCase(),ownerB:B});
 assert.ok(sql.includes("'"+A+"'::uuid"));
 assert.ok(sql.includes("'"+B+"'::uuid"));
 assert.ok(!sql.includes('undefined'));
 assert.match(sql,/INSERT INTO public\.runs/);
 assert.match(sql,/VALUES[\s\S]*TIMESTAMPTZ/);
 assert.match(sql,/H2_AB_SEED_COUNTS_INVALID/);
 assert.ok(sql.endsWith('COMMIT;\n'));
});
test('no SQL injection from H1 IDs or duplicate identities',()=>{
 for(const input of [null,'','abcd',A+"'; DROP TABLE public.runs; --",
 '00000000-0000-0000-0000-000000000001']){
  assert.throws(()=>buildH2IsolatedSeedSql({ownerA:input,ownerB:B}));
 }
 assert.throws(()=>buildH2IsolatedSeedSql({ownerA:A,ownerB:A.toUpperCase()}));
});
test('disposable empty table, mandatory RPC, RLS and anon-ACL preflight',()=>{
 const sql=buildH2IsolatedSeedSql({ownerA:A,ownerB:B});
 for(const phrase of ['H2_REQUIRES_EMPTY_DISPOSABLE_TABLE','H2_RLS_NOT_FORCED',
 'H2_NO_CANDIDATE_RPC','H2_ANON_RPC_EXECUTE_PRESENT','H2_NO_ISOLATED_RUNS_TABLE']){
  assert.ok(sql.includes(phrase));
 }
 assert.match(sql,/BEGIN;[\s\S]*COMMIT;/);
});
test('non-grant role has NOLOGIN NOINHERIT, no EXECUTE and no RLS bypass',()=>{
 const sql=buildH2IsolatedSeedSql({ownerA:A,ownerB:B});
 assert.match(sql,/CREATE ROLE p2_h2_no_rpc NOLOGIN NOINHERIT/);
 assert.match(sql,/GRANT p2_h2_no_rpc TO authenticator/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.rings_now_snapshot_candidate_v01\(\)/);
 assert.match(sql,/H2_ROLE_HAS_RPC_EXECUTE/);
 assert.match(sql,/rolcanlogin OR rolinherit OR rolbypassrls/);
 assert.doesNotMatch(sql,/^(?:GRANT|CREATE ROLE|ALTER ROLE|SET ROLE).*service_role/m);
 assert.doesNotMatch(sql,/BYPASSRLS\s*;/);
});
test('SQL constructor does not invoke database tools',()=>{
 const sql=buildH2IsolatedSeedSql({ownerA:A,ownerB:B});
 assert.equal(typeof sql,'string');
 assert.ok(!sql.includes('COPY ')&&!sql.includes('dblink'));
});
