'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {inspectG1Evidence,SERVICES}=require('./rings-now-p2-g1-provenance-gate.cjs');
const manifest=require('./rings-now-p2-isolated-manifest.json');
const digest='sha256:'+'a'.repeat(64),commit='b'.repeat(40);
function sample(){
 const m={checkoutCommit:commit,images:{}},e={images:{}};
 for(const key of SERVICES) {
  m.images[key]={reference:'example.org/'+key+'@'+digest,digest};
  e.images[key]={
   digest,tag:'candidate-tag',platform:'linux/amd64',
   registryUrl:'https://example.org/registry/'+key,
   officialSourceUrl:'https://example.org/offical/'+key,
   observedAt:'2026-11-17T01:02:03Z',checkedOutCommit:commit,
   registryQueryType:'platform_manifest_digest',
   verifier:'INDEPENDENTLY_AUDITED_EXTERNAL_PROBE'
  };
 }
 return [m,e];
}
test('checked-in manifest with no digests stays BLOCKED',()=>{
 const r=inspectG1Evidence(manifest,{images:{}});
 assert.equal(r.status,'BLOCKED');assert.equal(r.g1Verified,false);
 assert.equal(r.p2ExecutionAuthorized,false);
 assert.equal(r.issues.length,3);
});
test('complete-looking synthetic evidence is NOT externally verified',()=>{
 const [m,e]=sample();const r=inspectG1Evidence(m,e);
 assert.equal(r.status,'EVIDENCE_FORMAT_COMPLETE_UNVERIFIED');
 assert.equal(r.g1Verified,false);assert.equal(r.p2ExecutionAuthorized,false);
 assert.deepEqual(r.issues,[]);
});
test('digest mismatch and missing manifest reference are rejected',()=>{
 const [m,e]=sample();e.images.postgres.digest='sha256:'+'f'.repeat(64);
 const r=inspectG1Evidence(m,e);
 assert.equal(r.status,'BLOCKED');
 assert.ok(r.issues.includes('postgres:digest_mismatch'));
 assert.ok(r.issues.includes('postgres:manifest_reference_mismatch'));
});
test('rejects incorrect platform even with plausible digest',()=>{
 const [m,e]=sample();e.images.gotrue.platform='linux/arm64';
 assert.ok(inspectG1Evidence(m,e).issues.includes('gotrue:wrong_platform'));
});
test('rejects insecure or missing official source links',()=>{
 const [m,e]=sample();e.images.postgrest.officialSourceUrl='http://example.com';
 e.images.postgrest.registryUrl='https://user:token@example.com/foo';
 const r=inspectG1Evidence(m,e);
 assert.ok(r.issues.includes('postgrest:official_source_missing'));
 assert.ok(r.issues.includes('postgrest:registry_url_invalid'));
});
test('rejects unchecked or wrong HEAD and missing date',()=>{
 const [m,e]=sample();e.images.postgres.checkedOutCommit='c'.repeat(40);
 e.images.gotrue.observedAt='not-a-date';
 const r=inspectG1Evidence(m,e);
 assert.ok(r.issues.includes('postgres:checkout_commit_mismatch'));
 assert.ok(r.issues.includes('gotrue:observation_time_invalid'));
});
test('rejects tag-only claims or non-audited verifier',()=>{
 const [m,e]=sample();e.images.postgres.registryQueryType='tag_only';
 e.images.gotrue.verifier='SELF_REPORTED';
 const r=inspectG1Evidence(m,e);
 assert.ok(r.issues.includes('postgres:registry_digest_kind_unproven'));
 assert.ok(r.issues.includes('gotrue:verifier_unproven'));
});
test('missing service evidence cannot be passed by two valid services',()=>{
 const [m,e]=sample();delete e.images.postgrest;
 const r=inspectG1Evidence(m,e);
 assert.equal(r.status,'BLOCKED');
 assert.ok(r.issues.includes('postgrest:missing_evidence'));
});
