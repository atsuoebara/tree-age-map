'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {runG3SyntheticDockerLifecycle}=require('./rings-now-p2-g3-docker-lifecycle.cjs');
const candidate=require('./rings-now-p2-g1-candidate-manifest.json');
const liveManifest=require('./rings-now-p2-isolated-manifest.json');
const runId='rn_p2_abcdefgh';
function mock(faults={}){
 const items=new Map(),events=[];
 const key=(type,id)=>type+':'+id;
 const driver={
 evidenceKind:'INJECTED_SYNTHETIC_DRIVER',
 events,items,
 async listOwned(owner){
  events.push('list');
  if(faults.listThrows)throw Error('synthetic list failed');
  if(faults.forgedInventory)return [{type:'container',id:'foreign',owner:'other_run'}];
  if(faults.residualOnVerify&&events.filter(x=>x==='list').length>=3)
   return [{type:'container',id:'residual',owner:runId}];
  return [...items.values()].filter(x=>x.owner===owner);
 },
 async createNetwork({name,owner,internal,attachable}){
  events.push('network');
  assert.equal(internal,true);assert.equal(attachable,false);
  items.set(key('network',name),{type:'network',id:name,owner});
  if(faults.networkThrowsAfterCreate)throw Error('synthetic network partial');
  return name;
 },
 async createContainer(spec){
  events.push('create:'+spec.service);
  assert.equal(spec.publishPorts,false);assert.equal(spec.persistentVolumes,false);
  assert.equal(spec.platform,'linux/amd64');assert.equal(spec.privileged,false);
  assert.equal(spec.environment,'SYNTHETIC_EMPTY');
  assert.equal(spec.readOnlyRootfs,true);
  assert.equal(spec.network,runId);
  assert.ok(spec.image.includes('@sha256:'));
  items.set(key('container',spec.name),{type:'container',id:spec.name,owner:spec.owner});
  if(faults.createThrowsOn===spec.service)throw Error('synthetic create partial');
  return spec.name;
 },
 async startContainer(name){
  events.push('start:'+name);
  if(faults.startThrowsOn&&name.endsWith('_'+faults.startThrowsOn))
   throw Error('synthetic start failed');
 },
 async stopContainer(id){
  events.push('stop:'+id);
  if(faults.stopThrows)throw Error('synthetic stop failed');
 },
 async removeContainer(id){
  events.push('remove:'+id);
  if(faults.removeThrows)throw Error('synthetic remove failed');
  items.delete(key('container',id));
 },
 async removeNetwork(id){
  events.push('removeNetwork:'+id);
  if(faults.networkRemoveThrows)throw Error('synthetic network removal failed');
  items.delete(key('network',id));
 }
 };
 return driver;
}
const run=(driver,opts={})=>runG3SyntheticDockerLifecycle({
 driver,runId,candidate,liveManifest,...opts
});
test('three pinned services and network are synthetically torn down',async()=>{
 const d=mock();const x=await run(d);
 assert.equal(x.status,'SYNTHETIC_LIFECYCLE_CONSISTENT_NOT_REAL_PROOF');
 assert.deepEqual(x.started,['postgres','gotrue','postgrest']);
 assert.equal(d.items.size,0);
 assert.equal(x.verification,'SYNTHETIC_EMPTY_INVENTORY');
 assert.equal(x.g3Verified,false);assert.equal(x.p2ExecutionAuthorized,false);
 assert.equal(x.resourceTerminationProven,false);
});
test('network partial creation error triggers inventory-based cleanup',async()=>{
 const d=mock({networkThrowsAfterCreate:true});const x=await run(d);
 assert.equal(x.status,'FAIL');assert.equal(d.items.size,0);
 assert.ok(d.events.some(z=>z.startsWith('removeNetwork:')));
});
test('container partial creation error is discovered and removed',async()=>{
 const d=mock({createThrowsOn:'gotrue'});const x=await run(d);
 assert.equal(x.status,'FAIL');assert.equal(d.items.size,0);
 assert.ok(d.events.includes('remove:'+runId+'_gotrue'));
});
test('start error triggers best-effort cleanup and retains FAIL',async()=>{
 const d=mock({startThrowsOn:'postgrest'});const x=await run(d);
 assert.equal(x.status,'FAIL');assert.equal(d.items.size,0);
});
test('stop failure never becomes success even if remove succeeds',async()=>{
 const d=mock({stopThrows:true});const x=await run(d);
 assert.equal(x.status,'FAIL');assert.equal(d.items.size,0);
});
test('container and network removal failures cannot be concealed',async()=>{
 for(const failures of [{removeThrows:true},{networkRemoveThrows:true}]){
  const d=mock(failures);const x=await run(d);
  assert.equal(x.status,'FAIL');
  assert.ok(d.items.size>0);
 }
});
test('invented post-cleanup residual resource prevents success',async()=>{
 const d=mock({residualOnVerify:true});const x=await run(d);
 assert.equal(x.status,'FAIL');assert.equal(x.verification,'BLOCKED');
});
test('untrusted inventory and listing failures never pass',async()=>{
 for(const faults of [{forgedInventory:true},{listThrows:true}]){
  const d=mock(faults);const x=await run(d);
  assert.equal(x.status,'FAIL');
 }
});
test('forged real runtime driver rejected before any operation',async()=>{
 const d=mock();d.evidenceKind='REAL_DOCKER';
 await assert.rejects(()=>run(d));assert.equal(d.events.length,0);
});
test('active manifest approval or candidate pin mismatch rejected',async()=>{
 const d=mock();
 const live=JSON.parse(JSON.stringify(liveManifest));live.explicitExecutionApproval=true;
 await assert.rejects(()=>run(d,{liveManifest:live}));
 const c=JSON.parse(JSON.stringify(candidate));c.images.postgres.reference='postgres:latest';
 await assert.rejects(()=>run(d,{candidate:c}));
 assert.equal(d.events.length,0);
});
test('pre-existing run-owned resource is refused and not deleted',async()=>{
 const d=mock();d.items.set('network:'+runId,{type:'network',id:runId,owner:runId});
 const x=await run(d);
 assert.equal(x.status,'FAIL');
 // A baseline collision is not license to remove the pre-existing resource.
 assert.equal(d.items.size,1);
 assert.ok(!d.events.some(s=>s.startsWith('removeNetwork:')));
});
