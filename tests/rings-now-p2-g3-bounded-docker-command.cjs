'use strict';
// DORMANT Docker CLI invocation boundary. Nothing spawns on import.
// This is deliberately NOT connected to any workflow or P2 entrypoint.
// execFile timeout bounds *CLI invocation only*, NOT daemon-side operations.
const {execFile}=require('node:child_process');
const assert=require('node:assert/strict');
const MAX_MS=15000,MAX_BYTES=65536;
function createBoundedDockerCommand({execFileImpl=execFile}={}){
 assert.equal(typeof execFileImpl,'function');
 return async function command(spec){
  assert.ok(spec&&typeof spec==='object');
  assert.equal(spec.executable,'docker');
  assert.equal(spec.shell,false);
  assert.equal(spec.attachStdin,false);
  assert.equal(spec.timeoutMs,MAX_MS);
  assert.equal(spec.captureLimitBytes,MAX_BYTES);
  assert.deepEqual(spec.environment,{});
  assert.ok(Array.isArray(spec.argv)&&spec.argv.length>0&&
   spec.argv.every(x=>typeof x==='string'&&x.length<512));
  // Node's timeout + SIGKILL can fail to prove Docker daemon cleanup.
  return new Promise((resolve,reject)=>{
   execFileImpl('docker',spec.argv,{
    shell:false,env:{},timeout:MAX_MS,killSignal:'SIGKILL',
    maxBuffer:MAX_BYTES,windowsHide:true
   },(error,stdout,stderr)=>{
    if(error)return reject(Error('DOCKER_CLI_FAILED_OR_TIMED_OUT'));
    if(typeof stdout!=='string'||Buffer.byteLength(stdout)>MAX_BYTES)
     return reject(Error('DOCKER_STDOUT_INVALID'));
    // Never forward stderr or stdout to the application logs here.
    resolve(Object.freeze({exitCode:0,stdout}));
   });
  });
 };
}
module.exports={createBoundedDockerCommand};
