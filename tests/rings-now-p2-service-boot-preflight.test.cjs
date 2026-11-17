'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {inspectP2ServiceBootPlan,REQUIRED}=require('./rings-now-p2-service-boot-preflight.cjs');
const plan=require('./rings-now-p2-service-boot-plan-CANDIDATE.json');
const candidate=require('./rings-now-p2-g1-candidate-manifest.json');
const activeManifest=require('./rings-now-p2-isolated-manifest.json');
const clone=x=>JSON.parse(JSON.stringify(x));
const inspect=(p=plan,c=candidate,a=activeManifest)=>inspectP2ServiceBootPlan({plan:p,candidate:c,activeManifest:a});
test('candidate has a complete OFFLINE shape but never boot/approval proof',()=>{
 const r=inspect();
 assert.equal(r.status,'BOOT_SHAPE_REVIEW_COMPLETE_NOT_RUN');
 assert.deepEqual(r.issues,[]);
 for(const flag of ['serviceBootProven','realJWTVerified','dockerResourcesVerified',
  'g1Verified','g2Verified','g3Verified','p2ExecutionAuthorized'])
  assert.equal(r[flag],false);
});
test('no plan or malformed plan is blocked',()=>{
 for(const x of [null,[],42,'foo'])assert.equal(inspect(x).status,'BLOCKED');
});
test('runtime approval or evidence promotion is blocked',()=>{
 for(const patch of [{executionApproval:true},{dockerExecutionAllowed:true},
  {credentialsIncluded:true},{realResourcesObserved:true},{serviceBootProven:true},
  {g3Verified:true},{p2ExecutionAuthorized:true}]){
  const p={...clone(plan),...patch};assert.equal(inspect(p).status,'BLOCKED');
 }
});
test('production credentials, logged tokens and repo secrets blocked',()=>{
 for(const patch of [{source:'PRODUCTION_SUPABASE'},{logged:true},{storedInRepo:true},
  {fromProduction:true},{providedNow:true}]){
  const p=clone(plan);Object.assign(p.secrets,patch);
  assert.equal(inspect(p).status,'BLOCKED');
 }
});
test('host networking, open ports and external egress blocked',()=>{
 for(const patch of [{internal:false},{hostNetworkAllowed:true},
  {hostPortsPublished:true},{attachable:true},{externalApplicationEgressAllowed:true}]){
  const p=clone(plan);Object.assign(p.network,patch);
  assert.equal(inspect(p).status,'BLOCKED');
 }
});
test('other runner types, automatic triggers and extended budgets blocked',()=>{
 for(const patch of [{kind:'larger-runner'},{jobs:2},{manualOnly:false},
  {maximumMinutes:60},{workflowEnabled:true}]){
  const p=clone(plan);Object.assign(p.runner,patch);
  assert.equal(inspect(p).status,'BLOCKED');
 }
});
test('all service environment key names fixed and values are excluded',()=>{
 for(const service of Object.keys(REQUIRED)){
  for(const mutation of ['remove','duplicate','secret']){
   const p=clone(plan),s=p.services[service];
   if(mutation==='remove')s.requiredEnvironmentKeys.pop();
   if(mutation==='duplicate')s.requiredEnvironmentKeys.push(s.requiredEnvironmentKeys[0]);
   if(mutation==='secret')s.environmentValuesIncluded=true;
   assert.equal(inspect(p).status,'BLOCKED');
  }
 }
});
test('image digest and service list cannot drift',()=>{
 const p=clone(plan);p.services.postgres.imageReference='postgres:latest';
 assert.equal(inspect(p).status,'BLOCKED');
 const q=clone(plan);delete q.services.gotrue;
 assert.equal(inspect(q).status,'BLOCKED');
 const c=clone(candidate);c.images.postgres.digest='sha256:'+'a'.repeat(64);
 c.images.postgres.reference='docker.io/library/postgres@'+c.images.postgres.digest;
 assert.equal(inspect(plan,c).status,'BLOCKED');
});
test('manifest cannot silently become runnable',()=>{
 const a=clone(activeManifest);a.explicitExecutionApproval=true;
 assert.equal(inspect(plan,candidate,a).status,'BLOCKED');
});
test('unreviewed Postgres writable paths cannot be considered compatible',()=>{
 for(const patch of [{writableMountsCompatibilityVerified:true},{dataDurable:true},
 {ephemeralWritePaths:['/var/lib/postgresql/data','/etc']}]){
  const p=clone(plan);Object.assign(p.services.postgres,patch);
  assert.equal(inspect(p).status,'BLOCKED');
 }
});
test('GoTrue migration, mail, phone and OAuth cannot be assumed safe',()=>{
 for(const patch of [{authSchemaMigrationVerified:true},{emailDeliveryEnabled:true},
 {phoneDeliveryEnabled:true},{externalOAuthEnabled:true}]){
  const p=clone(plan);Object.assign(p.services.gotrue,patch);
  assert.equal(inspect(p).status,'BLOCKED');
 }
});
test('PostgREST role/claims/host capability cannot be assumed verified',()=>{
 for(const patch of [{roleConfigVerified:true},{claimsGucVerified:true},
 {externalHostnameAllowed:true}]){
  const p=clone(plan);Object.assign(p.services.postgrest,patch);
  assert.equal(inspect(p).status,'BLOCKED');
 }
});
test('real JWT test, natural expiry and consistent secret still unproven',()=>{
 for(const patch of [{realJWTVerificationCompleted:true},
 {postgrestClaimsGucObserved:true},{jwtAlgorithm:'RS256_VERIFIED'},
 {sharedSigningKeyReference:'PRODUCTION_SECRET'}]){
  const p=clone(plan);Object.assign(p.auth,patch);
  assert.equal(inspect(p).status,'BLOCKED');
 }
});
test('no billing claim, cleanup result, or successful start forged',()=>{
 const patches=[
 p=>p.billing.futureRunIncrementalCostProven=true,
 p=>p.billing.accountUiEvidenceVerified=true,
 p=>p.cleanup.reconcileAfterTimeout=false,
 p=>p.cleanup.verifyDaemonResourcesEmpty=false,
 p=>p.services.postgres.startupVerified=true,
 p=>p.services.postgrest.healthcheckVerified=true
 ];
 for(const edit of patches){const p=clone(plan);edit(p);assert.equal(inspect(p).status,'BLOCKED');}
});
