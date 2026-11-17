'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {inspectG3ResourceEvidence}=require('./rings-now-p2-g3-resource-absence-gate.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
const runId='test_run_100';
const container=(id,service)=>({id,type:'container',owner:runId,service});
const row=(id,type)=>({id,type,owner:runId});
function sample(){return {
 kind:'SYNTHETIC_RESOURCE_INVENTORY',source:'INJECTED_TEST_INVENTORY',
 realResourcesObserved:false,executionApproval:false,
 checkoutCommit:'a'.repeat(40),runId,productionAccess:false,billingVerified:false,g1Verified:false,
 cleanupAttempted:true,cleanupStatus:'CLEAN',
 verificationAttempted:true,verificationStatus:'EMPTY',
 expectedServices:['postgres','gotrue','postgrest'],
 before:[],created:[container('pg','postgres'),container('auth','gotrue'),
 container('rest','postgrest'),row('net','network'),row('worker','process')],after:[]
};}
const check=x=>inspectG3ResourceEvidence(x);
test('synthetic clean lifecycle never proves real G3 or P2 authorization',()=>{
 const out=check(sample());
 assert.equal(out.status,'SYNTHETIC_INVENTORY_CONSISTENT_NOT_REAL_PROOF');
 assert.equal(out.actualResourcesVerified,false);
 assert.equal(out.g3Verified,false);
 assert.equal(out.p2ExecutionAuthorized,false);
});
test('missing or malformed evidence fails closed',()=>{
 assert.equal(check(null).status,'BLOCKED');
 assert.equal(check([]).status,'BLOCKED');
 const x=sample();delete x.after;assert.equal(check(x).status,'BLOCKED');
});
test('leftover container, network, process or volume blocks',()=>{
 for(const type of ['container','network','process','volume']){
  const x=sample();x.after=[type==='container'?x.created[0]:row('leak',type)];
  assert.equal(check(x).status,'BLOCKED',type);
 }
});
test('cleanup and verification must be independently recorded',()=>{
 for(const patch of [{cleanupAttempted:false},{cleanupStatus:'FAIL'},
  {verificationAttempted:false},{verificationStatus:'UNKNOWN'}]){
  const x=sample();Object.assign(x,patch);assert.equal(check(x).status,'BLOCKED');
 }
});
test('missing or duplicated service container blocks',()=>{
 const x=sample();x.created=x.created.filter(z=>z.service!=='postgrest');
 assert.equal(check(x).status,'BLOCKED');
 const y=sample();y.created[2].service='postgres';
 assert.equal(check(y).status,'BLOCKED');
});
test('duplicate, foreign-owner, preexisting or invalid identifiers block',()=>{
 const x=sample();x.created.push(clone(x.created[0]));assert.equal(check(x).status,'BLOCKED');
 const y=sample();y.created[0].owner='other_run';assert.equal(check(y).status,'BLOCKED');
 const z=sample();z.before.push(container('orphan','postgres'));assert.equal(check(z).status,'BLOCKED');
 const q=sample();q.runId='../bad';assert.equal(check(q).status,'BLOCKED');
});
test('synthetic proof cannot promote G1, G2, production or execution',()=>{
 for(const patch of [{g1Verified:true},{billingVerified:true},{productionAccess:true},
  {executionApproval:true},{realResourcesObserved:true},{source:'REAL_DOCKER'}]){
  const x=sample();Object.assign(x,patch);assert.equal(check(x).status,'BLOCKED');
 }
});
test('no created resources and wrong checkout fail closed',()=>{
 const x=sample();x.created=[];assert.equal(check(x).status,'BLOCKED');
 const y=sample();y.checkoutCommit=null;assert.equal(check(y).status,'BLOCKED');
});
