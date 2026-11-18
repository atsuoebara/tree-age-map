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
test('blocked active manifest accepts only exact audited complete pin set',()=>{
 assert.equal(check().status,'CANDIDATE_MATCHES_REPORTED_LEDGER_ONLY');
 const allNull=copy(active);
 for(const key of ['postgres','gotrue','postgrest'])
  allNull.images[key]={reference:null,digest:null};
 assert.equal(check(candidate,ledger,allNull).status,'CANDIDATE_MATCHES_REPORTED_LEDGER_ONLY');
 const partial=copy(active);partial.images.postgres={reference:null,digest:null};
 assert.equal(check(candidate,ledger,partial).status,'BLOCKED');
 for(const key of ['postgres','gotrue','postgrest']){
  const wrong=copy(active);wrong.images[key].digest='sha256:'+'f'.repeat(64);
  wrong.images[key].reference=wrong.images[key].reference.replace(/@sha256:.+$/,'@'+wrong.images[key].digest);
  assert.equal(check(candidate,ledger,wrong).status,'BLOCKED');
 }
 const mixed=copy(active);mixed.images.gotrue.reference=null;
 assert.equal(check(candidate,ledger,mixed).status,'BLOCKED');
 const extra=copy(active);extra.images.extra={reference:null,digest:null};
 assert.equal(check(candidate,ledger,extra).status,'BLOCKED');
});
test('blocked manifest must keep approval, billing and audit states',()=>{
 for(const patch of [{explicitExecutionApproval:true},{status:'READY_FOR_REVIEW'},
   {checkoutCommit:'a'.repeat(40)},{billingZeroAdditionalCost:'VERIFIED_FOR_THIS_RUN'},
   {independentAudit:'APPROVED_FOR_EXACT_HEAD'},{authJwtCompatibility:'PROVEN_BY_ISOLATED_HTTP'},
   {productionAccess:true}]){
  assert.equal(check(candidate,ledger,{...active,...patch}).status,'BLOCKED');
 }
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
