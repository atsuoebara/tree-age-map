// Offline integration: execute the UNMODIFIED production receiver's reconcile()
// with synthetic Garmin HTTP and database responses. No network, no real credentials.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../supabase/functions/garmin-activity-push/index.ts',import.meta.url),'utf8');
let actualHandler,fetcher,callLog=[];
const creds={GARMIN_PUSH_SECRET:'synthetic-secret-'.repeat(3),SUPABASE_URL:'https://db.invalid',
 SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',GARMIN_CLIENT_ID:'synthetic-client',
 GARMIN_CLIENT_SECRET:'synthetic-client-secret',GARMIN_TOKEN_KEY:'aa'.repeat(32)};
const sandbox=vm.createContext({TextEncoder,TextDecoder,Request,Response,URL,URLSearchParams,AbortSignal,
 Date,JSON,crypto,btoa,atob,console,
 Deno:{env:{get:k=>creds[k]},serve:fn=>{actualHandler=fn}},
 EdgeRuntime:{waitUntil:()=>{}},
 fetch:async(url,init={})=>{callLog.push({url,method:init.method||'GET'});
  const v=await fetcher(url,init);
  return v instanceof Response?v:Response.json(v);
 }});
vm.runInContext(source,sandbox);
const evaluate=code=>vm.runInContext(code,sandbox);
const c={user_id:'synthetic-owner',garmin_user_id:'synthetic-garmin',
 connection_version:'00000000-0000-0000-0000-000000000001',
 import_enabled:false,permissions_checked_at:null};
sandbox.connection=c;
c.tokens_ciphertext=await evaluate("sealTokens(connection,{access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_at:Date.now()+3600000})");
const pathFragment='connection_version=eq.'+c.connection_version;
const deletes=()=>callLog.filter(x=>x.method==='DELETE'&&x.url.includes('/rest/v1/garmin_api_connections'));
const remoteDeletes=()=>callLog.filter(x=>x.method==='DELETE'&&x.url.endsWith('/user/registration'));

let stage=0;
fetcher=async(url,init)=>{
 if(url.endsWith('/user/registration')){
   stage++;
   return stage<=2?new Response('',{status:503}):new Response(null,{status:204});
 }
 if(url.includes('/rest/v1/garmin_api_connections')&&init.method==='DELETE')return [{connection_version:c.connection_version}];
 throw Error('Unexpected synthetic request');
};
for(let i=0;i<2;i++){
 await assert.rejects(evaluate('reconcile(connection)'),/permissions unavailable/);
 assert.equal(deletes().length,0,'transient Garmin outage must retain local encrypted credentials for retry');
 assert.equal(remoteDeletes().length,i+1);
}
assert.equal(await evaluate('reconcile(connection)'),false);
assert.equal(deletes().length,1);
assert.ok(deletes()[0].url.includes(pathFragment),'old-generation delete must carry connection version fencing');
assert.equal(remoteDeletes().length,3);
// Idempotent remote already-gone response is treated as successful revocation.
for(const status of [404,410]){
 callLog=[];
 fetcher=async(url,init)=>{
  if(url.endsWith('/user/registration'))return new Response('',{status});
  if(url.includes('/rest/v1/garmin_api_connections')&&init.method==='DELETE')return [];
  throw Error('Unexpected synthetic request');
 };
 assert.equal(await evaluate('reconcile(connection)'),false);
 assert.equal(deletes().length,1);
 assert.ok(deletes()[0].url.includes(pathFragment));
}
// A reconnected row with another generation must not be deleted by old worker.
callLog=[];
const newGeneration='00000000-0000-0000-0000-000000000002';
fetcher=async(url,init)=>{
 if(url.endsWith('/user/registration'))return new Response(null,{status:204});
 if(url.includes('/rest/v1/garmin_api_connections')&&init.method==='DELETE'){
  assert.ok(url.includes(pathFragment));
  assert.ok(!url.includes(newGeneration));
  return []; // PostgREST filter matched no row: new generation was protected
 }
 throw Error('Unexpected synthetic request');
};
assert.equal(await evaluate('reconcile(connection)'),false);
assert.equal(deletes().length,1);
// GET-only permission hint must NOT directly delete the new registration.
callLog=[];
sandbox.hint={deregistrations:[{userId:'synthetic-garmin'}]};
fetcher=async(url,init)=>{
 if(url.endsWith('/rpc/garmin_invalidate_permissions')&&init.method==='POST')return null;
 throw Error('Unexpected synthetic request');
};
await evaluate('enqueue(hint)');
assert.equal(deletes().length,0);
assert.equal(remoteDeletes().length,0);
assert.ok(callLog.some(x=>x.url.endsWith('/rpc/garmin_invalidate_permissions')));
// Don't falsely claim to prove a globally once-only remote DELETE: repeat call can
// reach Garmin again. Worker lease + version fence are separate safeguards.
assert.ok(actualHandler,'source handler must initialize');
console.log('Production reconcile offline mocks PASS: 503 retries, 204/404/410, generation fencing, hint-only invalidation.');
