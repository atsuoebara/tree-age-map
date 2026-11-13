// Execute a review-only transformed copy of the real OAuth source. Never deploy or edit the live endpoint.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeFencedDisconnectCandidate} from '../scripts/garmin-disconnect-fence-candidate.mjs';
const source=fs.readFileSync(new URL('../supabase/functions/garmin-oauth/index.ts',import.meta.url),'utf8');
assert.throws(()=>makeFencedDisconnectCandidate('drifted source'),/source drift/);
const candidate=makeFencedDisconnectCandidate(source);
assert.ok(candidate.includes('connection_version=eq.'));
const isolated=candidate.replace("import { logoBase64 } from './logo.ts';","const logoBase64 = '';").replace("if (typeof Deno !== 'undefined') Deno.serve(createHandler(name => Deno.env.get(name)));",'');
const {createHandler}=await import('data:text/javascript;base64,'+Buffer.from(isolated).toString('base64'));
const base='https://example.supabase.co/functions/v1/garmin-oauth', origin='https://runnersrings.com';
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-test',GARMIN_CLIENT_ID:'client',GARMIN_CLIENT_SECRET:'secret',GARMIN_TOKEN_KEY:'ab'.repeat(32)};
const OLD='00000000-0000-0000-0000-000000000001', NEW='00000000-0000-0000-0000-000000000002';
const disconnectRequest=()=>new Request(base+'/disconnect',{method:'POST',headers:{Origin:origin},body:new URLSearchParams({access_token:'synthetic-session'})});
async function scenario(kind){
 const calls=[];
 let row={user_id:'owner-1',connection_version:OLD,import_enabled:true};
 let reconnected=false,disabled=false;
 const mock=async(url,init={})=>{
  const method=init.method||'GET';
  calls.push({url,method});
  if(url.endsWith('/auth/v1/user'))return Response.json({id:'owner-1'});
  if(url.includes('/rest/v1/garmin_api_connections')&&url.includes('select=connection_version')){
   const prior={connection_version:row.connection_version};
   if(kind==='reconnect-before-patch'){
    row={user_id:'owner-1',connection_version:NEW,import_enabled:true};reconnected=true;
   }
   if(kind==='gone-before-patch'){row=null;}
   return Response.json([prior]);
  }
  if(url.includes('/rest/v1/garmin_api_connections')&&method==='PATCH'){
   assert.ok(url.includes('connection_version=eq.'+OLD),'PATCH must target selected generation');
   if(row?.connection_version!==OLD)return Response.json([]);
   disabled=true;row={...row,import_enabled:false};return Response.json([row]);
  }
  if(url.endsWith('/rpc/garmin_worker_lease'))return Response.json(true);
  if(url.includes('/rest/v1/garmin_api_connections')&&url.includes('select=tokens_ciphertext'))return Response.json([]);
  if(url.includes('/rest/v1/garmin_api_connections')&&method==='DELETE'){
   assert.ok(url.includes('connection_version=eq.'+OLD));
   if(row?.connection_version===OLD)row=null;
   return Response.json([]);
  }
  throw Error('Unexpected request '+method+' '+new URL(url).pathname);
 };
 const handler=createHandler(k=>env[k],mock);
 const result=await handler(disconnectRequest());
 assert.equal(result.status,303);
 if(kind==='reconnect-before-patch'){
  assert.equal(result.headers.get('location'),origin+'/?garmin=connected');
  assert.equal(reconnected,true);
  assert.equal(row.connection_version,NEW);
  assert.equal(row.import_enabled,true);
  assert.equal(disabled,false);
  assert.equal(calls.some(x=>x.url.endsWith('/rpc/garmin_worker_lease')),false,'must avoid remote revocation work after lost generation');
 } else if(kind==='gone-before-patch'){
  assert.equal(disabled,false);
  assert.equal(calls.some(x=>x.url.endsWith('/rpc/garmin_worker_lease')),false);
 } else {
  assert.equal(result.headers.get('location'),origin+'/?garmin=disconnected');
  assert.equal(disabled,true,'uncontended current connection must disable');
  assert.ok(calls.some(x=>x.url.endsWith('/rpc/garmin_worker_lease')),'current connection must follow existing retry path');
 }
 assert.ok(!calls.some(x=>x.url.endsWith('/user/registration')),'token unavailable in synthetic test: no remote request expected');
}
await scenario('normal');
await scenario('reconnect-before-patch');
await scenario('gone-before-patch');
// Negative control: the UNMODIFIED production source uses user-only PATCH.
// At the moment it reaches PATCH after reconnect, it disables the new generation.
const originalIsolated=source.replace("import { logoBase64 } from './logo.ts';","const logoBase64 = '';").replace("if (typeof Deno !== 'undefined') Deno.serve(createHandler(name => Deno.env.get(name)));",'');
const {createHandler:originalHandler}=await import('data:text/javascript;base64,'+Buffer.from(originalIsolated).toString('base64'));
const originalCalls=[];
let newRegistration={user_id:'owner-1',connection_version:NEW,import_enabled:true};
const originalMock=async(url,init={})=>{
 originalCalls.push({url,method:init.method||'GET'});
 if(url.endsWith('/auth/v1/user'))return Response.json({id:'owner-1'});
 if(url.includes('/rest/v1/garmin_api_connections')&&init.method==='PATCH'){
  // Reconnect has already replaced the old row. The old disconnect's unguarded
  // PATCH nonetheless targets only owner_id and incorrectly disables this row.
  assert.ok(!url.includes('connection_version=eq.'),'negative control must be real user-only PATCH');
  newRegistration={...newRegistration,import_enabled:false};
  return Response.json([newRegistration]);
 }
 if(url.endsWith('/rpc/garmin_worker_lease'))return Response.json(false);
 throw Error('Unexpected original source request');
};
const oldResult=await originalHandler(k=>env[k],originalMock)(disconnectRequest());
assert.equal(oldResult.status,303);
assert.equal(newRegistration.connection_version,NEW);
assert.equal(newRegistration.import_enabled,false,'negative control must reproduce the existing race defect');
assert.ok(originalCalls.some(x=>x.url.endsWith('/rpc/garmin_worker_lease')));
console.log('OAuth original-vs-candidate offline PASS: original unsafe user-only disable reproduced; fenced candidate protects the new generation.');
