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
 function run({executable,argv,environment,shell,timeoutMs,captureLimitBytes,attachStdin,stdinBytes}){
  calls.push([...argv]);
  if(attachStdin){assert.ok(Buffer.isBuffer(stdinBytes));assert.ok(stdinBytes.length>0);assert.equal(argv[2],'-i');}
  else assert.equal(stdinBytes,undefined);
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
  else if(k==='container'&&verb==='exec'&&argv.includes('/tmp/rn-p2/http-probe.bash')){out=overrides.httpWire||'';}
  else if(k==='container'&&verb==='exec'&&argv.includes('/tmp/rn-p2/gotrue-h1.bash')){out=overrides.gotrueWire||'';}
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
 const caps=args=>args.flatMap((v,i)=>v==='--cap-add'?[args[i+1]]:[]);
 assert.deepEqual(caps(pg),['CHOWN','DAC_OVERRIDE','SETGID','SETUID']);
 for(const args of created.filter(x=>x!==pg))assert.deepEqual(caps(args),[]);
 assert.ok(created.every(x=>x.includes('--read-only')&&x.includes('ALL')&&x.includes('no-new-privileges')));
 await d.adapter.postgresReady(R);
 assert.deepEqual(d.calls.at(-1),['container','exec',R+'_postgres','pg_isready','-h','127.0.0.1','-U','postgres','-d','rings_now_p2']);
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
  const copies=d.calls.filter(x=>x[0]==='container'&&x[1]==='exec'&&x[2]==='-i');
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
   'CLI_GOTRUE_HEALTH_REPORTED_NOT_AUTH_PROOF');
  assert.ok(d.calls.some(x=>x[0]==='container'&&x[1]==='exec'&&x[2]===R+'_postgres'&&x[3]==='/bin/bash'&&x[4]==='-ec'&&x[5].includes('/dev/tcp/gotrue/9999')&&x[5].includes('GET /health')));
  assert.ok(!d.calls.some(x=>x.includes('migrate')));
 }finally{runtime.dispose();}
});
test('bootstrap rejects a non-run-owned SQL path before any Docker bootstrap command',async()=>{
 const d=fake();await d.adapter.createNetwork(spec);
 const before=d.calls.length;
 await assert.rejects(()=>d.adapter.bootstrapPostgres({
  runId:R,authenticatorSqlFile:'/etc/postgres.conf'}));
 assert.equal(d.calls.length,before);
});

test('snapshot candidate uses exact audited SQL and owner-checked disposable PostgreSQL',async()=>{
 const d=fake();await d.adapter.createNetwork(spec);
 await d.adapter.createContainer(c('postgres'));
 const out=await d.adapter.applySnapshotCandidate(R);
 assert.equal(out,'CLI_SNAPSHOT_CANDIDATE_APPLIED_NOT_RLS_PROOF');
 const cp=d.calls.filter(a=>a[0]==='container'&&a[1]==='exec'&&a[2]==='-i');
 assert.equal(cp.length,1);
 assert.equal(cp[0][3],R+'_postgres');
 assert.equal(cp[0].at(-1),'/tmp/rn-p2/rings-now-single-statement-snapshot-CANDIDATE.sql');
 const apply=d.calls.filter(a=>a[0]==='container'&&a[1]==='exec'&&a.includes('psql'));
 assert.equal(apply.length,1);
 assert.ok(apply[0].includes('ON_ERROR_STOP=1'));
 assert.ok(apply[0].includes('/tmp/rn-p2/rings-now-single-statement-snapshot-CANDIDATE.sql'));
});
test('snapshot SQL owner spoof forbids candidate cp and psql',async()=>{
 const d=fake({forgeOwner:true});
 await assert.rejects(()=>d.adapter.applySnapshotCandidate(R));
 assert.ok(!d.calls.some(a=>a.includes('-i')||a.includes('psql')));
});
test('snapshot SQL cannot target a foreign run identifier',async()=>{
 const d=fake();
 await assert.rejects(()=>d.adapter.applySnapshotCandidate('production'));
 assert.equal(d.calls.length,0);
});

test('run-owned Docker-internal HTTP probe copies private token and uses no ports',async()=>{
 const {createEphemeralP2Runtime}=require('./rings-now-p2-ephemeral-service-runtime.cjs');
 const json='{"status":"candidate_snapshot","rows":[]}';
 const wire='HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: '+
  Buffer.byteLength(json)+'\r\nConnection: close\r\n\r\n'+json;
 const runtime=createEphemeralP2Runtime(),d=fake({httpWire:wire});
 try{
  await d.adapter.createNetwork(spec);
  await d.adapter.createContainer(c('postgres'));
  const req=runtime.prepareHttpProbe();
  const result=await d.adapter.probeInternalPostgrest({runId:R,requestFile:req});
  assert.deepEqual(result,{status:200,body:{status:'candidate_snapshot',rows:[]}});
  const cps=d.calls.filter(x=>x[0]==='container'&&x[1]==='exec'&&x[2]==='-i');
  assert.equal(cps.length,2);
  assert.ok(cps.some(x=>x[3]===R+'_postgres'&&x.at(-1)==='/tmp/rn-p2/http-probe.req'));
  assert.ok(cps.some(x=>x[3]===R+'_postgres'&&x.at(-1)==='/tmp/rn-p2/http-probe.bash'));
  const exec=d.calls.find(x=>x[0]==='container'&&x[1]==='exec'&&x[2]!=='-i'&&x.includes('/tmp/rn-p2/http-probe.bash'));
  assert.deepEqual(exec,['container','exec',R+'_postgres','/bin/bash','/tmp/rn-p2/http-probe.bash']);
  const tok=require('node:fs').readFileSync(req,'utf8')
   .match(/Authorization: Bearer ([A-Za-z0-9_.-]+)/)[1];
  assert.ok(!d.calls.flat().join(' ').includes(tok),'JWT must never appear in argv');
  assert.ok(!d.calls.flat().some(x=>x==='--publish'||x==='--env'));
 }finally{runtime.dispose();}
});
test('Docker-internal HTTP rejects invalid request path and forged run owner',async()=>{
 const fakeOwner=fake({forgeOwner:true});
 const {createEphemeralP2Runtime}=require('./rings-now-p2-ephemeral-service-runtime.cjs');
 const r=createEphemeralP2Runtime();
 try{
  const req=r.prepareHttpProbe();
  await assert.rejects(()=>fakeOwner.adapter.probeInternalPostgrest({runId:R,requestFile:req}));
  assert.ok(!fakeOwner.calls.some(x=>x[0]==='container'&&x[1]==='exec'&&x[2]==='-i'));
  const other=fake();
  await assert.rejects(()=>other.adapter.probeInternalPostgrest({runId:R,requestFile:'/etc/passwd'}));
  assert.equal(other.calls.length,0);
 }finally{r.dispose();}
});
test('Docker-internal HTTP returns non-200 without body and never claims JWT proof',async()=>{
 const {createEphemeralP2Runtime}=require('./rings-now-p2-ephemeral-service-runtime.cjs');
 const r=createEphemeralP2Runtime();
 const d=fake({httpWire:'HTTP/1.1 401 Unauthorized\r\nContent-Length: 6\r\n\r\nsecret'});
 try{
  await d.adapter.createNetwork(spec);await d.adapter.createContainer(c('postgres'));
  const res=await d.adapter.probeInternalPostgrest({runId:R,requestFile:r.prepareHttpProbe()});
  assert.deepEqual(res,{status:401});assert.equal('body' in res,false);
 }finally{r.dispose();}
});

test('Docker-internal service DNS aliases match private runtime environment hostnames',async()=>{
 const d=fake();await d.adapter.createNetwork(spec);
 for(const service of ['postgres','gotrue','postgrest'])
  await d.adapter.createContainer(c(service));
 const cs=d.calls.filter(x=>x[0]==='container'&&x[1]==='create');
 assert.equal(cs.length,3);
 for(const service of ['postgres','gotrue','postgrest']){
  const x=cs.find(x=>x.includes(R+'_'+service));
  assert.equal(x[x.indexOf('--network-alias')+1],service);
  assert.equal(x[x.indexOf('--network')+1],R);
  assert.ok(!x.includes('--publish')&&!x.includes('-p'));
 }
});

test('SQL RLS probe copies only checksum-pinned candidate to owned disposable postgres',async()=>{
 const d=fake();await d.adapter.createNetwork(spec);
 await d.adapter.createContainer(c('postgres'));
 const r=await d.adapter.probeSqlRlsBoundary(R);
 assert.equal(r,'CLI_SQL_RLS_ASSERTIONS_REPORTED_NOT_HTTP_JWT_PROOF');
 const copies=d.calls.filter(x=>x[0]==='container'&&x[1]==='exec'&&x[2]==='-i');
 assert.equal(copies.length,1);
 assert.equal(copies[0][3],R+'_postgres');
 assert.equal(copies[0].at(-1),'/tmp/rn-p2/fixtures/rings-now-p2-sql-rls-assertions-CANDIDATE.sql');
 const sqls=d.calls.filter(x=>x[0]==='container'&&x[1]==='exec'&&x.includes('psql'));
 assert.equal(sqls.length,1);assert.ok(sqls[0].includes('ON_ERROR_STOP=1'));
 assert.ok(sqls[0].includes('/tmp/rn-p2/fixtures/rings-now-p2-sql-rls-assertions-CANDIDATE.sql'));
});
test('SQL RLS probe owner mismatch and run mismatch cannot execute cp/psql',async()=>{
 const bad=fake({forgeOwner:true});
 await assert.rejects(()=>bad.adapter.probeSqlRlsBoundary(R));
 assert.ok(!bad.calls.some(x=>x[0]==='container'&&['cp','exec'].includes(x[1])));
 const other=fake();
 await assert.rejects(()=>other.adapter.probeSqlRlsBoundary('production_db'));
 assert.equal(other.calls.length,0);
});
test('candidate SQL RLS probe structure is rollback-only with 1000/1001 and anon checks',()=>{
 const fs=require('node:fs');
 const path=require('node:path');
 const s=fs.readFileSync(path.resolve(__dirname,'fixtures/rings-now-p2-sql-rls-assertions-CANDIDATE.sql'),'utf8');
 assert.ok(s.includes('BEGIN;')&&s.includes('ROLLBACK;'));
 assert.ok(s.includes('generate_series(1,1000)'));
 assert.ok(s.includes('P2_BOUNDARY_1001_NOT_BLOCKED'));
 assert.ok(s.includes('P2_ANON_RPC_EXECUTE_NOT_DENIED'));
 assert.ok(s.includes('P2_CONFLICTING_SUB_CLAIM_NOT_BLOCKED'));
 assert.ok(!s.includes('COMMIT;'));
});

test('isolated H1 private HTTP uses pinned Bash, run label and file-only secrets',async()=>{
 const {createEphemeralP2Runtime}=require('./rings-now-p2-ephemeral-service-runtime.cjs');
 const {buildGoTrueRequest}=require('./rings-now-p2-h1-gotrue-http.cjs');
 const runtime=createEphemeralP2Runtime();
 const {randomBytes}=require('node:crypto');
 const users={
  a:{email:'rn-p2-'+randomBytes(12).toString('hex')+'-a@example.invalid',password:randomBytes(32).toString('hex')},
  b:{email:'rn-p2-'+randomBytes(12).toString('hex')+'-b@example.invalid',password:randomBytes(32).toString('hex')}
 };
 const body=JSON.stringify({access_token:'mock.only.not-a-real-token',user:{id:'00000000-0000-4000-8000-000000000001'}});
 const wire='HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: '+Buffer.byteLength(body)+'\r\n\r\n'+body;
 const d=fake({gotrueWire:wire});
 try{
  await d.adapter.createNetwork(spec);
  await d.adapter.createContainer(c('postgres'));
  const req=buildGoTrueRequest('h1_signin_a',users);
  const result=await d.adapter.probeInternalGoTrue({runId:R,caseId:'h1_signin_a',request:req,
   ephemeralDir:require('node:path').dirname(runtime.envFiles.gotrue)});
  assert.equal(result.status,200);
  assert.equal(result.body.user.id,'00000000-0000-4000-8000-000000000001');
  const calls=d.calls.flat().join(' ');
  assert.ok(!calls.includes(users.a.email));
  assert.ok(!calls.includes(users.a.password));
  assert.ok(!calls.includes(req));
  assert.ok(!calls.includes('--publish')&&!calls.includes('--env'));
  assert.ok(d.calls.some(x=>x.includes('/tmp/rn-p2/gotrue-h1.bash')));
  assert.equal(require('node:fs').existsSync(require('node:path').join(
   require('node:path').dirname(runtime.envFiles.gotrue),'gotrue-h1.req')),false);
 }finally{runtime.dispose();}
});
test('isolated H1 transport rejects foreign run owner and invalid request before secret copy',async()=>{
 const {createEphemeralP2Runtime}=require('./rings-now-p2-ephemeral-service-runtime.cjs');
 const {buildGoTrueRequest}=require('./rings-now-p2-h1-gotrue-http.cjs');
 const runtime=createEphemeralP2Runtime();
 const dir=require('node:path').dirname(runtime.envFiles.gotrue);
 const users={a:{email:'rn-p2-'+'a'.repeat(24)+'-a@example.invalid',password:'b'.repeat(64)}};
 const req=buildGoTrueRequest('h1_signup_a',users);
 try{
  const d=fake();
  await assert.rejects(()=>d.adapter.probeInternalGoTrue({runId:R,caseId:'h1_signup_a',request:req,ephemeralDir:'/etc'}));
  assert.equal(d.calls.length,0);
  await assert.rejects(()=>d.adapter.probeInternalGoTrue({runId:R,caseId:'h1_signup_a',request:req.replace('gotrue:9999','attacker:9999'),ephemeralDir:dir}));
  assert.equal(d.calls.length,0);
  const bad=fake({forgeOwner:true});
  await assert.rejects(()=>bad.adapter.probeInternalGoTrue({runId:R,caseId:'h1_signup_a',request:req,ephemeralDir:dir}));
  assert.ok(!bad.calls.some(a=>a[0]==='container'&&a[1]==='exec'&&a[2]==='-i'));
 }finally{runtime.dispose();}
});

test('GoTrue readiness rejects failed health command and foreign ownership',async()=>{
 const d=fake({throwOn:'-ec'});
 await assert.rejects(()=>d.adapter.initializeGoTrue(R));
 const bad=fake({forgeOwner:true});
 await assert.rejects(()=>bad.adapter.initializeGoTrue(R));
 assert.ok(!bad.calls.some(x=>x.includes('-ec')));
});
