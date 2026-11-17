'use strict';
// Offline textual guard for a FUTURE disposable SQL fixture, NOT a SQL parser.
const fs=require('node:fs');
const path=require('node:path');
function assessFixture(fixture, oldFixture, uidSource) {
 const failures=[];
 const fail=(id)=>failures.push(id);
 if(typeof fixture!=='string'||typeof oldFixture!=='string'||typeof uidSource!=='string')
   return {pass:false,failures:['invalid_source']};
 const active=fixture.split('\n').filter(s=>!/^\s*--/.test(s)).join('\n');
 const old=oldFixture.split('\n').filter(s=>!/^\s*--/.test(s)).join('\n');
 if(!/id\s+bigint\s+GENERATED ALWAYS AS IDENTITY\s+PRIMARY KEY/i.test(active))
   fail('numeric_id_missing');
 if(!/id\s+uuid\s+PRIMARY KEY/i.test(old))
   fail('legacy_mismatch_not_detected');
 if(!/^\\ir\s+\.\.\/rings-now-p2-auth-uid-guc-CANDIDATE\.sql\s*$/m.test(active))
   fail('uid_candidate_not_included');
 if(!/CREATE OR REPLACE FUNCTION auth\.uid\(\)/i.test(uidSource) ||
    !/request\.jwt\.claims/.test(uidSource) ||
    !/request\.jwt\.claim\.sub/.test(uidSource))
   fail('uid_compat_candidate_invalid');
 const position=(pattern)=>active.search(pattern);
 const include=position(/^\\ir\s+\.\.\/rings-now-p2-auth-uid-guc-CANDIDATE\.sql/m);
 const revoke=position(/REVOKE ALL ON FUNCTION auth\.uid\(\) FROM PUBLIC, anon, service_role;/i);
 const grant=position(/GRANT EXECUTE ON FUNCTION auth\.uid\(\) TO authenticated;/i);
 if(include<0||revoke<=include||grant<=revoke)
   fail('uid_acl_missing_or_wrong_order');
 for(const [code,pattern] of [
   ['schema_auth_acl',/REVOKE ALL ON SCHEMA auth FROM PUBLIC;/i],
   ['schema_public_acl',/REVOKE ALL ON SCHEMA public FROM PUBLIC;/i],
   ['rls_force',/ALTER TABLE public\.runs FORCE ROW LEVEL SECURITY;/i],
   ['rls_owner_policy',/CREATE POLICY p2_owner_read ON public\.runs FOR SELECT TO authenticated\s+USING \(user_id = \(SELECT auth\.uid\(\)\)\);/i],
   ['table_revoke',/REVOKE ALL ON TABLE public\.runs FROM PUBLIC, anon, service_role;/i],
   ['table_select',/GRANT SELECT ON TABLE public\.runs TO authenticated;/i],
   ['commit_missing',/^COMMIT;\s*$/m]
 ])if(!pattern.test(active))fail(code);
 if(/\$\{\{\s*secrets\.|SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL/i.test(active))
   fail('production_reference');
 return {pass:failures.length===0,failures};
}
function readRepoSources(root) {
 return {
  fixture:fs.readFileSync(path.join(root,'tests/fixtures/rings-now-p2-isolated-schema-v2-CANDIDATE.sql'),'utf8'),
  oldFixture:fs.readFileSync(path.join(root,'tests/fixtures/rings-now-p2-isolated-schema.sql'),'utf8'),
  uidSource:fs.readFileSync(path.join(root,'tests/rings-now-p2-auth-uid-guc-CANDIDATE.sql'),'utf8')
 };
}
module.exports={assessFixture,readRepoSources};
