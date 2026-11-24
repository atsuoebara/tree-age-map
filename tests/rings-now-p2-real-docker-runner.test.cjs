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
test('canonical real backend remains blocked by checked-in manifest after retiring H2 wiring stop',async()=>{
 const result=await runRealP2DockerLifecycle({runId});
 assert.equal(current.status,'BLOCKED_NOT_RUN');
 assert.equal(current.explicitExecutionApproval,false);
 assert.equal(current.productionAccess,false);
 assert.equal(current.checkoutCommit,null);
 assert.equal(result.status,'BLOCKED_NOT_RUN');
 assert.equal(result.attempted,false);
 assert.equal(result.realDockerInvoked,false);
 assert.equal(result.p2ExecutionAuthorized,false);
 assert.ok(result.preflightIssues.includes('manifest_not_in_phase'));
 assert.ok(result.preflightIssues.includes('execution_approval_missing'));
 assert.ok(result.preflightIssues.includes('billing_not_verified'));
 assert.ok(result.preflightIssues.includes('checkout_commit_unpinned'));
});
test('redundant H2 wiring stop is absent but canonical manifest gate remains before runtime construction',()=>{
 const fs=require('node:fs');
 const src=fs.readFileSync(require.resolve('./rings-now-p2-real-docker-runner.cjs'),'utf8');
 assert.equal(src.includes('h2_original_gotrue_expiry_not_wired'),false);
 const gateAt=src.indexOf('if(!gate.pass||realBackendManifestMismatch)');
 const adapterAt=src.indexOf('const command=commandFactory()');
 assert.ok(gateAt>=0&&adapterAt>gateAt);
 assert.ok(src.includes('if(commandFactory===createBoundedDockerCommand){'));
 const workflow=fs.readFileSync(require('node:path').join(__dirname,'../.github/workflows/rings-now-p2-isolated-manual.yml'),'utf8');
 assert.ok(workflow.includes('if: ${{ false }}'));
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
   applySnapshotCandidate:async()=>{steps.push('snapshot');return 'CLI_SNAPSHOT_CANDIDATE_APPLIED_NOT_RLS_PROOF';},
   probeSqlRlsBoundary:async()=>{steps.push('sqlRls');return 'CLI_SQL_RLS_ASSERTIONS_REPORTED_NOT_HTTP_JWT_PROOF';},
   initializeGoTrue:async()=>{steps.push('authMigrate');return 'CLI_GOTRUE_HEALTH_REPORTED_NOT_AUTH_PROOF';}
  };
 };
 const r=await runRealP2DockerLifecycle({...base,nowMs:clock(),
  manifest:approvedFixture(),commandFactory:d.commandFactory,runtimeFactory,adapterFactory});
 assert.equal(r.status,'DOCKER_CLI_LIFECYCLE_REPORTED_CLEAN_NOT_G3_PROOF');
 assert.deepEqual(steps,['pgReady','sql','snapshot','sqlRls','authMigrate','dispose']);
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

test('snapshot SQL failure prevents GoTrue/PostgREST and cleans owned containers',async()=>{
 const d=fakeDocker(),steps=[];
 const runtimeFactory=()=>({
  envFiles:Object.fromEntries(['postgres','gotrue','postgrest'].map(x=>
   [x,'/tmp/rn-p2-abcdefghi/'+x+'.env'])),
  bootstrapSqlFile:'/tmp/rn-p2-abcdefghi/authenticator.sql',
  dispose(){steps.push('dispose');}
 });
 const adapterFactory=({command})=>{
  const driver=createDockerCliAdapter({command});
  return {...driver,
   postgresReady:async()=>true,
   bootstrapPostgres:async()=>{steps.push('bootstrap');},
   applySnapshotCandidate:async()=>{steps.push('snapshot');throw Error('snapshot mismatch');},
   initializeGoTrue:async()=>{throw Error('must not run migration');}
  };
 };
 const r=await runRealP2DockerLifecycle({...base,nowMs:clock(),
  manifest:approvedFixture(),commandFactory:d.commandFactory,runtimeFactory,adapterFactory});
 assert.equal(r.status,'FAIL_OR_NOT_PROVEN');
 assert.deepEqual(steps,['bootstrap','snapshot','dispose']);
 assert.equal(d.argvs.filter(x=>x[1]==='container'&&x[2]==='create').length,1);
 assert.equal(d.owned.size,0);
 assert.equal(r.g3Verified,false);assert.equal(r.actualP2Proven,false);
});

test('real runner directly requests signed isolated HTTP after all services start',async()=>{
 const d=fakeDocker(),steps=[];
 const runtimeFactory=()=>({
  envFiles:Object.fromEntries(['postgres','gotrue','postgrest'].map(x=>
   [x,'/tmp/rn-p2-abcdefghi/'+x+'.env'])),
  prepareHttpProbe(){steps.push('prepared');return '/tmp/rn-p2-abcdefghi/http-probe.req';},
  dispose(){steps.push('disposed');}
 });
 const adapterFactory=({command})=>{
  const driver=createDockerCliAdapter({command});
  return {...driver,probeInternalPostgrest:async({runId,requestFile})=>{
   assert.equal(runId,'rn_p2_abcdefgh');
   assert.ok(requestFile.endsWith('/http-probe.req'));
   steps.push('http');
   return {status:200,body:{status:'candidate_snapshot',rows:[]}};
  }};
 };
 const r=await runRealP2DockerLifecycle({...base,nowMs:clock(),
  manifest:approvedFixture(),commandFactory:d.commandFactory,
  runtimeFactory,adapterFactory});
 assert.equal(r.status,'DOCKER_CLI_LIFECYCLE_REPORTED_CLEAN_NOT_G3_PROOF');
 assert.deepEqual(steps,['prepared','http','disposed']);
 assert.equal(d.argvs.filter(x=>x[1]==='container'&&x[2]==='create').length,3);
 assert.equal(d.owned.size,0);
 assert.equal(r.g3Verified,false);assert.equal(r.actualP2Proven,false);
});
test('failed isolated HTTP authentication blocks PASS and cleans owned daemon resources',async()=>{
 const d=fakeDocker(),steps=[];
 const runtimeFactory=()=>({
  envFiles:Object.fromEntries(['postgres','gotrue','postgrest'].map(x=>
   [x,'/tmp/rn-p2-abcdefghi/'+x+'.env'])),
  prepareHttpProbe(){steps.push('prepared');return '/tmp/rn-p2-abcdefghi/http-probe.req';},
  dispose(){steps.push('disposed');}
 });
 const adapterFactory=({command})=>{
  const driver=createDockerCliAdapter({command});
  return {...driver,probeInternalPostgrest:async()=>{
   steps.push('401');return {status:401};
  }};
 };
 const r=await runRealP2DockerLifecycle({...base,nowMs:clock(),
  manifest:approvedFixture(),commandFactory:d.commandFactory,
  runtimeFactory,adapterFactory});
 assert.equal(r.status,'FAIL_OR_NOT_PROVEN');
 assert.deepEqual(steps,['prepared','401','disposed']);
 assert.equal(d.owned.size,0);
 assert.equal(r.g3Verified,false);assert.equal(r.actualP2Proven,false);
});

test('SQL RLS assertion failure prevents GoTrue/PostgREST startup and reconciles',async()=>{
 const d=fakeDocker(),steps=[];
 const runtimeFactory=()=>({
  envFiles:Object.fromEntries(['postgres','gotrue','postgrest'].map(x=>
   [x,'/tmp/rn-p2-abcdefghi/'+x+'.env'])),
  bootstrapSqlFile:'/tmp/rn-p2-abcdefghi/authenticator.sql',
  dispose(){steps.push('dispose');}
 });
 const adapterFactory=({command})=>{
  const driver=createDockerCliAdapter({command});
  return {...driver,
   postgresReady:async()=>true,
   bootstrapPostgres:async()=>{steps.push('bootstrap');},
   applySnapshotCandidate:async()=>{steps.push('snapshot');},
   probeSqlRlsBoundary:async()=>{steps.push('sqlRls');throw Error('1001 assertion failed');},
   initializeGoTrue:async()=>{throw Error('must not run migration');}
  };
 };
 const r=await runRealP2DockerLifecycle({...base,nowMs:clock(),
  manifest:approvedFixture(),commandFactory:d.commandFactory,runtimeFactory,adapterFactory});
 assert.equal(r.status,'FAIL_OR_NOT_PROVEN');
 assert.deepEqual(steps,['bootstrap','snapshot','sqlRls','dispose']);
 assert.equal(d.argvs.filter(x=>x[1]==='container'&&x[2]==='create').length,1);
 assert.equal(d.owned.size,0);
 assert.equal(r.g3Verified,false);
 assert.equal(r.actualP2Proven,false);
});

test('H1 runner wiring calls only run-owned adapter after all services, never logs JWT',async()=>{
 const {createHmac}=require('node:crypto');
 const d=fakeDocker(),events=[];
 const users={
  a:{email:'rn-p2-'+'1'.repeat(24)+'-a@example.invalid',password:'a'.repeat(64)},
  b:{email:'rn-p2-'+'2'.repeat(24)+'-b@example.invalid',password:'b'.repeat(64)}
 };
 const ids={a:'00000000-0000-4000-8000-000000000001',
  b:'00000000-0000-4000-8000-000000000002'};
 const jwt=(id)=>{
  const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  const input=enc({alg:'HS256'})+'.'+enc({
   sub:id,role:'authenticated',aud:'authenticated',iat:1700000000,exp:1700000300
  });
  return input+'.'+createHmac('sha256','OFFLINE_ONLY').update(input).digest('base64url');
 };
 const runtimeFactory=()=>({
  envFiles:Object.fromEntries(['postgres','gotrue','postgrest'].map(s=>
   [s,'/tmp/rn-p2-abcdefghi/'+s+'.env'])),
  h1Users:users,h1EphemeralDir:'/tmp/rn-p2-abcdefghi',
  dispose(){events.push('disposed');}
 });
 const adapterFactory=({command})=>{
  const a=createDockerCliAdapter({command});
  return {...a,probeInternalGoTrue:async({runId:id,caseId,request,ephemeralDir})=>{
   assert.equal(id,runId);
   assert.equal(ephemeralDir,'/tmp/rn-p2-abcdefghi');
   assert.ok(request.includes('Host: gotrue:9999'));
   assert.equal(d.owned.has('container:'+runId+'_postgrest'),true);
   events.push(caseId);
   const who=caseId.endsWith('_b')?'b':'a';
   if(caseId==='h1_bad_password')return {status:401};
   if(caseId.startsWith('h1_signup_'))return {status:200,body:{id:ids[who]}};
   return {status:200,body:{access_token:jwt(ids[who]),user:{id:ids[who]}}};
  }};
 };
 const result=await runRealP2DockerLifecycle({...base,nowMs:clock(),
  manifest:approvedFixture(),commandFactory:d.commandFactory,runtimeFactory,adapterFactory});
 assert.equal(result.status,'DOCKER_CLI_LIFECYCLE_REPORTED_CLEAN_NOT_G3_PROOF');
 assert.deepEqual(events,['h1_signup_a','h1_signin_a','h1_signup_b','h1_signin_b',
  'h1_bad_password','disposed']);
 const text=JSON.stringify(result);
 for(const secret of [users.a.email,users.a.password,jwt(ids.a)])
  assert.ok(!text.includes(secret),'no H1 secrets in result');
 assert.equal(result.g3Verified,false);assert.equal(result.actualP2Proven,false);
 assert.equal(d.owned.size,0);
});
test('failed H1 response makes runner fail closed and still cleans all owned resources',async()=>{
 const d=fakeDocker(),events=[];
 const runtimeFactory=()=>({
  envFiles:Object.fromEntries(['postgres','gotrue','postgrest'].map(s=>
   [s,'/tmp/rn-p2-abcdefghi/'+s+'.env'])),
  h1Users:{
   a:{email:'rn-p2-'+'1'.repeat(24)+'-a@example.invalid',password:'a'.repeat(64)},
   b:{email:'rn-p2-'+'2'.repeat(24)+'-b@example.invalid',password:'b'.repeat(64)}
  },
  h1EphemeralDir:'/tmp/rn-p2-abcdefghi',
  dispose(){events.push('disposed');}
 });
 const adapterFactory=({command})=>{
  const a=createDockerCliAdapter({command});
  return {...a,probeInternalGoTrue:async({caseId})=>{
   events.push(caseId);
   return {status:500};
  }};
 };
 const result=await runRealP2DockerLifecycle({...base,nowMs:clock(),
  manifest:approvedFixture(),commandFactory:d.commandFactory,runtimeFactory,adapterFactory});
 assert.equal(result.status,'FAIL_OR_NOT_PROVEN');
 assert.deepEqual(events,['h1_signup_a','disposed']);
 assert.equal(d.owned.size,0);
 assert.equal(result.g3Verified,false);assert.equal(result.actualP2Proven,false);
});

test('H2 runner uses owned seed then 7 HTTP cases, with synthetic expiry never promoted to G4',async()=>{
 const {createHmac}=require('node:crypto');
 const d=fakeDocker(),events=[];
 const A='12345678-1234-4234-8234-123456789abc';
 const B='87654321-4321-4321-8321-abcdef123456';
 const ids={a:A,b:B};
 const n=Math.floor(Date.now()/1000);
 const token=(sub,role='authenticated',expiry=n+3600)=>{
  const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  const data=encode({alg:'HS256'})+'.'+encode({
   sub,role,aud:'authenticated',iat:n-120,exp:expiry
  });
  return data+'.'+createHmac('sha256','OFFLINE_H2_ONLY').update(data).digest('base64url');
 };
 const runtimeFactory=()=>({
  envFiles:Object.fromEntries(['postgres','gotrue','postgrest'].map(s=>
   [s,'/tmp/rn-p2-abcdefghi/'+s+'.env'])),
  h1Users:{
   a:{email:'rn-p2-'+'1'.repeat(24)+'-a@example.invalid',password:'a'.repeat(64)},
   b:{email:'rn-p2-'+'2'.repeat(24)+'-b@example.invalid',password:'b'.repeat(64)}
  },
  h1EphemeralDir:'/tmp/rn-p2-abcdefghi',
  issueH2SignedTestToken({subject,role,expired}){
   events.push('signed-'+(expired?'expired':'denied'));
   return token(subject,role,expired?n-60:n+3600);
  },
  prepareHttpProbe(){throw Error('must not use synthetic empty-owner HTTP after H2 seeding');},
  dispose(){events.push('disposed');}
 });
 const adapterFactory=({command})=>{
  const driver=createDockerCliAdapter({command});
  return {...driver,
   probeInternalGoTrue:async({caseId})=>{
    events.push(caseId);
    if(caseId==='h1_bad_password')return {status:401};
    const who=caseId.endsWith('_b')?'b':'a';
    if(caseId.startsWith('h1_signup_'))return {status:201,body:{id:ids[who]}};
    return {status:200,body:{access_token:token(ids[who]),user:{id:ids[who]}}};
   },
   seedH2DisposableOwners:async({runId:id,sql,ownerA,ownerB})=>{
    assert.equal(id,runId);assert.equal(ownerA,A);assert.equal(ownerB,B);
    assert.ok(sql.includes('H2_REQUIRES_EMPTY_DISPOSABLE_TABLE'));
    events.push('seed');return {status:'ISOLATED_TWO_OWNERS_CLI_REPORTED'};
   },
   probeInternalH2:async({caseId,request,runId:id})=>{
    assert.equal(id,runId);assert.ok(request.includes('Host: postgrest:3000'));
    events.push(caseId);
    if(['h2_owner_a','h2_foreign_a','h2_owner_b'].includes(caseId)){
     const sub=caseId==='h2_owner_b'?B:A;
     return {status:200,body:{status:'candidate_snapshot',rows:[{
      id:caseId==='h2_owner_b'?2:1,user_id:sub,activity_date:'2026-11-18',
      started_at:'2026-11-18T00:00:00Z',distance_km:5,deleted_at:null
     }]}};
    }
    return {status:403};
   }
  };
 };
 const result=await runRealP2DockerLifecycle({
  ...base,nowMs:clock(),manifest:approvedFixture(),
  commandFactory:d.commandFactory,runtimeFactory,adapterFactory
 });
 assert.equal(result.status,'DOCKER_CLI_LIFECYCLE_REPORTED_CLEAN_NOT_G3_PROOF');
 assert.deepEqual(events.slice(0,5),['h1_signup_a','h1_signin_a',
  'h1_signup_b','h1_signin_b','h1_bad_password']);
 assert.deepEqual(events.slice(5,8),['seed','signed-expired','signed-denied']);
 assert.deepEqual(events.slice(8,15),[
  'h2_anonymous','h2_owner_a','h2_foreign_a','h2_owner_b',
  'h2_bad_signature','h2_expired_token','h2_no_rpc_grant'
 ]);
 assert.equal(events[15],'disposed');
 assert.equal(d.owned.size,0);
 assert.equal(result.g3Verified,false);
 assert.equal(result.actualP2Proven,false);
 assert.equal(result.p2ExecutionAuthorized,false);
 assert.ok(!JSON.stringify(result).includes(token(A)));
 assert.ok(!JSON.stringify(result).includes('OFFLINE_H2_ONLY'));
});
test('failed H2 seed prevents any H2 HTTP and still tears down owned resources',async()=>{
 const {createHmac}=require('node:crypto');
 const d=fakeDocker(),steps=[];
 const A='12345678-1234-4234-8234-123456789abc';
 const B='87654321-4321-4321-8321-abcdef123456';
 const n=Math.floor(Date.now()/1000);
 const jwt=sub=>{
  const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  const input=enc({alg:'HS256'})+'.'+enc({
   sub,role:'authenticated',aud:'authenticated',iat:n-120,exp:n+3600
  });
  return input+'.'+createHmac('sha256','OFFLINE').update(input).digest('base64url');
 };
 const runtimeFactory=()=>({
  envFiles:Object.fromEntries(['postgres','gotrue','postgrest'].map(s=>
   [s,'/tmp/rn-p2-abcdefghi/'+s+'.env'])),
  h1Users:{
   a:{email:'rn-p2-'+'1'.repeat(24)+'-a@example.invalid',password:'a'.repeat(64)},
   b:{email:'rn-p2-'+'2'.repeat(24)+'-b@example.invalid',password:'b'.repeat(64)}
  },
  h1EphemeralDir:'/tmp/rn-p2-abcdefghi',
  issueH2SignedTestToken(){steps.push('must_not_sign');throw Error('not allowed');},
  dispose(){steps.push('disposed');}
 });
 const adapterFactory=({command})=>({
  ...createDockerCliAdapter({command}),
  probeInternalGoTrue:async({caseId})=>{
   if(caseId==='h1_bad_password')return {status:401};
   const sub=caseId.endsWith('_b')?B:A;
   if(caseId.startsWith('h1_signup_'))return {status:201,body:{id:sub}};
   return {status:200,body:{access_token:jwt(sub),user:{id:sub}}};
  },
  seedH2DisposableOwners:async()=>{steps.push('seed_failed');return {status:'NOT_READY'};},
  probeInternalH2:async()=>{steps.push('FORBIDDEN_HTTP');throw Error('unexpected H2 HTTP');}
 });
 const result=await runRealP2DockerLifecycle({
  ...base,nowMs:clock(),manifest:approvedFixture(),
  commandFactory:d.commandFactory,runtimeFactory,adapterFactory
 });
 assert.equal(result.status,'FAIL_OR_NOT_PROVEN');
 assert.deepEqual(steps,['seed_failed','disposed']);
 assert.equal(d.owned.size,0);
 assert.equal(result.g4Verified,undefined);
 assert.equal(result.actualP2Proven,false);
});
