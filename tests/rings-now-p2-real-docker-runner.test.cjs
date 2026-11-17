'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {runRealP2DockerLifecycle,validateLiveManifest}=require('./rings-now-p2-real-docker-runner.cjs');
const {createDockerCliAdapter,LABEL}=require('./rings-now-p2-g3-docker-cli-adapter.cjs');
const {createBoundedDockerCommand}=require('./rings-now-p2-g3-bounded-docker-command.cjs');
const current=require('./rings-now-p2-isolated-manifest.json');
const candidate=require('./rings-now-p2-g1-candidate-manifest.json');
const clone=x=>JSON.parse(JSON.stringify(x));
const runId='rn_p2_abcdefgh';
const clock=()=>{let n=0;return ()=>++n;};
function approvedFixture(){
 const x=clone(current);
 x.status='READY_FOR_REVIEW';x.checkoutCommit='a'.repeat(40);
 x.billingZeroAdditionalCost='VERIFIED_FOR_THIS_RUN';
 x.independentAudit='APPROVED_FOR_EXACT_HEAD';
 x.explicitExecutionApproval=true;
 for(const name of ['postgres','gotrue','postgrest'])
  x.images[name]=clone(candidate.images[name]);
 return x; // FAKE PERMISSION only for offline unit tests; not source of approval
}
function fakeDocker({failCreate=null,leaveContainer=false,spoof=false}={}){
 const owned=new Map(),argvs=[];
 const execFileImpl=(bin,argv,opts,cb)=>{
  argvs.push([bin,...argv]);
  assert.equal(bin,'docker');
  assert.equal(opts.shell,false);assert.deepEqual(opts.env,{});
  assert.equal(opts.timeout,15000);
  const [type,verb]=argv,id=argv.at(-1);
  let value='';
  try{
   if(verb==='ls'){
    value=[...owned.values()].filter(v=>v.type===type).map(v=>v.id).join('\n');
   }else if(verb==='inspect'){
    if(!owned.has(type+':'+id))throw Error('not found');
    const labels={[LABEL]:spoof?'rn_p2_wrongid00':runId};
    value=JSON.stringify({Name:type==='container'?'/'+id:id,
     Labels:labels,Config:{Labels:labels}});
   }else if(type==='network'&&verb==='create'){
    owned.set('network:'+id,{type:'network',id});value=id;
   }else if(type==='container'&&verb==='create'){
    const name=argv[argv.indexOf('--name')+1];
    owned.set('container:'+name,{type:'container',id:name});
    if(failCreate&&name.endsWith('_'+failCreate))throw Error('partial create');
    value=name;
   }else if(type==='container'&&verb==='start'){value=id;}
   else if(type==='container'&&verb==='stop'){value=id;}
   else if(type==='container'&&verb==='rm'){
    if(!leaveContainer)owned.delete('container:'+id);value=id;
   }else if(type==='network'&&verb==='rm'){
    owned.delete('network:'+id);value=id;
   }else throw Error('unexpected fake Docker command');
   cb(null,value,'');
  }catch(e){cb(e,'','');}
 };
 return {argvs,owned,commandFactory:()=>createBoundedDockerCommand({execFileImpl})};
}
const base={runId,nowMs:clock(),totalMs:10000,reserveMs:6000,verifyReserveMs:2000};
test('current BLOCKED manifest refuses before commandFactory, adapter or Docker',async()=>{
 let calls=0;
 const res=await runRealP2DockerLifecycle({...base,commandFactory:()=>{
  calls++;throw Error('should never access Docker');}});
 assert.equal(calls,0);assert.equal(res.status,'BLOCKED_NOT_RUN');
 assert.equal(res.attempted,false);assert.equal(res.realDockerInvoked,false);
 assert.equal(res.p2ExecutionAuthorized,false);
});
test('real active manifest gate rejects all evidence forgery shortcuts',()=>{
 const x=approvedFixture();assert.equal(validateLiveManifest(x).pass,true);
 for(const patch of [{billingZeroAdditionalCost:'NOT_VERIFIED'},
 {explicitExecutionApproval:false},{independentAudit:'PENDING'},
 {productionAccess:true},{checkoutCommit:null},{status:'BLOCKED_NOT_RUN'}]){
  assert.equal(validateLiveManifest({...x,...patch}).pass,false);
 }
});
test('real CLI-backed code path is connected with fake execFile only, no G3 proof',async()=>{
 const d=fakeDocker();
 const r=await runRealP2DockerLifecycle({
  ...base,nowMs:clock(),manifest:approvedFixture(),commandFactory:d.commandFactory});
 assert.equal(r.status,'DOCKER_CLI_LIFECYCLE_REPORTED_CLEAN_NOT_G3_PROOF');
 assert.equal(r.attempted,true);assert.equal(r.realDockerInvoked,true);
 assert.equal(d.owned.size,0);
 assert.equal(d.argvs.filter(x=>x[1]==='container'&&x[2]==='create').length,3);
 assert.ok(d.argvs.some(x=>x[1]==='network'&&x[2]==='rm'));
 assert.equal(r.resourceTerminationProven,false);
 assert.equal(r.serviceStartupVerified,false);
 assert.equal(r.g3Verified,false);assert.equal(r.actualP2Proven,false);
 assert.equal(r.p2ExecutionAuthorized,false);
});
test('after partial daemon create errors, real driver discovers and cleans scoped resources',async()=>{
 const d=fakeDocker({failCreate:'gotrue'});
 const r=await runRealP2DockerLifecycle({...base,nowMs:clock(),
  manifest:approvedFixture(),commandFactory:d.commandFactory});
 assert.notEqual(r.status,'DOCKER_CLI_LIFECYCLE_REPORTED_CLEAN_NOT_G3_PROOF');
 assert.equal(d.owned.size,0);
 assert.equal(r.g3Verified,false);
});
test('owner spoofing fails closed and does not perform destructive operations',async()=>{
 const d=fakeDocker({spoof:true});
 const r=await runRealP2DockerLifecycle({...base,nowMs:clock(),
  manifest:approvedFixture(),commandFactory:d.commandFactory});
 assert.equal(r.status,'FAIL_OR_NOT_PROVEN');
 assert.equal(r.resourceTerminationProven,false);
 assert.ok(!d.argvs.some(x=>['rm','stop'].includes(x[2])));
});
test('daemon container leak blocks success after reported cleanup commands',async()=>{
 const d=fakeDocker({leaveContainer:true});
 const r=await runRealP2DockerLifecycle({...base,nowMs:clock(),
  manifest:approvedFixture(),commandFactory:d.commandFactory});
 assert.equal(r.status,'FAIL_OR_NOT_PROVEN');
 assert.ok(r.remainingCliReportedResources>0);
 assert.equal(r.p2ExecutionAuthorized,false);
});
test('missing network/identity drift cannot be accepted',async()=>{
 const r=await runRealP2DockerLifecycle({...base,nowMs:clock(),
  manifest:{...approvedFixture(),images:{postgres:{reference:'postgres:latest',digest:'sha256:'+'f'.repeat(64)}}},
  commandFactory:()=>{throw Error('must not invoke')}});
 assert.equal(r.status,'BLOCKED_NOT_RUN');
});
test('a command executor exception fails without authorizing P2',async()=>{
 const r=await runRealP2DockerLifecycle({...base,nowMs:clock(),
  manifest:approvedFixture(),commandFactory:()=>async()=>{throw Error('CLI not available');}});
 assert.equal(r.status,'FAIL_OR_NOT_PROVEN');
 assert.equal(r.actualP2Proven,false);
});

test('forged approved fixture never selects default REAL execFile backend',async()=>{
 const r=await runRealP2DockerLifecycle({...base,nowMs:clock(),manifest:approvedFixture()});
 assert.equal(r.status,'BLOCKED_NOT_RUN');
 assert.equal(r.realDockerInvoked,false);
 assert.ok(r.preflightIssues.includes('noncanonical_real_backend_manifest'));
});

test('coordinator clock failure after network and containers triggers emergency owned cleanup',async()=>{
 const d=fakeDocker();
 let n=0;
 const result=await runRealP2DockerLifecycle({
  ...base,manifest:approvedFixture(),commandFactory:d.commandFactory,
  nowMs:()=>{n++;if(n===5)throw Error('monotonic clock failed');return n;}
 });
 assert.equal(result.status,'FAIL');
 assert.equal(result.coordinatorFailed,true);
 assert.equal(result.emergencyCleanupAttempted,true);
 assert.equal(result.emergencyCleanupStatus,'CLI_CLEAN_REPORTED');
 assert.equal(result.emergencyVerifyStatus,'CLI_EMPTY_REPORTED');
 assert.equal(d.owned.size,0);
 assert.ok(d.argvs.some(x=>x[1]==='container'&&x[2]==='rm'));
 assert.ok(d.argvs.some(x=>x[1]==='network'&&x[2]==='rm'));
 assert.equal(result.resourceTerminationProven,false);
 assert.equal(result.g3Verified,false);
});

test('coordinator failure with leaked container never promotes cleanup proof',async()=>{
 const d=fakeDocker({leaveContainer:true});
 let n=0;
 const result=await runRealP2DockerLifecycle({
  ...base,manifest:approvedFixture(),commandFactory:d.commandFactory,
  nowMs:()=>{n++;if(n===5)throw Error('clock failure');return n;}
 });
 assert.equal(result.status,'FAIL');
 assert.equal(result.emergencyCleanupAttempted,true);
 assert.equal(result.emergencyVerifyStatus,'FAIL');
 assert.ok(d.owned.size>0);
 assert.equal(result.p2ExecutionAuthorized,false);
});

test('failure before trusted empty baseline cannot delete unknown resources',async()=>{
 const d=fakeDocker();
 const result=await runRealP2DockerLifecycle({
  ...base,manifest:approvedFixture(),commandFactory:d.commandFactory,
  nowMs:()=>{throw Error('clock preflight failure');}
 });
 assert.equal(result.status,'FAIL');
 assert.equal(result.emergencyCleanupAttempted,false);
 assert.equal(result.emergencyCleanupStatus,'BASELINE_UNTRUSTED');
 assert.equal(d.argvs.length,0);
 assert.equal(result.g3Verified,false);
});

test('integrated runner passes ephemeral files to real adapter code and disposes',async()=>{
 const d=fakeDocker(),tracked={disposed:0};
 const runtimeFactory=()=>({
  envFiles:{postgres:'/tmp/rn-p2-abcdefghi/postgres.env',
   gotrue:'/tmp/rn-p2-abcdefghi/gotrue.env',
   postgrest:'/tmp/rn-p2-abcdefghi/postgrest.env'},
  dispose(){tracked.disposed++;}
 });
 const r=await runRealP2DockerLifecycle({...base,nowMs:clock(),
  manifest:approvedFixture(),commandFactory:d.commandFactory,runtimeFactory});
 assert.equal(r.status,'DOCKER_CLI_LIFECYCLE_REPORTED_CLEAN_NOT_G3_PROOF');
 assert.equal(tracked.disposed,1);
 const creates=d.argvs.filter(x=>x[1]==='container'&&x[2]==='create');
 assert.equal(creates.length,3);
 assert.ok(creates.every(x=>x.includes('--env-file')&&x.includes('--tmpfs')));
 assert.ok(creates.every(x=>!x.includes('--env')));
 assert.equal(d.owned.size,0);
 assert.equal(r.g3Verified,false);
});
test('emergency exception path always disposes ephemeral runtime',async()=>{
 const d=fakeDocker();let calls=0,disposed=0;
 const r=await runRealP2DockerLifecycle({...base,
  manifest:approvedFixture(),commandFactory:d.commandFactory,
  runtimeFactory:()=>({
   envFiles:{postgres:'/tmp/rn-p2-abcdefghi/postgres.env',
    gotrue:'/tmp/rn-p2-abcdefghi/gotrue.env',
    postgrest:'/tmp/rn-p2-abcdefghi/postgrest.env'},
   dispose(){disposed++;}
  }),
  nowMs:()=>{calls++;if(calls===5)throw Error('clock');return calls;}
 });
 assert.equal(r.status,'FAIL');assert.equal(disposed,1);
 assert.equal(d.owned.size,0);
});
test('blocked active manifest does not create an ephemeral runtime',async()=>{
 let created=0;
 const r=await runRealP2DockerLifecycle({...base,
  runtimeFactory:()=>{created++;throw Error('not allowed');}});
 assert.equal(r.status,'BLOCKED_NOT_RUN');
 assert.equal(created,0);
});

test('service startup orders PG readiness and SQL bootstrap before Auth/PostgREST',async()=>{
 const d=fakeDocker(),steps=[];
 const runtimeFactory=()=>({
  envFiles:Object.fromEntries(['postgres','gotrue','postgrest'].map(x=>
   [x,'/tmp/rn-p2-abcdefghi/'+x+'.env'])),
  bootstrapSqlFile:'/tmp/rn-p2-abcdefghi/authenticator.sql',
  dispose(){steps.push('dispose');}
 });
 const adapterFactory=({command})=>{
  const base=createDockerCliAdapter({command});
  return {...base,
   postgresReady:async()=>{steps.push('pgReady');return true;},
   bootstrapPostgres:async()=>{steps.push('sql');return 'CLI_BOOTSTRAP_REPORTED_NOT_SQL_PROOF';},
   initializeGoTrue:async()=>{steps.push('authMigrate');return 'CLI_GOTRUE_MIGRATE_REPORTED_NOT_AUTH_PROOF';}
  };
 };
 const r=await runRealP2DockerLifecycle({...base,nowMs:clock(),
  manifest:approvedFixture(),commandFactory:d.commandFactory,runtimeFactory,adapterFactory});
 assert.equal(r.status,'DOCKER_CLI_LIFECYCLE_REPORTED_CLEAN_NOT_G3_PROOF');
 assert.deepEqual(steps,['pgReady','sql','authMigrate','dispose']);
 const creates=d.argvs.filter(x=>x[1]==='container'&&x[2]==='create');
 assert.equal(creates.length,3);
 assert.equal(d.owned.size,0);
 assert.equal(r.g3Verified,false);
});
test('failed PG candidate bootstrap stops GoTrue/PostgREST creation and reconciles resources',async()=>{
 const d=fakeDocker(),steps=[];
 const runtimeFactory=()=>({
  envFiles:Object.fromEntries(['postgres','gotrue','postgrest'].map(x=>
   [x,'/tmp/rn-p2-abcdefghi/'+x+'.env'])),
  bootstrapSqlFile:'/tmp/rn-p2-abcdefghi/authenticator.sql',
  dispose(){steps.push('disposed');}
 });
 const adapterFactory=({command})=>{
  const base=createDockerCliAdapter({command});
  return {...base,
   postgresReady:async()=>true,
   bootstrapPostgres:async()=>{steps.push('sql');throw Error('SQL failed');},
   initializeGoTrue:async()=>{throw Error('must not migrate');}
  };
 };
 const r=await runRealP2DockerLifecycle({...base,nowMs:clock(),
  manifest:approvedFixture(),commandFactory:d.commandFactory,runtimeFactory,adapterFactory});
 assert.equal(r.status,'FAIL_OR_NOT_PROVEN');
 assert.deepEqual(steps,['sql','disposed']);
 assert.equal(d.argvs.filter(x=>x[1]==='container'&&x[2]==='create').length,1);
 assert.equal(d.owned.size,0);
 assert.equal(r.actualP2Proven,false);
});
