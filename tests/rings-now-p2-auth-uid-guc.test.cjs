'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');
// Static contract testing only: DOES NOT execute PostgreSQL SQL or verify JWT.
const source=readFileSync(path.join(__dirname,'rings-now-p2-auth-uid-guc-CANDIDATE.sql'),'utf8');
const ID_A='11111111-1111-4111-8111-111111111111';
const ID_B='22222222-2222-4222-8222-222222222222';
// Independent JS expectation model for future tests, NOT an SQL emulator.
function model(legacy,json) {
 const l=legacy||null;
 let j=null;
 if(json!==undefined && json!==null && json!=='') {
   const parsed=JSON.parse(json);
   j=parsed?.sub||null;
 }
 if(l && j && l!==j) return null;
 const subject=l||j;
 if(subject===null) return null;
 if(typeof subject!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subject)) throw Error('invalid UUID');
 return subject;
}
test('contract reads both legacy and JSON GUC without assuming one is always set',()=>{
 assert.match(source,/current_setting\('request\.jwt\.claim\.sub', true\)/);
 assert.match(source,/current_setting\('request\.jwt\.claims', true\)/);
});
test('empty string and absent settings become NULL before casts',()=>{
 assert.match(source,/NULLIF\(current_setting\('request\.jwt\.claim\.sub', true\), ''\)/);
 assert.match(source,/NULLIF\(current_setting\('request\.jwt\.claims', true\), ''\)::jsonb/);
 assert.equal(model(undefined,undefined),null);
 assert.equal(model('', ''),null);
});
test('JSON-only valid subject is accepted in the model',()=>assert.equal(model(null,JSON.stringify({sub:ID_A,role:'authenticated'})),ID_A));
test('legacy-only valid subject is accepted in the model',()=>assert.equal(model(ID_A,null),ID_A));
test('matching legacy and JSON is accepted in the model',()=>assert.equal(model(ID_A,JSON.stringify({sub:ID_A})),ID_A));
test('different legacy and JSON subject fail closed in contract and model',()=>{
 assert.match(source,/legacy_sub <> json_sub THEN NULL::uuid/);
 assert.equal(model(ID_A,JSON.stringify({sub:ID_B})),null);
});
test('missing sub remains NULL; role alone is not authorization',()=>{
 assert.equal(model(null,JSON.stringify({role:'authenticated'})),null);
});
test('malformed or invalid claims do not silently authenticate',()=>{
 assert.throws(()=>model(null,'{'),SyntaxError);
 assert.throws(()=>model('not-a-uuid',null),/invalid UUID/);
});
test('fixture is invoker-scoped and cannot run from its inclusion alone',()=>{
 assert.match(source,/SECURITY INVOKER/);
 assert.match(source,/SET search_path = ''/);
 assert.match(source,/NEVER APPLY TO PRODUCTION SUPABASE/);
});
