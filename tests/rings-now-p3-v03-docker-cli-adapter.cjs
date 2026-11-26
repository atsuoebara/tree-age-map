'use strict';
// DORMANT Docker CLI adapter. Not imported by Actions or production.
// No command executes on import or creation. Explicit injected command runner
// is mandatory: there is deliberately NO default Docker execution path.
// This is NOT admissible as G3 proof and must not be passed as synthetic driver.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {parseInternalHttpResponse}=require('./rings-now-p2-docker-internal-http.cjs');
const {parseV03ExpiredResponse,assertNoGlobalGuard}=require('./rings-now-p3-v03-http-contract.cjs');
const RUN=/^rn_p2_[a-z0-9]{8,32}$/;
const IMAGE=/^docker\.io\/(?:library\/postgres|supabase\/gotrue|postgrest\/postgrest)@sha256:[a-f0-9]{64}$/;
const SERVICES=Object.freeze(['postgres','gotrue','postgrest']);
const LABEL='com.runnersrings.p2.run';
const TIMEOUT_MS=15000;
function safeId(value){
 assert.equal(typeof value,'string');
 assert.match(value,/^[a-z0-9][a-z0-9_-]{0,100}$/);
 return value;
}
function safeRun(value){assert.match(value||'',RUN);return value;}
function checked(result){
 assert.ok(result&&typeof result==='object'&&result.exitCode===0,'Docker CLI command failed');
 assert.equal(typeof result.stdout,'string','Docker CLI stdout required');
 assert.ok(result.stdout.length<=65536,'Docker response too large');
 return result.stdout;
}
function createG5DockerCliAdapter({command}={}){
 assert.equal(typeof command,'function','explicit bounded command runner required');
 // command receives argv, timeout and empty env; a future audited adapter
 // must prove the injected runner actually enforces timeout + process teardown.
 async function invoke(argv,stdinBytes){
  assert.ok(Array.isArray(argv)&&argv.every(x=>typeof x==='string'&&x.length<512));
  return checked(await command(Object.freeze({
   executable:'docker',argv:Object.freeze(argv),timeoutMs:TIMEOUT_MS,
   environment:Object.freeze({}),shell:false,attachStdin:stdinBytes!==undefined,
   ...(stdinBytes===undefined?{}:{stdinBytes}),
   captureLimitBytes:65536
  })));
 }
 async function inspect(kind,id,runId){
  const format='{{json .}}';
  const obj=JSON.parse((await invoke([kind,'inspect','--format',format,id])).trim());
  assert.ok(obj&&typeof obj==='object');
  assert.equal(obj.Name?.replace(/^\//,''),id);
  assert.equal(obj.Labels?.[LABEL]||obj.Config?.Labels?.[LABEL],runId);
  return obj;
 }
 async function transfer(from,to){
  const split=to.indexOf(':');
  const name=to.slice(0,split),dest=to.slice(split+1);
  const runId=name.replace(/_postgres$/,'');
  safeRun(runId);assert.equal(name,runId+'_postgres');
  assert.ok(["/tmp/rn-p2/rings-now-p2-auth-uid-guc-CANDIDATE.sql","/tmp/rn-p2/fixtures/rings-now-g5-isolated-schema-CANDIDATE.sql","/tmp/rn-p2/authenticator.sql","/tmp/rn-p2/rings-now-p3-snapshot-v03-REVIEW.sql","/tmp/rn-p2/http-probe.bash","/tmp/rn-p2/http-probe.req","/tmp/rn-p2/h2-isolated-seed.sql","/tmp/rn-p2/gotrue-h1.bash","/tmp/rn-p2/gotrue-h1.req","/tmp/rn-p2/fixtures/rings-now-p3-v03-window-CANDIDATE.sql","/tmp/rn-p2/fixtures/rings-now-p3-v03-concurrent-probe.bash"].includes(dest));
  await inspect('container',name,runId);
  const stat=fs.lstatSync(from);assert.ok(stat.isFile()&&stat.size>0&&stat.size<=65536);
  const bytes=fs.readFileSync(from);
  await invoke(['container','exec','-i',name,'/bin/bash','-c',"umask 077; cat > \"$1\"",'rn-p2-transfer',dest],bytes);
 }
 async function listType(kind,runId){
  const args=kind==='container'
   ? ['container','ls','--all','--filter','label='+LABEL+'='+runId,'--format','{{.Names}}']
   : ['network','ls','--filter','label='+LABEL+'='+runId,'--format','{{.Name}}'];
  const names=(await invoke(args)).split('\n').map(x=>x.trim()).filter(Boolean);
  const results=[];
  for(const name of names){
   safeId(name);
   const obj=await inspect(kind,name,runId);
   if(kind==='container'&&obj.Name?.replace(/^\//,'')!==name)
    throw Error('identity mismatch');
   results.push(Object.freeze({type:kind,id:name,owner:runId}));
  }
  return results;
 }
 return Object.freeze({
  evidenceKind:'DOCKER_CLI_ADAPTER_NOT_ADMITTED',
  async listOwned(runId){
   safeRun(runId);
   // A broken partial inventory must throw instead of returning false empty.
   const [containers,networks]=await Promise.all([
    listType('container',runId),listType('network',runId)
   ]);
   return [...containers,...networks];
  },
  async createNetwork(spec){
   safeRun(spec?.name);assert.equal(spec.name,spec.owner);
   assert.equal(spec.internal,true);assert.equal(spec.attachable,false);
   await invoke(['network','create','--driver','bridge','--internal',
    '--label',LABEL+'='+spec.owner,spec.name]);
   await inspect('network',spec.name,spec.owner);
   return spec.name;
  },
  async createContainer(spec){
   safeRun(spec?.owner);
   assert.ok(SERVICES.includes(spec.service));
   assert.equal(spec.name,spec.owner+'_'+spec.service);
   safeId(spec.network);
   assert.equal(spec.network,spec.owner);
   assert.match(spec.image||'',IMAGE);
   const expected={postgres:'docker.io/library/postgres',gotrue:'docker.io/supabase/gotrue',
    postgrest:'docker.io/postgrest/postgrest'}[spec.service];
   assert.ok(spec.image.startsWith(expected+'@sha256:'));
   assert.equal(spec.platform,'linux/amd64');
   assert.equal(spec.publishPorts,false);assert.equal(spec.privileged,false);
   assert.equal(spec.readOnlyRootfs,true);assert.equal(spec.persistentVolumes,false);
   // Concrete service environment is supplied only by a run-scoped,
   // restrictive temporary file, never as literal secret-bearing argv.
   let runtimeArgs=[];
   if(spec.environment!=='SYNTHETIC_EMPTY'){
    assert.equal(spec.environment,'EPHEMERAL_SERVICE_ENV_FILE');
    const file=spec.runtime?.envFile;
    assert.equal(typeof file,'string');
    assert.match(file,/^\/tmp\/rn-p2-[a-zA-Z0-9_-]{6,64}\/(?:postgres|gotrue|postgrest)\.env$/);
    assert.ok(file.endsWith('/'+spec.service+'.env'));
    assert.equal(spec.runtime?.networkOnly,true);
    if(spec.service==='postgrest')assertNoGlobalGuard(fs.readFileSync(file,'utf8'));
    const tmpfs=spec.service==='postgres'
     ? ['/var/lib/postgresql/data:rw,nosuid,nodev,size=128m','/var/run/postgresql:rw,nosuid,nodev,size=8m','/tmp:rw,nosuid,nodev,size=16m']
     : ['/tmp:rw,nosuid,nodev,size=16m'];
    // Official postgres entrypoint starts as root to prepare/chown tmpfs, then
    // drops to postgres via gosu. Restore only those initialization capabilities.
    const caps=spec.service==='postgres'?['CHOWN','DAC_OVERRIDE','SETGID','SETUID']:[];
    runtimeArgs=[...caps.flatMap(x=>['--cap-add',x]),'--env-file',file,...tmpfs.flatMap(x=>['--tmpfs',x])];
   }
   // No -p, --volume, --privileged, --env KEY=secret, host network.
   await invoke(['container','create','--name',spec.name,'--label',
    LABEL+'='+spec.owner,'--network',spec.network,
    '--network-alias',spec.service,'--platform',spec.platform,
    '--read-only','--cap-drop','ALL','--security-opt','no-new-privileges',
    ...runtimeArgs,spec.image]);
   await inspect('container',spec.name,spec.owner);
   return spec.name;
  },
  async postgresReady(runId){
   safeRun(runId);
   const name=runId+'_postgres';
   await inspect('container',name,runId);
   // The readiness probe proves a server socket is listening, not SQL/RLS.
   await invoke(['container','exec',name,'pg_isready','-h','127.0.0.1','-U','postgres','-d','rings_now_v03_isolated']);
   return true;
  },
  async bootstrapPostgres({runId,authenticatorSqlFile}={}){
   safeRun(runId);
   const name=runId+'_postgres';
   const fixture=path.resolve(__dirname,'fixtures/rings-now-g5-isolated-schema-CANDIDATE.sql');
   const uid=path.resolve(__dirname,'rings-now-p2-auth-uid-guc-CANDIDATE.sql');
   const digests=[
    [fixture,'7ec1d2597a73cc33e387217649aa1eaddd5b30cb'],
    [uid,'7518222c475a2b5b7ef68b2d6776d5e0e6823ae5']
   ];
   const gitBlobSha=content=>createHash('sha1').update('blob '+content.length+'\0').update(content).digest('hex');
   let bootstrapPhase='VALIDATE';
   try{
   for(const [file,sha] of digests){
    assert.equal(gitBlobSha(fs.readFileSync(file)),sha,'candidate SQL bytes changed');
   }
   assert.equal(typeof authenticatorSqlFile,'string');
   assert.match(authenticatorSqlFile,/^\/tmp\/rn-p2-[a-zA-Z0-9_-]{6,64}\/authenticator\.sql$/);
   const stat=fs.statSync(authenticatorSqlFile);
   assert.ok(stat.isFile()&&stat.mode%512===0o600,'private role SQL file required');
   const roleSql=fs.readFileSync(authenticatorSqlFile,'utf8');
   assert.match(roleSql,/^BEGIN;\nCREATE ROLE authenticator LOGIN NOINHERIT PASSWORD '[a-f0-9]{64}';\nGRANT anon TO authenticator;\nGRANT authenticated TO authenticator;\nCOMMIT;\n$/);
   assert.ok(roleSql.endsWith('COMMIT;\n'),'exact role SQL terminator required');
   bootstrapPhase='MKDIR';
   await inspect('container',name,runId);
   await invoke(['container','exec',name,'mkdir','-p','/tmp/rn-p2/fixtures']);
   const copies=[
    [uid,name+':/tmp/rn-p2/rings-now-p2-auth-uid-guc-CANDIDATE.sql'],
    [fixture,name+':/tmp/rn-p2/fixtures/rings-now-g5-isolated-schema-CANDIDATE.sql'],
    [authenticatorSqlFile,name+':/tmp/rn-p2/authenticator.sql']
   ];
   bootstrapPhase='TRANSFER';
   for(const [from,to] of copies)await transfer(from,to);
   for(const sql of [
    '/tmp/rn-p2/fixtures/rings-now-g5-isolated-schema-CANDIDATE.sql',
    '/tmp/rn-p2/authenticator.sql'
   ]){
    bootstrapPhase=sql.endsWith('/authenticator.sql')?'ROLE_SQL':'SCHEMA_SQL';
    await inspect('container',name,runId);
    await invoke(['container','exec',name,'psql','-U','postgres','-d','rings_now_v03_isolated',
     '-v','ON_ERROR_STOP=1','-f',sql]);
   }
   // Database initialization command completion is not RLS proof.
   return 'CLI_BOOTSTRAP_REPORTED_NOT_SQL_PROOF';
   }catch{throw Error('BOOTSTRAP_'+bootstrapPhase);}
  },
  async applySnapshotCandidate(runId){
   safeRun(runId);
   const name=runId+'_postgres';
   const snapshot=path.resolve(__dirname,'../docs/rings-now-p3-snapshot-v03-REVIEW.sql');
   const bytes=fs.readFileSync(snapshot);
   const sha=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
   assert.equal(sha,'2130f2fadebdace0f944c5164cd1ee1b429fb7c1',
    'snapshot candidate SQL bytes changed');
   await inspect('container',name,runId);
   // Only the audited SQL is copied. No arbitrary runtime SQL paths or
   // production URLs, and the PostgreSQL target is already owner-checked.
   const target=name+':/tmp/rn-p2/rings-now-p3-snapshot-v03-REVIEW.sql';
   await transfer(snapshot,target);
   await inspect('container',name,runId);
   await invoke(['container','exec',name,'psql','-U','postgres','-d','rings_now_v03_isolated',
    '-v','ON_ERROR_STOP=1','-f',
    '/tmp/rn-p2/rings-now-p3-snapshot-v03-REVIEW.sql']);
   return 'CLI_SNAPSHOT_CANDIDATE_APPLIED_NOT_RLS_PROOF';
  },
  async probeInternalPostgrest({runId,requestFile}={}){
   safeRun(runId);
   assert.equal(typeof requestFile,'string');
   assert.match(requestFile,/^\/tmp\/rn-p2-[a-zA-Z0-9_-]{6,64}\/http-probe\.req$/);
   const stat=fs.statSync(requestFile);
   assert.ok(stat.isFile()&&(stat.mode&0o777)===0o600,'private probe file required');
   const bytes=fs.readFileSync(requestFile,'utf8');
   assert.match(bytes,/^POST \/rpc\/rings_now_snapshot_candidate_v03 HTTP\/1\.1\r\nHost: postgrest:3000\r\nAuthorization: Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\r\nAccept: application\/json\r\nContent-Type: application\/json\r\nContent-Length: 2\r\nConnection: close\r\n\r\n\{\}$/);
   const name=runId+'_postgres';
   const bash=path.resolve(__dirname,'fixtures/rings-now-p2-internal-http-probe.bash');
   const content=fs.readFileSync(bash);
   const sha=createHash('sha1').update('blob '+content.length+'\0').update(content).digest('hex');
   assert.equal(sha,'0b1ab1d389dad3abe52f1b8e710e694c7032d684',
    'Docker-internal HTTP Bash probe changed');
   await inspect('container',name,runId);
   // Raw JWT is copied inside the owned container's ephemeral /tmp.
   // No credentials or JWTs appear in docker argv, shell args or logs.
   await transfer(bash,name+':/tmp/rn-p2/http-probe.bash');
   await inspect('container',name,runId);
   await transfer(requestFile,name+':/tmp/rn-p2/http-probe.req');
   await inspect('container',name,runId);
   const wire=await invoke(['container','exec',name,'/bin/bash',
    '/tmp/rn-p2/http-probe.bash']);
   return parseInternalHttpResponse(wire);
  },
  async seedH2DisposableOwners({runId,ownerA,ownerB,sql,ephemeralDir}={}){
   // This adapter is dormant behind the canonical runner authorization gate.
   // SQL is recomputed exactly from two restricted UUIDs, not trusted verbatim.
   safeRun(runId);
   assert.match(ephemeralDir||'',/^\/tmp\/rn-p2-[a-zA-Z0-9_-]{6,64}$/);
   const dstat=fs.lstatSync(ephemeralDir);
   assert.ok(dstat.isDirectory()&&(dstat.mode&0o777)===0o700);
   const {buildV03IsolatedSeedSql}=require('./rings-now-p3-v03-isolated-seed-sql.cjs');
   assert.equal(sql,buildV03IsolatedSeedSql({ownerA,ownerB}),
    'only generated A/B candidate SQL is allowed');
   const name=runId+'_postgres';
   await inspect('container',name,runId);
   const filename=path.join(ephemeralDir,'h2-isolated-seed.sql');
   const fd=fs.openSync(filename,'wx',0o600);
   try{
    try{fs.writeFileSync(fd,sql,{encoding:'utf8'});}
    finally{fs.closeSync(fd);}
    assert.equal(fs.lstatSync(filename).mode&0o777,0o600);
    await transfer(filename,name+':/tmp/rn-p2/h2-isolated-seed.sql');
    await inspect('container',name,runId);
    await invoke(['container','exec',name,'psql','-U','postgres','-d','rings_now_v03_isolated',
     '-v','ON_ERROR_STOP=1','-f','/tmp/rn-p2/h2-isolated-seed.sql']);
    return Object.freeze({status:'ISOLATED_TWO_OWNERS_CLI_REPORTED'});
   }finally{fs.rmSync(filename,{force:true});}
  },
  async probeInternalH2({runId,caseId,request,ephemeralDir}={}){
   // Staging-only H2 wire adapter: invoked only by an explicitly gated
   // runner in a FUTURE PR. Reuse SHA-pinned PostgREST internal probe.
   safeRun(runId);
   const allowed=['h2_anonymous','h2_owner_a','h2_foreign_a','h2_owner_b',
    'h2_bad_signature','h2_expired_token','h2_no_rpc_grant'];
   const isGet=typeof caseId==='string'&&caseId.startsWith('v03_get_');
   const logicalCase=isGet?'h2_'+caseId.slice(8):caseId;
   assert.ok(allowed.includes(logicalCase),'unknown H2 case');
   assert.match(ephemeralDir||'',/^\/tmp\/rn-p2-[a-zA-Z0-9_-]{6,64}$/);
   const dirStat=fs.lstatSync(ephemeralDir);
   assert.ok(dirStat.isDirectory()&&(dirStat.mode&0o777)===0o700,
    'H2 private 0700 directory required');
   assert.equal(typeof request,'string');
   assert.ok(Buffer.byteLength(request,'utf8')<4096,'H2 request oversized');
   const prefix=(isGet?'GET':'POST')+' /rpc/rings_now_snapshot_candidate_v03 HTTP/1.1\r\n'+
    'Host: postgrest:3000\r\n';
   const suffix=isGet?'Accept: application/json\r\nConnection: close\r\n\r\n':'Accept: application/json\r\n'+
    'Content-Type: application/json\r\n'+
    'Content-Length: 2\r\nConnection: close\r\n\r\n{}';
   let authorization='';
   if(logicalCase!=='h2_anonymous'){
    const line=request.slice(prefix.length).split('\r\n')[0];
    assert.match(line,/^Authorization: Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    authorization=line+'\r\n';
   }
   assert.equal(request,prefix+authorization+suffix,'unapproved H2 Host/path/headers');
   const name=runId+'_postgres';
   const bash=path.resolve(__dirname,'fixtures/rings-now-p2-internal-http-probe.bash');
   const content=fs.readFileSync(bash);
   const sha=createHash('sha1').update('blob '+content.length+'\0').update(content).digest('hex');
   assert.equal(sha,'0b1ab1d389dad3abe52f1b8e710e694c7032d684',
    'pinned PostgREST internal Bash changed');
   // MUST authenticate ownership before copying sensitive JWT.
   await inspect('container',name,runId);
   const requestFile=path.join(ephemeralDir,'h2-probe.req');
   const fd=fs.openSync(requestFile,'wx',0o600);
   try{
    try{fs.writeFileSync(fd,request,{encoding:'utf8'});}
    finally{fs.closeSync(fd);}
    assert.equal(fs.lstatSync(requestFile).mode&0o777,0o600);
    await transfer(bash,name+':/tmp/rn-p2/http-probe.bash');
    await inspect('container',name,runId);
    // Existing pinned Bash reads this fixed container target.
    await transfer(requestFile,name+':/tmp/rn-p2/http-probe.req');
    await inspect('container',name,runId);
    const wire=await invoke(['container','exec',name,'/bin/bash',
     '/tmp/rn-p2/http-probe.bash']);
    return logicalCase==='h2_expired_token'?parseV03ExpiredResponse(wire):parseInternalHttpResponse(wire);
   }finally{
    fs.rmSync(requestFile,{force:true});
    // Container tmpfs deleted only upon owned container teardown.
   }
  },
  async probeInternalGoTrue({runId,caseId,request,ephemeralDir}={}){
   // Dormant H1 transport: a caller must first pass the canonical run gates.
   // Never expose email/password/request in argv, env, error text or logs.
   safeRun(runId);
   assert.ok(['h1_signup_a','h1_signin_a','h1_signup_b','h1_signin_b','h1_bad_password'].includes(caseId));
   assert.equal(typeof ephemeralDir,'string');
   assert.match(ephemeralDir,/^\/tmp\/rn-p2-[a-zA-Z0-9_-]{6,64}$/);
   const dstat=fs.statSync(ephemeralDir);
   assert.ok(dstat.isDirectory()&&(dstat.mode&0o777)===0o700,'private temporary directory required');
   assert.equal(typeof request,'string');
   assert.ok(Buffer.byteLength(request)<=2048,'request too large');
   const split=request.indexOf('\r\n\r\n');
   assert.ok(split>0,'bad request framing');
   const headers=request.slice(0,split);
   const body=request.slice(split+4);
   const expectedPath=caseId.startsWith('h1_signup_')?'/signup':'/token?grant_type=password';
   const expectedHeaders=[
    'POST '+expectedPath+' HTTP/1.1','Host: gotrue:9999',
    'Content-Type: application/json','Accept: application/json',
    'Content-Length: '+Buffer.byteLength(body),'Connection: close'
   ].join('\r\n');
   assert.equal(headers,expectedHeaders,'unapproved GoTrue request envelope');
   const json=JSON.parse(body);
   assert.ok(json&&typeof json==='object'&&!Array.isArray(json));
   assert.deepEqual(Object.keys(json).sort(),['email','password']);
   const who=caseId.endsWith('_b')?'b':'a';
    assert.match(json.email||'',new RegExp('^rn-p2-[a-f0-9]{24}-'+who+'@example\\.invalid$'));
   assert.match(json.password||'',/^[a-f0-9]{64}$/);
   if(caseId==='h1_bad_password')assert.equal(json.password,'0'.repeat(64));
   const script=path.resolve(__dirname,'fixtures/rings-now-p2-internal-gotrue-h1.bash');
   const content=fs.readFileSync(script);
   const sha=createHash('sha1').update('blob '+content.length+'\0').update(content).digest('hex');
   assert.equal(sha,'2c243ee5be8f165f57c2bb6704f6bbae41fd6e76',
    'pinned H1 internal probe changed');
   const name=runId+'_postgres';
   // Inspect run ownership BEFORE making any secret-bearing copy/exec.
   await inspect('container',name,runId);
   const requestFile=path.join(ephemeralDir,'gotrue-h1.req');
   const fd=fs.openSync(requestFile,'wx',0o600);
   try{
    fs.writeFileSync(fd,request,{encoding:'utf8'});
   }finally{fs.closeSync(fd);}
   try{
    assert.equal(fs.statSync(requestFile).mode&0o777,0o600);
    await transfer(script,name+':/tmp/rn-p2/gotrue-h1.bash');
    await inspect('container',name,runId);
    await transfer(requestFile,name+':/tmp/rn-p2/gotrue-h1.req');
    await inspect('container',name,runId);
    // stdout contains private GoTrue body; consume only inside this module.
    const wire=await invoke(['container','exec',name,'/bin/bash',
     '/tmp/rn-p2/gotrue-h1.bash']);
    return parseInternalHttpResponse(wire);
   }finally{
    fs.rmSync(requestFile,{force:true});
    // Container-side request is tmpfs and is deleted with run-owned container
    // teardown. No claim of runtime secret erasure or independent proof here.
   }
  },
  async probeG5SqlBoundary(runId){
   safeRun(runId);
   const name=runId+'_postgres';
   const probe=path.resolve(__dirname,'fixtures/rings-now-p3-v03-window-CANDIDATE.sql');
   const bytes=fs.readFileSync(probe);
   const sha=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
   assert.equal(sha,'11fe060fba72895aaa66118ed396c174ee3e21fc',
    'RLS probe fixture bytes changed');
   await inspect('container',name,runId);
   await transfer(probe,
    name+':/tmp/rn-p2/fixtures/rings-now-p3-v03-window-CANDIDATE.sql');
   await inspect('container',name,runId);
   // ON_ERROR_STOP makes ANY SQL assertion failure a nonzero CLI result.
   // DO NOT interpret success as actual signed JWT or HTTP evidence.
   const stdout=await invoke(['container','exec',name,'psql','-U','postgres','-d','rings_now_v03_isolated',
    '-v','ON_ERROR_STOP=1','-f',
    '/tmp/rn-p2/fixtures/rings-now-p3-v03-window-CANDIDATE.sql']);
   assert.equal(stdout.trim().split('\n').at(-1),'V03_SQL_FIXTURE_PASS');
   return 'CLI_SQL_RLS_ASSERTIONS_REPORTED_NOT_HTTP_JWT_PROOF';
  },
  async probeG5ConcurrentBoundary(runId){
   safeRun(runId);
   const name=runId+'_postgres';
   const probe=path.resolve(__dirname,'fixtures/rings-now-p3-v03-concurrent-probe.bash');
   const bytes=fs.readFileSync(probe);
   const sha=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
   assert.equal(sha,'ded7aa03b143d4712b503c0f05c6a489966315d5','G5 concurrent fixture bytes changed');
   await inspect('container',name,runId);
   await transfer(probe,name+':/tmp/rn-p2/fixtures/rings-now-p3-v03-concurrent-probe.bash');
   await inspect('container',name,runId);
   const stdout=await invoke(['container','exec',name,'/bin/bash','/tmp/rn-p2/fixtures/rings-now-p3-v03-concurrent-probe.bash']);
   assert.equal(stdout.trim().split('\n').at(-1),'V03_CONCURRENT_CLI_REPORTED_NOT_PROOF');
   return 'V03_CONCURRENT_CLI_REPORTED_NOT_PROOF';
  },
  async diagnoseH2InternalError(runId,caseId){
   safeRun(runId);
   const {safeCategories}=require('./rings-now-p2-h1-internal-error.cjs');
   const service=['h1_signin_a','h1_signin_b'].includes(caseId)?'gotrue':'postgrest';
   const result={service};
   for(const target of [service,'postgres']){
    const key=target==='postgres'?'postgres':'serviceCategories';
    try{
     const name=runId+'_'+target;
     await inspect('container',name,runId);
     result[key]=safeCategories(JSON.parse(await invoke(['container','logs','--tail','80',name])));
    }catch{result[key]=['UNAVAILABLE'];}
   }
   return Object.freeze(result);
  },
  async diagnoseH1InternalError(runId){
   safeRun(runId);
   const {safeCategories}=require('./rings-now-p2-h1-internal-error.cjs');
   const result={};
   for(const service of ['gotrue','postgres']){
    try{
     const name=runId+'_'+service;
     await inspect('container',name,runId);
     result[service]=safeCategories(JSON.parse(await invoke(['container','logs','--tail','80',name])));
    }catch{result[service]=['UNAVAILABLE'];}
   }
   return Object.freeze(result);
  },
  async initializeGoTrue(runId){
   safeRun(runId);
   const name=runId+'_gotrue';
   await inspect('container',name,runId);
   const pg=runId+'_postgres';
   await inspect('container',pg,runId);
   // Normal startup runs migrations; probe the fixed internal health endpoint.
   await invoke(['container','exec',pg,'/bin/bash','-ec',"exec 3<>/dev/tcp/gotrue/9999; printf 'GET /health HTTP/1.1\\r\\nHost: gotrue:9999\\r\\nConnection: close\\r\\n\\r\\n' >&3; IFS= read -r -t 2 line <&3; line=\"$(printf '%s' \"$line\" | tr -d '\\r')\"; [[ \"$line\" == 'HTTP/1.1 200 OK' ]]"]);
   return 'CLI_GOTRUE_HEALTH_REPORTED_NOT_AUTH_PROOF';
  },
  async startContainer(name){
   safeId(name);
   // Never start based on user-provided name alone; enforce run-owner label.
   const owner=name.replace(/_(postgres|gotrue|postgrest)$/,'');
   safeRun(owner);
   await inspect('container',name,owner);
   await invoke(['container','start',name]);
  },
  async stopContainer(name){
   safeId(name);
   const owner=name.replace(/_(postgres|gotrue|postgrest)$/,'');
   safeRun(owner);
   await inspect('container',name,owner);
   await invoke(['container','stop','--time','1',name]);
  },
  async removeContainer(name){
   safeId(name);
   const owner=name.replace(/_(postgres|gotrue|postgrest)$/,'');
   safeRun(owner);
   await inspect('container',name,owner);
   await invoke(['container','rm','--force',name]);
  },
  async removeNetwork(name){
   safeRun(name);
   await inspect('network',name,name);
   await invoke(['network','rm',name]);
  }
 });
}
module.exports={createG5DockerCliAdapter,LABEL,TIMEOUT_MS};
