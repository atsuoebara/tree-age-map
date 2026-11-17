'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {inspectCandidate}=require('./rings-now-p2-g1-candidate-admission.cjs');
const candidate=require('./rings-now-p2-g1-candidate-manifest.json');
const ledger=require('../docs/rings-now-p2-g1-auditor-registry-evidence-20261117.json');
const active=require('./rings-now-p2-isolated-manifest.json');
const copy=x=>JSON.parse(JSON.stringify(x));
const check=(c=candidate,l=ledger,a=active)=>inspectCandidate({candidate:c,ledger:l,activeManifest:a});
test('candidate matches reported ledger but neither G1 nor P2 is approved',()=>{
 const r=check();assert.equal(r.status,'CANDIDATE_MATCHES_REPORTED_LEDGER_ONLY');
 assert.equal(r.g1Verified,false);assert.equal(r.p2ExecutionAuthorized,false);
});
test('digest mutation fails closed',()=>{
 const c=copy(candidate);c.images.gotrue.digest='sha256:'+'f'.repeat(64);
 assert.equal(check(c).status,'BLOCKED');
});
test('index digest substitution fails closed',()=>{
 const c=copy(candidate);c.images.postgres.digest=ledger.sourceRecords[0].indexDigestAtAudit;
 c.images.postgres.reference='docker.io/library/postgres@'+c.images.postgres.digest;
 assert.equal(check(c).status,'BLOCKED');
});
test('reject wrong repository or extra service',()=>{
 const c=copy(candidate);c.images.postgrest.reference=c.images.postgrest.reference.replace('postgrest/postgrest','supabase/postgrest');
 assert.equal(check(c).status,'BLOCKED');
 const d=copy(candidate);d.images.extra={};assert.equal(check(d).status,'BLOCKED');
});
test('reject promotion of any candidate approval flag',()=>{
 for(const change of [{g1Verified:true},{explicitExecutionApproval:true},
   {checkoutCommit:'a'.repeat(40)},{status:'READY_FOR_REVIEW'},
   {billingZeroAdditionalCost:'VERIFIED_FOR_THIS_RUN'}])
   assert.equal(check({...candidate,...change}).status,'BLOCKED');
});
test('active manifest must still be all null',()=>{
 const a=copy(active);a.images.postgres.digest=ledger.sourceRecords[0].platformManifestDigest;
 assert.equal(check(candidate,ledger,a).status,'BLOCKED');
});
test('reject forged ledger approval and repository substitution',()=>{
 for(const update of [{g1Verified:true},{originalRawRegistryResponseIncluded:true},
   {p2ExecutionAuthorized:true}])
   assert.equal(check(candidate,{...ledger,...update}).status,'BLOCKED');
 const l=copy(ledger);l.sourceRecords[1].repository='docker.io/other/gotrue';
 assert.equal(check(candidate,l).status,'BLOCKED');
});
test('missing, duplicate or malformed input cannot pass',()=>{
 assert.equal(check(candidate,{...ledger,sourceRecords:ledger.sourceRecords.slice(0,2)}).status,'BLOCKED');
 const l=copy(ledger);l.sourceRecords[1]={...l.sourceRecords[0]};
 assert.equal(check(candidate,l).status,'BLOCKED');
 assert.equal(check(null).status,'BLOCKED');
});
