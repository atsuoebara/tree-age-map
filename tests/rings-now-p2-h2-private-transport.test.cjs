'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createDockerCliAdapter,LABEL}=require('./rings-now-p2-g3-docker-cli-adapter.cjs');
const {buildH2Request}=require('./rings-now-p2-h2-postgrest-http.cjs');
const RUN='rn_p2_abcdefgh';
const JWT='eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.c2lnbmF0dXJl';
function temp(){
 const dir=fs.mkdtempSync('/tmp/rn-p2-');
 fs.chmodSync(dir,0o700);
 return dir;
}
function fake({foreign=false,failExec=false,wire}={}){
 const calls=[];
 const command=async ({executable,argv,environment,shell})=>{
  assert.equal(executable,'docker');assert.deepEqual(environment,{});
  assert.equal(shell,false);
  calls.push([...argv]);
  if(argv[0]==='container'&&argv[1]==='inspect'){
   const id=argv.at(-1);
   return {exitCode:0,stdout:JSON.stringify({
    Name:'/'+id,Config:{Labels:{[LABEL]:foreign?'rn_p2_otherxxx':RUN}}
   })};
  }
  if(failExec&&argv[1]==='exec')throw Error('synthetic CLI failure');
  if(argv[1]==='exec')return {exitCode:0,stdout:wire||
   'HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n'};
  return {exitCode:0,stdout:''};
 };
 return {calls,adapter:createDockerCliAdapter({command})};
}
const signedRequest=()=>[
 'POST /rpc/rings_now_snapshot_candidate_v01 HTTP/1.1',
 'Host: postgrest:3000','Authorization: Bearer '+JWT,
 'Accept: application/json','Content-Type: application/json',
 'Content-Length: 2','Connection: close','','{}'
].join('\r\n');
function opts(dir,caseId='h2_owner_a',request=signedRequest()){
 return {runId:RUN,ephemeralDir:dir,caseId,request};
}
test('H2 owned probe runs pinned internal PostgREST Bash and returns denial status',async()=>{
 const dir=temp(),d=fake();
 try{
  const response=await d.adapter.probeInternalH2(opts(dir));
  assert.equal(response.status,403);
  assert.deepEqual(d.calls.map(x=>x[1]),['inspect','cp','inspect','cp','inspect','exec']);
  const joined=JSON.stringify(d.calls);
  assert.ok(!joined.includes(JWT),'no JWT in docker argv');
  assert.ok(!joined.includes('Authorization:'));
  assert.ok(!joined.includes('--publish')&&!joined.includes('--env'));
  assert.ok(!fs.existsSync(path.join(dir,'h2-probe.req')));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('anonymous H2 has no Authorization header and rejects accidental injected auth',async()=>{
 const dir=temp(),d=fake();
 const anonymous=buildH2Request({caseId:'h2_anonymous'});
 try{
  assert.equal((await d.adapter.probeInternalH2(opts(dir,'h2_anonymous',anonymous))).status,403);
  const previous=d.calls.length;
  await assert.rejects(()=>d.adapter.probeInternalH2(opts(dir,'h2_anonymous',signedRequest())));
  assert.equal(d.calls.length,previous);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('Host/path tampering rejected before any Docker command or private file creation',async()=>{
 const dir=temp(),d=fake();
 try{
  for(const mutated of [
   signedRequest().replace('postgrest:3000','evil.example:443'),
   signedRequest().replace('rings_now_snapshot_candidate_v01','other_rpc'),
   signedRequest().replace('Connection: close','Connection: keep-alive'),
   signedRequest().replace('Content-Length: 2','Content-Length: 3')
  ]){
   await assert.rejects(()=>d.adapter.probeInternalH2(opts(dir,'h2_owner_a',mutated)));
   assert.equal(d.calls.length,0);
   assert.ok(!fs.existsSync(path.join(dir,'h2-probe.req')));
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('foreign owner blocks every secret-bearing Docker copy',async()=>{
 const dir=temp(),d=fake({foreign:true});
 try{
  await assert.rejects(()=>d.adapter.probeInternalH2(opts(dir)));
  assert.deepEqual(d.calls.map(x=>x[1]),['inspect']);
  assert.ok(!fs.existsSync(path.join(dir,'h2-probe.req')));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('Docker exec failure propagates and removes the host 0600 request file',async()=>{
 const dir=temp(),d=fake({failExec:true});
 try{
  await assert.rejects(()=>d.adapter.probeInternalH2(opts(dir)),/synthetic CLI failure/);
  assert.ok(d.calls.some(x=>x[1]==='exec'));
  assert.equal(fs.existsSync(path.join(dir,'h2-probe.req')),false);
  assert.ok(!JSON.stringify(d.calls).includes(JWT));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('private directory, unknown H2 case and non-0600 symlink cannot pass',async()=>{
 const dir=temp(),d=fake();
 try{
  await assert.rejects(()=>d.adapter.probeInternalH2({...opts(dir),caseId:'unknown'}));
  fs.chmodSync(dir,0o755);
  await assert.rejects(()=>d.adapter.probeInternalH2(opts(dir)));
  assert.equal(d.calls.length,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
