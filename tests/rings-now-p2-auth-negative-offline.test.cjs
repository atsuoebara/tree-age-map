'use strict';
// Offline negative-path contracts only. NEVER a Docker, GoTrue, PostgREST or G4 proof.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {createEphemeralP2Runtime}=require('./rings-now-p2-ephemeral-service-runtime.cjs');
const {buildProbeRequest,parseInternalHttpResponse}=require('./rings-now-p2-docker-internal-http.cjs');
const {assertSnapshotRpcResult}=require('./rings-now-p2-loopback-transport.cjs');
const manifest=require('./rings-now-p2-isolated-manifest.json');
const OWNER='00000000-0000-4000-8000-000000000001';
const OTHER='00000000-0000-4000-8000-000000000002';
const http=(code,body='sensitive internal error')=>
  'HTTP/1.1 '+code+' ERROR\r\nContent-Length: '+Buffer.byteLength(body)+'\r\n\r\n'+body;

test('active manifest keeps all real execution denied',()=>{
 assert.equal(manifest.status,'BLOCKED_NOT_RUN');
 assert.equal(manifest.explicitExecutionApproval,false);
 assert.equal(manifest.productionAccess,false);
 for(const image of Object.values(manifest.images)){
  assert.equal(image.digest,null);
  assert.equal(image.reference,null);
 }
});

test('synthetic owner tokens differ; both are only locally prepared, not auth evidence',()=>{
 const runtime=createEphemeralP2Runtime();
 try{
  const a=runtime.issueSyntheticJwt({subject:OWNER,nowSeconds:1700000000});
  const b=runtime.issueSyntheticJwt({subject:OTHER,nowSeconds:1700000000});
  assert.notEqual(a,b);
  for(const token of [a,b])assert.match(buildProbeRequest(token),/^POST \/rpc\/rings_now_snapshot_candidate_v01 HTTP\/1\.1/);
  assert.throws(()=>runtime.issueSyntheticJwt({subject:'00000000-0000-4000-8000-000000000003'}));
  // Deliberately do not infer signature acceptance from syntactically valid JWTs.
 }finally{runtime.dispose();}
});

test('401, 403, expired-signature rejection fixtures never expose response body',()=>{
 const sensitive='jwt-failed-secret-must-not-escape';
 for(const status of [401,403]){
  const parsed=parseInternalHttpResponse(http(status,sensitive));
  assert.deepEqual(parsed,{status});
  assert.equal(JSON.stringify(parsed).includes(sensitive),false);
  assert.throws(()=>assertSnapshotRpcResult(parsed,{subject:OWNER,expectedCount:0}));
 }
 // These statuses are simulated; this does NOT prove PostgREST rejects an expired/tampered JWT.
});

test('foreign-user row and inflated count are rejected by RPC validator',()=>{
 const row={id:1,user_id:OTHER,activity_date:'2026-11-17',
  started_at:'2026-11-17T01:00:00Z',distance_km:5,deleted_at:null};
 const response={status:200,body:{status:'candidate_snapshot',rows:[row]}};
 assert.throws(()=>assertSnapshotRpcResult(response,{subject:OWNER,expectedCount:1}));
 assert.throws(()=>assertSnapshotRpcResult(response,{subject:OWNER,expectedCount:0}));
 assert.equal(assertSnapshotRpcResult({status:200,body:{status:'candidate_snapshot',rows:[]}},
  {subject:OWNER,expectedCount:0}),'RPC_RESPONSE_SHAPE_ONLY_NOT_JWT_PROOF');
});

test('private HTTP request file is removed after dispose and is not logged',()=>{
 const runtime=createEphemeralP2Runtime();
 let file;
 try{
  file=runtime.prepareHttpProbe({nowSeconds:1700000000});
  assert.equal(fs.statSync(file).mode&0o777,0o600);
  assert.match(fs.readFileSync(file,'utf8'),/Authorization: Bearer /);
  assert.throws(()=>runtime.prepareHttpProbe({nowSeconds:1700000001}));
 }finally{runtime.dispose();}
 assert.equal(fs.existsSync(file),false);
});
