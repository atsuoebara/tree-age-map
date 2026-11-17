'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {assessFixture,readRepoSources}=require('./rings-now-p2-fixture-schema-compat.cjs');
const src=readRepoSources(path.join(__dirname,'..'));
const check=(x={})=>assessFixture(x.fixture??src.fixture,x.oldFixture??src.oldFixture,x.uidSource??src.uidSource);
test('new isolated candidate has numeric ID and ACL in the correct order',()=>{
 assert.deepEqual(check(),{pass:true,failures:[]});
});
test('legacy fixture type mismatch is explicitly recognized',()=>{
 assert.match(src.oldFixture,/id uuid PRIMARY KEY/);
 assert.ok(check({oldFixture:src.oldFixture.replace('id uuid PRIMARY KEY','id bigint PRIMARY KEY')}).failures.includes('legacy_mismatch_not_detected'));
});
test('UUID or non-identity ID in V2 fails',()=>{
 assert.ok(check({fixture:src.fixture.replace('id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY','id uuid PRIMARY KEY')}).failures.includes('numeric_id_missing'));
});
test('auth.uid candidate include cannot be silently skipped',()=>{
 assert.ok(check({fixture:src.fixture.replace('\\ir ../rings-now-p2-auth-uid-guc-CANDIDATE.sql','-- include removed')}).failures.includes('uid_candidate_not_included'));
});
test('auth.uid PUBLIC REVOKE must remain after include',()=>{
 assert.ok(check({fixture:src.fixture.replace('REVOKE ALL ON FUNCTION auth.uid() FROM PUBLIC, anon, service_role;','-- missing')}).failures.includes('uid_acl_missing_or_wrong_order'));
 const moved=src.fixture.replace('REVOKE ALL ON FUNCTION auth.uid() FROM PUBLIC, anon, service_role;','').replace('\\ir ../rings-now-p2-auth-uid-guc-CANDIDATE.sql','REVOKE ALL ON FUNCTION auth.uid() FROM PUBLIC, anon, service_role;\n\\ir ../rings-now-p2-auth-uid-guc-CANDIDATE.sql');
 assert.ok(check({fixture:moved}).failures.includes('uid_acl_missing_or_wrong_order'));
});
test('auth.uid EXECUTE grant is required and ordered',()=>{
 assert.ok(check({fixture:src.fixture.replace('GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;','-- missing')}).failures.includes('uid_acl_missing_or_wrong_order'));
});
test('RLS FORCE and owner policy remain mandatory',()=>{
 assert.ok(check({fixture:src.fixture.replace('ALTER TABLE public.runs FORCE ROW LEVEL SECURITY;','')}).failures.includes('rls_force'));
 assert.ok(check({fixture:src.fixture.replace('CREATE POLICY p2_owner_read ON public.runs FOR SELECT TO authenticated','CREATE POLICY p2_owner_read ON public.runs FOR SELECT TO anon')}).failures.includes('rls_owner_policy'));
});
test('the candidate never accepts production settings',()=>{
 assert.ok(check({fixture:src.fixture+'\nDATABASE_URL=production\n'}).failures.includes('production_reference'));
});
