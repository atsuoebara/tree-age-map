'use strict';
// DORMANT, REAL-DOCKER-BACKEND WIRING FOR FUTURE ISOLATED P2.
// No work on import. No Actions entrypoint. Active manifest BLOCKS operation.
// The only default executor when permission gates are met is #200's real
// bounded execFile command; NEVER call #199's synthetic-only lifecycle with it.
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const {inspectP2Preflight}=require('./rings-now-p2-stack-static-gate.cjs');
const {runWithSharedTimeBudget}=require('./rings-now-p2-shared-time-budget.cjs');
const {createDockerCliAdapter}=require('./rings-now-p2-g3-docker-cli-adapter.cjs');
const {createBoundedDockerCommand}=require('./rings-now-p2-g3-bounded-docker-command.cjs');
const activeManifest=require('./rings-now-p2-isolated-manifest.json');
const SERVICES=Object.freeze(['postgres','gotrue','postgrest']);
const REPO=Object.freeze({postgres:'docker.io/library/postgres',
 gotrue:'docker.io/supabase/gotrue',postgrest:'docker.io/postgrest/postgrest'});
const RUN=/^rn_p2_[a-z0-9]{8,32}$/;
function validateLiveManifest(manifest){
 const failures=[];
 const result=inspectP2Preflight(manifest,{});
 if(!result.pass)failures.push(...result.failures);
 if(manifest?.productionAccess!==false)failures.push('production_access_denied_required');
 if(Object.keys(manifest?.images||{}).sort().join(',')!==SERVICES.slice().sort().join(','))
  failures.push('image_set_mismatch');
 for(const service of SERVICES){
  const a=manifest?.images?.[service];
  if(!a||a.reference!==REPO[service]+'@'+a.digest)failures.push('image_repo_mismatch_'+service);
 }
 return Object.freeze({pass:failures.length===0,failures:Object.freeze(failures)});
}
function validInventory(items,id){
 return Array.isArray(items)&&items.every(x=>x&&x.owner===id&&
  ['container','network'].includes(x.type)&&typeof x.id==='string'&&
  /^[a-z0-9][a-z0-9_-]{0,100}$/.test(x.id))&&
  new Set(items.map(x=>x.type+':'+x.id)).size===items.length;
}
// Future integration with real Auth/JWT/SQL must be separately reviewed.
// This restricted #200 Docker adapter currently makes containers without
// environment or writable paths. Therefore startup is an ATTEMPT, not proof
// of a usable Postgres/GoTrue/PostgREST service.
async function runRealP2DockerLifecycle({
 runId,manifest=activeManifest,nowMs=()=>performance.now(),
 totalMs=540000,reserveMs=120000,verifyReserveMs=30000,
 commandFactory=createBoundedDockerCommand,
 adapterFactory=createDockerCliAdapter
}={}){
 assert.match(runId||'',RUN);
 // No Docker execFile, daemon query, process spawn or network before gates.
 const gate=validateLiveManifest(manifest);
 // Test fixtures may inject a fake manifest only when they also inject a
 // nondefault command factory. The real executable backend must consume the
 // actual imported manifest, never a caller-supplied forged approval object.
 const realBackendManifestMismatch=commandFactory===createBoundedDockerCommand&&
  manifest!==activeManifest;
 if(!gate.pass||realBackendManifestMismatch)return Object.freeze({
  status:'BLOCKED_NOT_RUN',preflightIssues:Object.freeze([
   ...gate.failures,...(realBackendManifestMismatch?['noncanonical_real_backend_manifest']:[])]),
  attempted:false,realDockerInvoked:false,g3Verified:false,
  actualP2Proven:false,p2ExecutionAuthorized:false
 });
 assert.equal(typeof commandFactory,'function');
 assert.equal(typeof adapterFactory,'function');
 assert.equal(typeof nowMs,'function');
 const command=commandFactory(),driver=adapterFactory({command});
 assert.equal(driver.evidenceKind,'DOCKER_CLI_ADAPTER_NOT_ADMITTED');
 const ops=[],knownContainers=new Set(),knownNetworks=new Set();
 let baseline=false,executionFailed=false,cleanupFailed=false,verificationFailed=false;
 let finalInventory=null;
 const runStage=async(stage,{timeoutMs})=>{
  // #188's deadline reserves real cleanup and verification time. #200 CLI
  // calls each have separate 15s bounded timeouts. This does not guarantee
  // Docker daemon teardown, and a hung injected callback remains possible.
  if(stage==='execute'){
   try{
    const before=await driver.listOwned(runId);
    if(!validInventory(before,runId)||before.length)throw Error('owned_baseline_not_empty');
    baseline=true;
    const net=await driver.createNetwork({name:runId,owner:runId,internal:true,attachable:false});
    if(net!==runId)throw Error('network_identity_invalid');
    knownNetworks.add(net);
    for(const service of SERVICES){
     const name=runId+'_'+service;
     const created=await driver.createContainer({
      name,owner:runId,network:runId,service,
      image:manifest.images[service].reference,
      platform:'linux/amd64',publishPorts:false,privileged:false,
      readOnlyRootfs:true,persistentVolumes:false,environment:'SYNTHETIC_EMPTY'
     });
     if(created!==name)throw Error('container_identity_invalid');
     knownContainers.add(name);
     await driver.startContainer(name);
     ops.push('started:'+service);
    }
    return {status:'PASS'};
   }catch{executionFailed=true;return {status:'FAIL'};}
  }
  if(stage==='cleanup'){
   if(!baseline){cleanupFailed=true;return {status:'FAIL'};}
   let observed=[];
   try{
    observed=await driver.listOwned(runId);
    if(!validInventory(observed,runId))throw Error('untrusted_inventory');
    for(const item of observed) {
     if(item.type==='container')knownContainers.add(item.id);
     else knownNetworks.add(item.id);
    }
   }catch{cleanupFailed=true;}
   for(const name of [...knownContainers].reverse()){
    try{await driver.stopContainer(name);ops.push('stop:'+name);}
    catch{cleanupFailed=true;}
    try{await driver.removeContainer(name);ops.push('remove:'+name);}
    catch{cleanupFailed=true;}
   }
   for(const name of knownNetworks){
    try{await driver.removeNetwork(name);ops.push('network:'+name);}
    catch{cleanupFailed=true;}
   }
   return {status:cleanupFailed?'FAIL':'CLEAN'};
  }
  if(stage==='verify'){
   try{
    const after=await driver.listOwned(runId);
    finalInventory=after;
    if(!baseline||!validInventory(after,runId)||after.length!==0){
     verificationFailed=true;return {verified:false};
    }
    return {verified:true};
   }catch{verificationFailed=true;return {verified:false};}
  }
  throw Error('unexpected stage');
 };
 let budget,coordinatorFailed=false,emergencyCleanupAttempted=false;
 let emergencyCleanupStatus='NOT_NEEDED',emergencyVerifyStatus='NOT_NEEDED';
 try{budget=await runWithSharedTimeBudget({runStage,nowMs,totalMs,
  reserveMs,verifyReserveMs});}
 catch{
  coordinatorFailed=true;
  // This covers coordinator clock/validation exceptions AFTER resource
  // creation. Never return before a best-effort owned-resource reconciliation.
  // Do not clean a runId whose empty baseline was not established: collision.
  if(baseline){
   emergencyCleanupAttempted=true;
   try{
    const cleaned=await runStage('cleanup',{timeoutMs:15000});
    emergencyCleanupStatus=cleaned?.status==='CLEAN'?'CLI_CLEAN_REPORTED':'FAIL';
   }catch{emergencyCleanupStatus='FAIL';}
   try{
    const check=await runStage('verify',{timeoutMs:15000});
    emergencyVerifyStatus=check?.verified===true?'CLI_EMPTY_REPORTED':'FAIL';
   }catch{emergencyVerifyStatus='FAIL';}
  }else{
   emergencyCleanupStatus='BASELINE_UNTRUSTED';
   emergencyVerifyStatus='NOT_PROVEN';
  }
 }
 if(coordinatorFailed)return Object.freeze({
  status:'FAIL',attempted:true,realDockerInvoked:true,
  verification:'NOT_PROVEN',coordinatorFailed:true,
  emergencyCleanupAttempted,emergencyCleanupStatus,emergencyVerifyStatus,
  cleanupActions:Object.freeze(ops),
  remainingCliReportedResources:Array.isArray(finalInventory)?finalInventory.length:null,
  resourceTerminationProven:false,serviceStartupVerified:false,
  g3Verified:false,actualP2Proven:false,p2ExecutionAuthorized:false
 });
 // Even if all CLI operations reported success, daemon-side resource
 // termination and service startup/HTTP/JWT/SQL remain unverified.
 const consistent=budget.status==='PASS'&&!executionFailed&&!cleanupFailed&&
  !verificationFailed&&Array.isArray(finalInventory)&&finalInventory.length===0;
 return Object.freeze({
  status:consistent?'DOCKER_CLI_LIFECYCLE_REPORTED_CLEAN_NOT_G3_PROOF':'FAIL_OR_NOT_PROVEN',
  attempted:true,realDockerInvoked:true,
  stageRecords:budget.stageRecords,
  cleanupActions:Object.freeze(ops),
  remainingCliReportedResources:Array.isArray(finalInventory)?finalInventory.length:null,
  verification:'CLI_SELF_REPORTED_ONLY',
  resourceTerminationProven:false,serviceStartupVerified:false,
  g3Verified:false,actualP2Proven:false,p2ExecutionAuthorized:false
 });
}
module.exports={runRealP2DockerLifecycle,validateLiveManifest};
