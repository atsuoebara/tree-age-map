'use strict';
// G3 future Docker lifecycle ORCHESTRATION CONTRACT (INERT).
// No Docker client/child_process import, network calls, secrets, env reads,
// SQL, production access, timers or work on module load.
// The only permitted current caller is a synthetic injected driver.
// This is NOT an executable P2 runner and is never imported by Actions.
const assert=require('node:assert/strict');
const SERVICES=Object.freeze(['postgres','gotrue','postgrest']);
const RUN=/^rn_p2_[a-z0-9]{8,32}$/;
const DIGEST=/^sha256:[a-f0-9]{64}$/;
const REPOS=Object.freeze({
 postgres:'docker.io/library/postgres',
 gotrue:'docker.io/supabase/gotrue',
 postgrest:'docker.io/postgrest/postgrest'
});
const REQUIRED_METHODS=Object.freeze([
 'listOwned','createNetwork','createContainer','startContainer',
 'stopContainer','removeContainer','removeNetwork'
]);
const status=(failed,clean)=>failed?'FAIL':clean?'SYNTHETIC_LIFECYCLE_CONSISTENT_NOT_REAL_PROOF':'NOT_PROVEN';
function validate({driver,runId,candidate,liveManifest}) {
 assert.match(runId||'',RUN,'synthetic run identifier');
 assert.ok(driver&&typeof driver==='object'&&!Array.isArray(driver));
 assert.equal(driver.evidenceKind,'INJECTED_SYNTHETIC_DRIVER');
 for(const name of REQUIRED_METHODS)assert.equal(typeof driver[name],'function',name+' required');
 assert.ok(candidate&&typeof candidate==='object');
 assert.equal(candidate.purpose,'AUDIT_ONLY_CANDIDATE_NOT_RUNTIME_INPUT');
 assert.equal(candidate.status,'BLOCKED_NOT_RUN');
 assert.equal(candidate.explicitExecutionApproval,false);
 assert.equal(candidate.g1Verified,false);
 assert.equal(candidate.productionAccess,false);
 assert.equal(candidate.platform,'linux/amd64');
 assert.ok(liveManifest&&liveManifest.status==='BLOCKED_NOT_RUN');
 assert.equal(liveManifest.explicitExecutionApproval,false);
 assert.equal(liveManifest.productionAccess,false);
 assert.equal(liveManifest.billingZeroAdditionalCost,'NOT_VERIFIED');
 for(const service of SERVICES){
  const a=candidate.images?.[service],b=liveManifest.images?.[service];
  assert.ok(a&&b);
  assert.match(a.digest||'',DIGEST);
  assert.equal(a.reference,REPOS[service]+'@'+a.digest);
  assert.equal(b.reference,null);
  assert.equal(b.digest,null);
 }
}
function validResources(items,runId) {
 if(!Array.isArray(items))return false;
 const seen=new Set();
 for(const x of items){
  if(!x||typeof x!=='object'||x.owner!==runId||
   !['network','container'].includes(x.type)||
   typeof x.id!=='string'||!/^[a-z0-9][a-z0-9_-]{0,100}$/.test(x.id))
   return false;
  const key=x.type+':'+x.id;
  if(seen.has(key))return false;
  seen.add(key);
 }
 return true;
}
async function runG3SyntheticDockerLifecycle({driver,runId,candidate,liveManifest}={}){
 validate({driver,runId,candidate,liveManifest});
 const record={started:[],cleanup:[],verification:'NOT_PROVEN'};
 let failed=false,createdNetwork=null,baselineAccepted=false;
 const createdContainers=[];
 // Only the synthetic driver is allowed; do not dynamically load a real
 // runtime from these inputs. No caller-supplied scripts, ports, volumes, env.
 try {
  const before=await driver.listOwned(runId);
  if(!validResources(before,runId)||before.length!==0)
   throw Error('baseline_not_empty_or_untrusted');
  baselineAccepted=true;
  // A network create may succeed but then throw before returning its ID.
  // Synthetic drivers must be independently audited to expose such partial
  // resources through listOwned; we must not claim verified cleanup otherwise.
  createdNetwork=await driver.createNetwork({
   name:runId,owner:runId,internal:true,attachable:false
  });
  if(typeof createdNetwork!=='string'||!/^rn_p2_[a-z0-9]{8,32}$/.test(createdNetwork))
   throw Error('network_identity_invalid');
  for(const service of SERVICES){
   const name=runId+'_'+service;
   const container=await driver.createContainer({
    name,owner:runId,network:createdNetwork,service,
    image:candidate.images[service].reference,
    platform:'linux/amd64',publishPorts:false,
    privileged:false,readOnlyRootfs:true,persistentVolumes:false,
    environment:'SYNTHETIC_EMPTY'
   });
   if(container!==name)throw Error('container_identity_mismatch');
   createdContainers.push(container);
   await driver.startContainer(container);
   record.started.push(service);
  }
 } catch {
  failed=true;
 } finally {
  // Discover run-scoped resources again to address partial create errors.
  // Never delete resources without exact run owner attestation.
  let found=[];
  if(!baselineAccepted){
   // Never delete resources that existed before this attempt. A runId
   // collision is a hard failure, not an authorization to clean it up.
   record.verification='BLOCKED';
   failed=true;
  } else try{
   found=await driver.listOwned(runId);
   if(!validResources(found,runId)){failed=true;found=[];}
  }catch{failed=true;}
  // Also attempt removal of the known created resources even when inventory
  // is incomplete; failure to validate the inventory keeps final FAIL.
  const containers=new Set(baselineAccepted?createdContainers:[]);
  for(const item of found)if(item.type==='container')containers.add(item.id);
  // Stop/remove all run-owned containers; do not touch other runs.
  for(const id of [...containers].reverse()){
   try{await driver.stopContainer(id);record.cleanup.push('stop:'+id);}
   catch{failed=true;}
   try{await driver.removeContainer(id);record.cleanup.push('remove:'+id);}
   catch{failed=true;}
  }
  const networks=new Set(baselineAccepted&&createdNetwork?[createdNetwork]:[]);
  for(const item of found)if(item.type==='network')networks.add(item.id);
  for(const id of networks){
   try{await driver.removeNetwork(id);record.cleanup.push('network:'+id);}
   catch{failed=true;}
  }
  try{
   const after=await driver.listOwned(runId);
   if(baselineAccepted&&validResources(after,runId)&&after.length===0)
    record.verification='SYNTHETIC_EMPTY_INVENTORY';
   else{failed=true;record.verification='BLOCKED';}
  }catch{failed=true;record.verification='NOT_PROVEN';}
 }
 const fullyStarted=record.started.length===3;
 // A successful synthetic result is never real-world G3 proof.
 return Object.freeze({
  evidenceKind:'INJECTED_SYNTHETIC_DOCKER_LIFECYCLE',
  status:status(failed||!fullyStarted,
    record.verification==='SYNTHETIC_EMPTY_INVENTORY'),
  started:Object.freeze(record.started),
  cleanup:Object.freeze(record.cleanup),
  verification:record.verification,
  actualContainersObserved:false,resourceTerminationProven:false,
  g3Verified:false,p2ExecutionAuthorized:false,actualP2Proven:false
 });
}
module.exports={runG3SyntheticDockerLifecycle,REQUIRED_METHODS};
