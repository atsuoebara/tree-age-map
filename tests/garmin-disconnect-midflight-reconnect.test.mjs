// Offline mid-flight race test of original OAuth source and isolated fenced candidate.
// Every URL is mocked. Demonstrates what DB generation fencing does and does NOT protect.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { makeFencedDisconnectCandidate } from '../scripts/garmin-disconnect-fence-candidate.mjs';
const original=fs.readFileSync(new URL('../supabase/functions/garmin-oauth/index.ts',import.meta.url),'utf8');
const stripped=s=>s.replace("import { logoBase64 } from './logo.ts';","const logoBase64 = '';")
 .replace("if (typeof Deno !== 'undefined') Deno.serve(createHandler(name => Deno.env.get(name)));",'');
const load=async s=>(await import('data:text/javascript;base64,'+Buffer.from(stripped(s)).toString('base64'))).createHandler;
const candidateHandler=await load(makeFencedDisconnectCandidate(original));
const originalHandler=await load(original);
const base='https://example.supabase.co/functions/v1/garmin-oauth';
const origin='https://runnersrings.com';
const OLD='00000000-0000-0000-0000-000000000001',NEW='00000000-0000-0000-0000-000000000002';
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',
 GARMIN_CLIENT_ID:'synthetic-client',GARMIN_CLIENT_SECRET:'synthetic-secret',GARMIN_TOKEN_KEY:'ab'.repeat(32)};
const enc=new TextEncoder(),bytes=Uint8Array.from(env.GARMIN_TOKEN_KEY.match(/../g),x=>parseInt(x,16));
const key=await crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt']);
const iv=new Uint8Array(12);iv.fill(7);
const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode('tokens:synthetic-owner')},key,enc.encode(JSON.stringify({
 access_token:'synthetic-old-access',refresh_token:'synthetic-old-refresh',expires_at:Date.now()+86400000
})));
const envelope=Buffer.from(iv).toString('base64url')+'.'+Buffer.from(ciphertext).toString('base64url');
const req=()=>new Request(base+'/disconnect',{method:'POST',headers:{Origin:origin},body:new URLSearchParams({access_token:'synthetic-session'})});
async function run(createHandler,when){
 let row={user_id:'synthetic-owner',connection_version:OLD,import_enabled:true,tokens_ciphertext:envelope};
 let remoteStarted,signalRemoteStarted,allowRemote,releaseRemote;
 remoteStarted=new Promise(resolve=>signalRemoteStarted=resolve);
 allowRemote=new Promise(resolve=>releaseRemote=resolve);
 const events=[];
 let remoteCalls=0,deleted=0,earlyReconnect=false;
 const fetcher=async(url,init={})=>{
  const method=init.method||'GET';
  events.push({method,kind:url.endsWith('/user/registration')?'remote':url.includes('garmin_worker_lease')?'lease':'db'});
  if(url.endsWith('/auth/v1/user'))return Response.json({id:'synthetic-owner'});
  if(url.includes('/rest/v1/garmin_api_connections')&&method==='GET'&&url.includes('select=connection_version'))
   return Response.json(row?[{connection_version:row.connection_version}]:[]);
  if(url.includes('/rest/v1/garmin_api_connections')&&method==='PATCH'){
   if(row&&(!url.includes('connection_version=eq.')||url.includes('connection_version=eq.'+row.connection_version))){
    row={...row,import_enabled:false};
    return Response.json([row]);
   }
   return Response.json([]);
  }
  if(url.endsWith('/rpc/garmin_worker_lease'))return Response.json(true);
  if(url.includes('/rest/v1/garmin_api_connections')&&method==='GET'&&url.includes('select=tokens_ciphertext'))
   return Response.json(row&&url.includes('connection_version=eq.'+OLD)&&!row.import_enabled?[row]:[]);
  if(url.endsWith('/user/registration')&&method==='DELETE'){
   assert.equal(init.headers.Authorization,'Bearer synthetic-old-access');
   remoteCalls++;
   signalRemoteStarted();
   await allowRemote;
   return new Response(null,{status:204});
  }
  if(url.includes('/rest/v1/garmin_api_connections')&&method==='DELETE'){
   assert.ok(url.includes('connection_version=eq.'+OLD),'final cleanup must fence old generation');
   if(row?.connection_version===OLD){row=null;deleted++;}
   return Response.json([]);
  }
  throw Error('Unexpected mocked request: '+method+' '+url);
 };
 const handler=createHandler(k=>env[k],fetcher);
 const task=handler(req());
 if(when==='before-remote'){
  // Reconnection is injected after local stop but before the current-token read.
  // The worker must see no old row with current=true.
  // Not applicable to deferred-remote scenario.
 } else {
  await remoteStarted;
  row={...row,connection_version:NEW,import_enabled:true,tokens_ciphertext:'synthetic-new-envelope'};
  earlyReconnect=true;
  releaseRemote();
 }
 const result=await task;
 assert.equal(result.status,303);
 assert.equal(row.connection_version,NEW);
 assert.equal(row.import_enabled,true,'new locally connected generation must survive old cleanup');
 assert.equal(deleted,0,'old-generation DELETE must never remove new DB row');
 assert.equal(earlyReconnect,true);
 assert.equal(remoteCalls,1,'external provider DELETE still happened after reconnection');
 return {events,remoteCalls,deleted,result:result.status};
}
for(const [name,h] of [['original',originalHandler],['fenced-candidate',candidateHandler]]){
 const result=await run(h,'during-remote');
 assert.equal(result.remoteCalls,1);
}
// Crucial limitation: a remote DELETE accepted with the OLD bearer credential after
// reconnect may revoke more than just the old registration. Mock cannot prove provider semantics.
// It only proves that the local row is version fenced, NOT provider-side safety.
console.log('Mid-flight remote DELETE/reconnect synthetic PASS: new DB generation retained, old remote DELETE still executed; provider-side impact UNVERIFIED.');
