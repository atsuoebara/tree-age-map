'use strict';
// DORMANT Docker CLI invocation boundary. Nothing spawns on import.
// This is deliberately NOT connected to any workflow or P2 entrypoint.
// execFile timeout bounds *CLI invocation only*, NOT daemon-side operations.
const {execFile}=require('node:child_process');
const assert=require('node:assert/strict');
const MAX_MS=15000,MAX_BYTES=65536;
const TRANSFER_TARGETS=Object.freeze(["/tmp/rn-p2/rings-now-p2-auth-uid-guc-CANDIDATE.sql","/tmp/rn-p2/fixtures/rings-now-p2-isolated-schema-v2-CANDIDATE.sql","/tmp/rn-p2/authenticator.sql","/tmp/rn-p2/rings-now-single-statement-snapshot-CANDIDATE.sql","/tmp/rn-p2/http-probe.bash","/tmp/rn-p2/http-probe.req","/tmp/rn-p2/h2-isolated-seed.sql","/tmp/rn-p2/gotrue-h1.bash","/tmp/rn-p2/gotrue-h1.req","/tmp/rn-p2/fixtures/rings-now-p2-sql-rls-assertions-CANDIDATE.sql"]);
const TRANSFER_SCRIPT="umask 077; cat > \"$1\"";

function createBoundedDockerCommand({execFileImpl=execFile}={}){
 assert.equal(typeof execFileImpl,'function');
 return async function command(spec){
  assert.ok(spec&&typeof spec==='object');
  assert.equal(spec.executable,'docker');
  assert.equal(spec.shell,false);
  assert.ok(spec.attachStdin===false||spec.attachStdin===true);
  if(spec.attachStdin){
   const a=spec.argv;
   assert.ok(Array.isArray(a)&&a.length===9&&a[0]==='container'&&a[1]==='exec'&&a[2]==='-i'&&/^rn_p2_[a-z0-9]{8,32}_postgres$/.test(a[3])&&a[4]==='/bin/bash'&&a[5]==='-c'&&a[6]===TRANSFER_SCRIPT&&a[7]==='rn-p2-transfer'&&TRANSFER_TARGETS.includes(a[8]));
   assert.ok(Buffer.isBuffer(spec.stdinBytes)&&spec.stdinBytes.length>0&&spec.stdinBytes.length<=MAX_BYTES);
  }else assert.equal(spec.stdinBytes,undefined);
  assert.equal(spec.timeoutMs,MAX_MS);
  assert.equal(spec.captureLimitBytes,MAX_BYTES);
  assert.deepEqual(spec.environment,{});
  assert.ok(Array.isArray(spec.argv)&&spec.argv.length>0&&
   spec.argv.every(x=>typeof x==='string'&&x.length<512));
  // Node's timeout + SIGKILL can fail to prove Docker daemon cleanup.
  return new Promise((resolve,reject)=>{
   const child=execFileImpl('docker',spec.argv,{
    shell:false,env:{},timeout:MAX_MS,killSignal:'SIGKILL',
    maxBuffer:MAX_BYTES,windowsHide:true
   },(error,stdout,stderr)=>{
    if(error)return reject(Error('DOCKER_CLI_FAILED_OR_TIMED_OUT'));
    if(typeof stdout!=='string'||Buffer.byteLength(stdout)>MAX_BYTES)
     return reject(Error('DOCKER_STDOUT_INVALID'));
    // Never forward stderr or stdout to the application logs here.
    resolve(Object.freeze({exitCode:0,stdout}));
   });
   if(spec.attachStdin){
    child.stdin.on('error',()=>reject(Error('DOCKER_STDIN_FAILED')));
    child.stdin.end(spec.stdinBytes);
   }
  });
 };
}
module.exports={createBoundedDockerCommand};
