'use strict';
// DORMANT Docker CLI adapter. Not imported by Actions or production.
// No command executes on import or creation. Explicit injected command runner
// is mandatory: there is deliberately NO default Docker execution path.
// This is NOT admissible as G3 proof and must not be passed as synthetic driver.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
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
function createDockerCliAdapter({command}={}){
 assert.equal(typeof command,'function','explicit bounded command runner required');
 // command receives argv, timeout and empty env; a future audited adapter
 // must prove the injected runner actually enforces timeout + process teardown.
 async function invoke(argv){
  assert.ok(Array.isArray(argv)&&argv.every(x=>typeof x==='string'&&x.length<512));
  return checked(await command(Object.freeze({
   executable:'docker',argv:Object.freeze(argv),timeoutMs:TIMEOUT_MS,
   environment:Object.freeze({}),shell:false,attachStdin:false,
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
    const tmpfs=spec.service==='postgres'
     ? ['/var/lib/postgresql/data:rw,nosuid,nodev,size=128m','/var/run/postgresql:rw,nosuid,nodev,size=8m','/tmp:rw,nosuid,nodev,size=16m']
     : ['/tmp:rw,nosuid,nodev,size=16m'];
    runtimeArgs=['--env-file',file,...tmpfs.flatMap(x=>['--tmpfs',x])];
   }
   // No -p, --volume, --privileged, --env KEY=secret, host network.
   await invoke(['container','create','--name',spec.name,'--label',
    LABEL+'='+spec.owner,'--network',spec.network,'--platform',spec.platform,
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
   await invoke(['container','exec',name,'pg_isready','-U','postgres','-d','rings_now_p2']);
   return true;
  },
  async bootstrapPostgres({runId,authenticatorSqlFile}={}){
   safeRun(runId);
   const name=runId+'_postgres';
   const fixture=path.resolve(__dirname,'fixtures/rings-now-p2-isolated-schema-v2-CANDIDATE.sql');
   const uid=path.resolve(__dirname,'rings-now-p2-auth-uid-guc-CANDIDATE.sql');
   const digests=[
    [fixture,'25a2c3371767be832ec1358a6db39eaa5aac074e'],
    [uid,'7518222c475a2b5b7ef68b2d6776d5e0e6823ae5']
   ];
   const gitBlobSha=content=>createHash('sha1').update('blob '+content.length+'\0').update(content).digest('hex');
   for(const [file,sha] of digests){
    assert.equal(gitBlobSha(fs.readFileSync(file)),sha,'candidate SQL bytes changed');
   }
   assert.equal(typeof authenticatorSqlFile,'string');
   assert.match(authenticatorSqlFile,/^\/tmp\/rn-p2-[a-zA-Z0-9_-]{6,64}\/authenticator\.sql$/);
   const stat=fs.statSync(authenticatorSqlFile);
   assert.ok(stat.isFile()&&stat.mode%512===0o600,'private role SQL file required');
   const roleSql=fs.readFileSync(authenticatorSqlFile,'utf8');
   assert.match(roleSql,/^BEGIN;\nCREATE ROLE authenticator LOGIN NOINHERIT PASSWORD '[a-f0-9]{64}';\nGRANT anon TO authenticator;\nGRANT authenticated TO authenticator;\nCOMMIT;\n$/);
   await inspect('container',name,runId);
   await invoke(['container','exec',name,'mkdir','-p','/tmp/rn-p2/fixtures']);
   const copies=[
    [uid,name+':/tmp/rn-p2/rings-now-p2-auth-uid-guc-CANDIDATE.sql'],
    [fixture,name+':/tmp/rn-p2/fixtures/rings-now-p2-isolated-schema-v2-CANDIDATE.sql'],
    [authenticatorSqlFile,name+':/tmp/rn-p2/authenticator.sql']
   ];
   for(const [from,to] of copies)await invoke(['container','cp',from,to]);
   for(const sql of [
    '/tmp/rn-p2/fixtures/rings-now-p2-isolated-schema-v2-CANDIDATE.sql',
    '/tmp/rn-p2/authenticator.sql'
   ]){
    await inspect('container',name,runId);
    await invoke(['container','exec',name,'psql','-U','postgres','-d','rings_now_p2',
     '-v','ON_ERROR_STOP=1','-f',sql]);
   }
   // Database initialization command completion is not RLS proof.
   return 'CLI_BOOTSTRAP_REPORTED_NOT_SQL_PROOF';
  },
  async applySnapshotCandidate(runId){
   safeRun(runId);
   const name=runId+'_postgres';
   const snapshot=path.resolve(__dirname,'../docs/rings-now-single-statement-snapshot-CANDIDATE.sql');
   const bytes=fs.readFileSync(snapshot);
   const sha=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
   assert.equal(sha,'c8bb8bfdeb1e2e88bea422aa76c27d094127bdea',
    'snapshot candidate SQL bytes changed');
   await inspect('container',name,runId);
   // Only the audited SQL is copied. No arbitrary runtime SQL paths or
   // production URLs, and the PostgreSQL target is already owner-checked.
   const target=name+':/tmp/rn-p2/rings-now-single-statement-snapshot-CANDIDATE.sql';
   await invoke(['container','cp',snapshot,target]);
   await inspect('container',name,runId);
   await invoke(['container','exec',name,'psql','-U','postgres','-d','rings_now_p2',
    '-v','ON_ERROR_STOP=1','-f',
    '/tmp/rn-p2/rings-now-single-statement-snapshot-CANDIDATE.sql']);
   return 'CLI_SNAPSHOT_CANDIDATE_APPLIED_NOT_RLS_PROOF';
  },
  async probeSqlRlsBoundary(runId){
   safeRun(runId);
   const name=runId+'_postgres';
   const probe=path.resolve(__dirname,'fixtures/rings-now-p2-sql-rls-assertions-CANDIDATE.sql');
   const bytes=fs.readFileSync(probe);
   const sha=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
   assert.equal(sha,'b0f323d8c5b17a50f23b41e199f456bbc8caa8aa',
    'RLS probe fixture bytes changed');
   await inspect('container',name,runId);
   await invoke(['container','cp',probe,
    name+':/tmp/rn-p2/fixtures/rings-now-p2-sql-rls-assertions-CANDIDATE.sql']);
   await inspect('container',name,runId);
   // ON_ERROR_STOP makes ANY SQL assertion failure a nonzero CLI result.
   // DO NOT interpret success as actual signed JWT or HTTP evidence.
   await invoke(['container','exec',name,'psql','-U','postgres','-d','rings_now_p2',
    '-v','ON_ERROR_STOP=1','-f',
    '/tmp/rn-p2/fixtures/rings-now-p2-sql-rls-assertions-CANDIDATE.sql']);
   return 'CLI_SQL_RLS_ASSERTIONS_REPORTED_NOT_HTTP_JWT_PROOF';
  },
  async initializeGoTrue(runId){
   safeRun(runId);
   const name=runId+'_gotrue';
   await inspect('container',name,runId);
   await invoke(['container','exec',name,'gotrue','migrate']);
   return 'CLI_GOTRUE_MIGRATE_REPORTED_NOT_AUTH_PROOF';
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
module.exports={createDockerCliAdapter,LABEL,TIMEOUT_MS};
