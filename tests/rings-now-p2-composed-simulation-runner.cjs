'use strict';
// Rings Now P2 composed IN-MEMORY simulation runner. No Docker daemon,
// Actions, DB, HTTP, SQL or real P2 resources are accessible from this module.
// A fixed fake execFile feeds the existing bounded Docker command and adapter;
// never pass the real execFile to this runner.
const assert=require('node:assert/strict');
const {runSyntheticP2Integration}=require('./rings-now-p2-synthetic-stage-coordinator.cjs');
const {runG3WatchdogSyntheticIntegration}=require('./rings-now-p2-g3-watchdog-integration.cjs');
const {runG3SyntheticDockerLifecycle}=require('./rings-now-p2-g3-docker-lifecycle.cjs');
const {createDockerCliAdapter,LABEL}=require('./rings-now-p2-g3-docker-cli-adapter.cjs');
const {createBoundedDockerCommand}=require('./rings-now-p2-g3-bounded-docker-command.cjs');
const candidate=require('./rings-now-p2-g1-candidate-manifest.json');
const liveManifest=require('./rings-now-p2-isolated-manifest.json');
const RUN_ID='rn_p2_composed001';
const MODES=Object.freeze(['success','failure','hang','ignore-term']);
function inventory(){
 const runId='test_run_composed001';
 return {
  kind:'SYNTHETIC_RESOURCE_INVENTORY',source:'INJECTED_TEST_INVENTORY',
  realResourcesObserved:false,executionApproval:false,checkoutCommit:'a'.repeat(40),
  runId,productionAccess:false,billingVerified:false,g1Verified:false,
  cleanupAttempted:true,cleanupStatus:'CLEAN',verificationAttempted:true,
  verificationStatus:'EMPTY',expectedServices:['postgres','gotrue','postgrest'],
  before:[],created:[
   {id:'pg',type:'container',owner:runId,service:'postgres'},
   {id:'gt',type:'container',owner:runId,service:'gotrue'},
   {id:'rest',type:'container',owner:runId,service:'postgrest'},
   {id:'net',type:'network',owner:runId}],after:[]
 };
}
function fakeExecFile({faults={},events,remaining}){
 // This is the only CLI backend for this composed runner. It is in-memory;
 // no imported child_process, shell, daemon, filesystem, network, or env.
 const owned=new Map();
 const types=new Set(['container','network']);
 function item(type,name){return owned.get(type+':'+name);}
 function respond(cmd,argv,options,cb){
  events.push(Object.freeze({command:cmd,argv:[...argv]}));
  try {
   assert.equal(cmd,'docker');
   assert.equal(options.shell,false);assert.deepEqual(options.env,{});
   assert.equal(options.timeout,15000);assert.equal(options.killSignal,'SIGKILL');
   const [type,verb]=argv;
   assert.ok(types.has(type),'not a simulated Docker command');
   const id=argv[argv.length-1];
   if(faults.timeoutOn===type+':'+verb)
    return cb(Error('simulated timeout'),'', '');
   if(verb==='ls'){
    const names=[...owned.values()].filter(x=>x.type===type).map(x=>x.id);
    return cb(null,names.join('\n'),'');
   }
   if(verb==='inspect'){
    const x=item(type,id);
    if(!x)return cb(Error('not found'),'','');
    const labels={[LABEL]:faults.spoofOwner?'rn_p2_foreign12':RUN_ID};
    return cb(null,JSON.stringify({Name:type==='container'?'/'+id:id,
     Labels:labels,Config:{Labels:labels}}),'');
   }
   if(type==='network'&&verb==='create'){
    assert.ok(argv.includes('--internal'));
    if(owned.has('network:'+id))return cb(Error('collision'),'','');
    owned.set('network:'+id,{type,id});
    return cb(null,id,'');
   }
   if(type==='container'&&verb==='create'){
    assert.ok(argv.includes('--read-only'));
    const name=argv[argv.indexOf('--name')+1];
    assert.ok(name&&name.startsWith(RUN_ID+'_'));
    if(owned.has('container:'+name))return cb(Error('collision'),'','');
    owned.set('container:'+name,{type:'container',id:name});
    if(faults.partialCreateOn&&name.endsWith('_'+faults.partialCreateOn))
     return cb(Error('create returned error after success'),'','');
    return cb(null,name,'');
   }
   if(type==='container'&&verb==='start'){
    if(faults.startFailureOn&&id.endsWith('_'+faults.startFailureOn))
     return cb(Error('start failure'),'','');
    return cb(null,id,'');
   }
   if(type==='container'&&verb==='stop')return cb(null,id,'');
   if(type==='container'&&verb==='rm'){
    if(!faults.leakContainer)owned.delete('container:'+id);
    return cb(null,id,'');
   }
   if(type==='network'&&verb==='rm'){
    owned.delete('network:'+id);
    return cb(null,id,'');
   }
   return cb(Error('unhandled simulated argv'),'','');
  }catch(e){return cb(e,'','');}
 }
 remaining.count=()=>owned.size;
 return respond;
}
function clock(){let ticks=0;return ()=>++ticks;}
function fakeChildRunner(failure){
 return async ({script,args,timeoutMs,env})=>{
  assert.ok(script.endsWith('/rings-now-p2-process-watchdog-fixture.cjs'));
  assert.deepEqual(env,{});
  assert.ok(timeoutMs>0);
  const mode=args[0];
  if(failure===mode||mode==='failure'||mode==='hang'||mode==='ignore-term')return {status:'FAIL',timedOut:true,
   childClosed:true,spawnError:null,termSent:true,killSent:true};
  return {status:'PASS',timedOut:false,childClosed:true,spawnError:null};
 };
}
async function runComposedP2Simulation({
 faults={},stageModes={execute:'success',cleanup:'success',verify:'success'},
 inventoryOverride=null,childFailure=null
}={}){
 assert.ok(faults&&typeof faults==='object'&&!Array.isArray(faults));
 assert.ok(stageModes&&typeof stageModes==='object'&&!Array.isArray(stageModes));
 for(const key of ['execute','cleanup','verify'])
  assert.ok(MODES.includes(stageModes[key]),'only synthetic stage modes accepted');
 const events=[],remaining={count:()=>null};
 const execFileImpl=fakeExecFile({faults,events,remaining});
 // #200 bounded command and CLI adapter are both used with fixed in-memory
 // executor, so this runner cannot invoke the actual Docker binary.
 const command=createBoundedDockerCommand({execFileImpl});
 const adapter=createDockerCliAdapter({command});
 assert.equal(adapter.evidenceKind,'DOCKER_CLI_ADAPTER_NOT_ADMITTED');
 // A fake command adapter is still a synthetic driver, not evidence that a
 // real CLI adapter has been admitted to #199's real-resource boundary.
 const driver=Object.freeze({
  evidenceKind:'INJECTED_SYNTHETIC_DRIVER',
  listOwned:id=>adapter.listOwned(id),
  createNetwork:s=>adapter.createNetwork(s),
  createContainer:s=>adapter.createContainer(s),
  startContainer:id=>adapter.startContainer(id),
  stopContainer:id=>adapter.stopContainer(id),
  removeContainer:id=>adapter.removeContainer(id),
  removeNetwork:id=>adapter.removeNetwork(id)
 });
 const stageOptions={
  modes:stageModes,nowMs:clock(),totalMs:1000,reserveMs:400,
  verifyReserveMs:150,graceMs:25,childRunner:fakeChildRunner(childFailure)
 };
 // #188 and #198: two existing synthetic stage coordinators, both wired.
 const stage188=await runSyntheticP2Integration({...stageOptions,nowMs:clock()});
 const stage198=await runG3WatchdogSyntheticIntegration({
  ...stageOptions,nowMs:clock(),inventory:inventoryOverride||inventory()
 });
 // #199 lifecycle with #200 actual adapter code, but mock execFile only.
 // Try lifecycle and cleanup even when a synthetic stage has failed.
 const lifecycle=await runG3SyntheticDockerLifecycle({
  driver,runId:RUN_ID,candidate,liveManifest
 });
 const consistent=stage188.status==='PASS'&&
  stage198.status==='SYNTHETIC_PIPELINE_CONSISTENT_NOT_REAL_PROOF'&&
  lifecycle.status==='SYNTHETIC_LIFECYCLE_CONSISTENT_NOT_REAL_PROOF'&&
  remaining.count()===0;
 const failed=[stage188.status,stage198.status,lifecycle.status].includes('FAIL');
 return Object.freeze({
  status:consistent?'COMPOSED_SYNTHETIC_COMPONENTS_CONSISTENT_NOT_REAL_P2':
   failed?'FAIL':'BLOCKED',
  evidenceKind:'IN_MEMORY_DOCKER_CLI_WITH_SYNTHETIC_NODE_STAGES',
  connections:Object.freeze(['188_stage_budget','198_watchdog_inventory',
   '199_lifecycle_cleanup','200_cli_adapter','200_bounded_cli']),
  stage188Status:stage188.status,stage198Status:stage198.status,
  lifecycleStatus:lifecycle.status,inventoryStatus:stage198.inventoryStatus,
  events:Object.freeze(events),remainingFakeResources:remaining.count(),
  g1Verified:false,g2Verified:false,g3Verified:false,g4Verified:false,
  actualResourcesVerified:false,resourceTerminationProven:false,
  actualP2Proven:false,p2ExecutionAuthorized:false,
  realDockerInvoked:false,realAuthJwtTested:false
 });
}
module.exports={runComposedP2Simulation};
