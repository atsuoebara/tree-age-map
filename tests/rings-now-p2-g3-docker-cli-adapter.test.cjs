'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createDockerCliAdapter,LABEL}=require('./rings-now-p2-g3-docker-cli-adapter.cjs');
const R='rn_p2_abcdefgh';
function fake(overrides={}){
 const calls=[],items=new Map();
 const name=(s)=>R+'_'+s;
 const container=(n)=>({Name:'/'+n,Config:{Labels:{[LABEL]:R}}});
 const network=(n)=>({Name:n,Labels:{[LABEL]:R}});
 function run({executable,argv,environment,shell,timeoutMs,captureLimitBytes}){
  calls.push([...argv]);
  assert.equal(executable,'docker');assert.deepEqual(environment,{});
  assert.equal(shell,false);assert.ok(timeoutMs>0&&timeoutMs<=15000);
  assert.equal(captureLimitBytes,65536);
  if(overrides.throwOn&&argv.includes(overrides.throwOn))throw Error('synthetic hang or CLI error');
  const k=argv[0],verb=argv[1];
  let out='';
  if(k==='container'&&verb==='ls')
   out=[...items.values()].filter(x=>x.kind==='container').map(x=>x.id).join('\n');
  else if(k==='network'&&verb==='ls')
   out=[...items.values()].filter(x=>x.kind==='network').map(x=>x.id).join('\n');
  else if(verb==='inspect'){
   const id=argv.at(-1);
   out=JSON.stringify(items.get(id)?.kind==='network'?network(id):container(id));
   if(overrides.forgeOwner)out=JSON.stringify({Name:id,Labels:{[LABEL]:'rn_p2_otherxxx'}});
  }
  else if(k==='network'&&verb==='create'){const id=argv.at(-1);items.set(id,{id,kind:'network'});out=id;}
  else if(k==='container'&&verb==='create'){
   const id=argv[argv.indexOf('--name')+1];items.set(id,{id,kind:'container'});out=id;
  }
  else if(k==='container'&&verb==='rm'){items.delete(argv.at(-1));}
  else if(k==='network'&&verb==='rm'){items.delete(argv.at(-1));}
  return Promise.resolve({exitCode:overrides.failCode||0,stdout:out});
 }
 return {calls,items,adapter:createDockerCliAdapter({command:run})};
}
const spec={name:R,owner:R,internal:true,attachable:false};
const c=(service)=>({name:R+'_'+service,owner:R,network:R,service,
 image:({postgres:'docker.io/library/postgres',gotrue:'docker.io/supabase/gotrue',
 postgrest:'docker.io/postgrest/postgrest'})[service]+'@sha256:'+'a'.repeat(64),
 platform:'linux/amd64',publishPorts:false,privileged:false,readOnlyRootfs:true,
 persistentVolumes:false,environment:'SYNTHETIC_EMPTY'});
test('constructing adapter does not invoke Docker',()=>{
 const d=fake();assert.equal(d.calls.length,0);
 assert.equal(d.adapter.evidenceKind,'DOCKER_CLI_ADAPTER_NOT_ADMITTED');
});
test('driver needs an explicitly injected executor',()=>{
 assert.throws(()=>createDockerCliAdapter());
});
test('network/container commands are scoped without ports, secrets or volume mounts',async()=>{
 const d=fake();await d.adapter.createNetwork(spec);
 for(const service of ['postgres','gotrue','postgrest']){
  await d.adapter.createContainer(c(service));await d.adapter.startContainer(R+'_'+service);
 }
 const all=await d.adapter.listOwned(R);
 assert.equal(all.length,4);
 for(const call of d.calls){
  assert.ok(!call.some(a=>/^(-p|--publish|--volume|--mount|--privileged|--env-file)$/.test(a)));
  assert.ok(!call.includes('--env'));
  assert.ok(!call.includes('--userns=host'));
 }
 const create=d.calls.find(x=>x[0]==='container'&&x[1]==='create');
 assert.ok(create.includes('--read-only'));assert.ok(create.includes('--cap-drop'));
 assert.ok(create.includes('--security-opt'));
 assert.ok(d.calls.some(x=>x[0]==='network'&&x.includes('--internal')));
});
test('cleanup commands target only label-verified run-owned resources',async()=>{
 const d=fake();await d.adapter.createNetwork(spec);
 await d.adapter.createContainer(c('postgres'));
 await d.adapter.stopContainer(R+'_postgres');
 await d.adapter.removeContainer(R+'_postgres');
 await d.adapter.removeNetwork(R);
 assert.deepEqual(await d.adapter.listOwned(R),[]);
});
test('spoofed resource owner blocks removal before command',async()=>{
 const d=fake({forgeOwner:true});
 const before=d.calls.length;
 await assert.rejects(()=>d.adapter.removeContainer(R+'_postgres'));
 assert.ok(!d.calls.slice(before).some(x=>x.includes('rm')));
});
test('wrong runId and arbitrary container names rejected',async()=>{
 const d=fake();
 for(const bad of ['../','docker.io','rn_p2_SHORT','rn_p2_abcdefgh;rm']){
  await assert.rejects(()=>d.adapter.listOwned(bad));
 }
 await assert.rejects(()=>d.adapter.startContainer('production_db'));
 await assert.rejects(()=>d.adapter.removeNetwork('my-network'));
});
test('unapproved images, privileges, published ports and volumes rejected before create',async()=>{
 for(const patch of [{image:'postgres:latest'},{publishPorts:true},
 {privileged:true},{persistentVolumes:true},{environment:'REAL_ENV'},
 {readOnlyRootfs:false},{name:'production'}]){
  const d=fake(),modified={...c('postgres'),...patch};
  await assert.rejects(()=>d.adapter.createContainer(modified));
  assert.equal(d.calls.length,0);
 }
});
test('CLI nonzero exit and thrown executor do not become success',async()=>{
 const a=fake({failCode:127});
 await assert.rejects(()=>a.adapter.listOwned(R));
 const b=fake({throwOn:'ls'});
 await assert.rejects(()=>b.adapter.listOwned(R));
});
test('unknown inspect identity and label prevent false trust',async()=>{
 const d=fake();await d.adapter.createNetwork(spec);
 const bad=fake({forgeOwner:true});
 await assert.rejects(()=>bad.adapter.createNetwork(spec));
});
test('empty-list vs missing-container behavior is never inferred as verified real G3',async()=>{
 const d=fake();
 assert.deepEqual(await d.adapter.listOwned(R),[]);
 assert.equal(d.adapter.evidenceKind,'DOCKER_CLI_ADAPTER_NOT_ADMITTED');
});

test('ephemeral service config uses env-file and tmpfs without argv credentials',async()=>{
 const d=fake();await d.adapter.createNetwork(spec);
 for(const service of ['postgres','gotrue','postgrest']){
  await d.adapter.createContainer({...c(service),
   environment:'EPHEMERAL_SERVICE_ENV_FILE',
   runtime:{envFile:'/tmp/rn-p2-abcdefghi/'+service+'.env',networkOnly:true}});
 }
 const created=d.calls.filter(x=>x[0]==='container'&&x[1]==='create');
 assert.equal(created.length,3);
 for(const args of created){
  assert.ok(args.includes('--env-file'));
  assert.ok(args.includes('--tmpfs'));
  assert.ok(!args.includes('--env'));
  assert.ok(!args.includes('--publish'));
  assert.ok(!args.some(x=>x.includes('JWT_SECRET=')||x.includes('POSTGRES_PASSWORD=')));
 }
 const pg=created.find(x=>x.includes(R+'_postgres'));
 assert.ok(pg.includes('/var/lib/postgresql/data:rw,nosuid,nodev,size=128m'));
});
test('reject invalid env-file location and wrong service file before Docker',async()=>{
 const invalid=['/etc/passwd','/tmp/rn-p2-abcdefghi/gotrue.env',
  '/tmp/rn-p2-abcdefghi/postgres.env;rm','/tmp/rn-p2-abc/postgres.env'];
 for(const file of invalid){
  const d=fake();
  await assert.rejects(()=>d.adapter.createContainer({...c('postgres'),
   environment:'EPHEMERAL_SERVICE_ENV_FILE',
   runtime:{envFile:file,networkOnly:true}}));
  assert.equal(d.calls.length,0);
 }
});

test('bootstrap applies exact candidate SQL before authenticator and GoTrue migration',async()=>{
 const {createEphemeralP2Runtime}=require('./rings-now-p2-ephemeral-service-runtime.cjs');
 const runtime=createEphemeralP2Runtime(),d=fake();
 try{
  await d.adapter.createNetwork(spec);
  await d.adapter.createContainer({...c('postgres'),
   environment:'EPHEMERAL_SERVICE_ENV_FILE',
   runtime:{envFile:runtime.envFiles.postgres,networkOnly:true}});
  assert.equal(await d.adapter.postgresReady(R),true);
  const outcome=await d.adapter.bootstrapPostgres({
   runId:R,authenticatorSqlFile:runtime.bootstrapSqlFile});
  assert.equal(outcome,'CLI_BOOTSTRAP_REPORTED_NOT_SQL_PROOF');
  const copies=d.calls.filter(x=>x[0]==='container'&&x[1]==='cp');
  assert.equal(copies.length,3);
  const scripts=d.calls.filter(x=>x[0]==='container'&&x[1]==='exec'&&x.includes('psql'));
  assert.equal(scripts.length,2);
  assert.ok(scripts[0].includes('/tmp/rn-p2/fixtures/rings-now-p2-isolated-schema-v2-CANDIDATE.sql'));
  assert.ok(scripts[1].includes('/tmp/rn-p2/authenticator.sql'));
  assert.ok(scripts.every(x=>x.includes('ON_ERROR_STOP=1')));
  const all=d.calls.flat().join(' ');
  const sql=require('node:fs').readFileSync(runtime.bootstrapSqlFile,'utf8');
  const secret=sql.match(/PASSWORD '([a-f0-9]{64})'/)[1];
  assert.ok(!all.includes(secret));
  assert.ok(!d.calls.some(x=>x.some(z=>z==='--env'||z==='--publish')));
  await d.adapter.createContainer({...c('gotrue'),
   environment:'EPHEMERAL_SERVICE_ENV_FILE',
   runtime:{envFile:runtime.envFiles.gotrue,networkOnly:true}});
  assert.equal(await d.adapter.initializeGoTrue(R),
   'CLI_GOTRUE_MIGRATE_REPORTED_NOT_AUTH_PROOF');
  assert.ok(d.calls.some(x=>x.includes('migrate')));
 }finally{runtime.dispose();}
});
test('bootstrap rejects a non-run-owned SQL path before any Docker bootstrap command',async()=>{
 const d=fake();await d.adapter.createNetwork(spec);
 const before=d.calls.length;
 await assert.rejects(()=>d.adapter.bootstrapPostgres({
  runId:R,authenticatorSqlFile:'/etc/postgres.conf'}));
 assert.equal(d.calls.length,before);
});
