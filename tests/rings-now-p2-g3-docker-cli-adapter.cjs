'use strict';
// DORMANT Docker CLI adapter. Not imported by Actions or production.
// No command executes on import or creation. Explicit injected command runner
// is mandatory: there is deliberately NO default Docker execution path.
// This is NOT admissible as G3 proof and must not be passed as synthetic driver.
const assert=require('node:assert/strict');
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
   assert.equal(spec.environment,'SYNTHETIC_EMPTY');
   // No -p, --volume, --privileged, --env-file, secret, env inheritance.
   // Empty GoTrue/PostgREST/PG config is NOT a bootable real P2 stack.
   await invoke(['container','create','--name',spec.name,'--label',
    LABEL+'='+spec.owner,'--network',spec.network,'--platform',spec.platform,
    '--read-only','--cap-drop','ALL','--security-opt','no-new-privileges',
    spec.image]);
   await inspect('container',spec.name,spec.owner);
   return spec.name;
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
