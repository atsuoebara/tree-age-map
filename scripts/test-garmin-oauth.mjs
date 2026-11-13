// Regression tests for the CURRENT unmodified Garmin OAuth Edge Function.
// Synthetic credentials and HTTP only: no Supabase or Garmin network access.
import assert from 'node:assert/strict';
import { createHandler } from '../supabase/functions/garmin-oauth/index.ts';
const base='https://example.supabase.co/functions/v1/garmin-oauth';
const origin='https://runnersrings.com';
const values={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',GARMIN_CLIENT_ID:'synthetic-client',GARMIN_CLIENT_SECRET:'synthetic-secret',GARMIN_TOKEN_KEY:'ab'.repeat(32)};
const events=[];
const sessionMap=new Map();
let stored;
const request=async(url,init={})=>{
 const method=init.method||'GET';
 events.push({url,method,init});
 if(url.endsWith('/auth/v1/user'))return Response.json({id:'synthetic-owner'});
 if(url.includes('/rest/v1/garmin_oauth_sessions')){
  if(method==='POST'){
   const s=JSON.parse(init.body);
   sessionMap.set(s.state,s);
   return Response.json([s]);
  }
  const state=new URL(url).searchParams.get('state')?.slice(3);
  if(method==='GET'){
   const s=sessionMap.get(state);
   return Response.json(s?[{payload:s.payload,expires_at:s.expires_at}]:[]);
  }
  if(method==='DELETE'){sessionMap.delete(state);return Response.json([]);}
 }
 if(url.includes('/oauth/token'))return Response.json({access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_in:86400});
 if(url.endsWith('/user/id'))return Response.json({userId:'synthetic-garmin-user'});
 if(url.endsWith('/user/permissions'))return Response.json(['ACTIVITY_EXPORT']);
 if(url.includes('/rest/v1/garmin_api_connections')&&method==='POST'){
  stored=JSON.parse(init.body);return Response.json([stored]);
 }
 throw Error('Unexpected mock request: '+method+' '+url);
};
const h=createHandler(k=>values[k],request);
const empty=createHandler(()=>undefined,request);
const post=(route,access='synthetic-jwt',headers={})=>new Request(base+route,{method:'POST',headers:{Origin:origin,...headers},body:new URLSearchParams({access_token:access})});
assert.equal((await empty(new Request(base+'/callback'))).status,400);
assert.equal((await empty(new Request(base+'/callback?code=x&state=y'))).status,503);
assert.equal((await h(new Request(base+'/start',{method:'POST'}))).status,403);
assert.equal((await h(post('/start',''))).status,401);
const png=await h(new Request(base+'/logo.png'));
assert.equal(png.status,200);
assert.equal(png.headers.get('content-type'),'image/png');
const image=Buffer.from(await png.arrayBuffer());
assert.equal(image.readUInt32BE(16),300);
assert.equal(image.readUInt32BE(20),300);
const started=await h(post('/start'));
assert.equal(started.status,303);
const auth=new URL(started.headers.get('location'));
assert.equal(auth.origin,'https://connect.garmin.com');
assert.equal(auth.searchParams.get('redirect_uri'),base+'/callback');
assert.equal(auth.searchParams.get('code_challenge_method'),'S256');
const state=auth.searchParams.get('state');
assert.ok(sessionMap.has(state),'OAuth PKCE session must be persisted before redirect');
const record=sessionMap.get(state);
assert.ok(!JSON.stringify(record).includes('synthetic-jwt'));
assert.ok(!JSON.stringify(record).includes('synthetic-access'));
assert.ok(started.headers.get('set-cookie').includes('HttpOnly; Secure; SameSite=Lax'));
const callback=(s=state,extra='code=synthetic-one-use-code')=>new Request(base+'/callback?'+extra+'&state='+s);
const before=events.length;
assert.equal((await h(callback('not-a-stored-state'))).status,200,'missing session is a guidance page');
assert.equal((await h(callback(state,'error=access_denied'))).status,400);
assert.equal(events.filter(e=>e.url.includes('/oauth/token')).length,0,'denied grant must not exchange token');
const saved=sessionMap.get(state);
sessionMap.set(state,{...saved,expires_at:new Date(Date.now()-1000).toISOString()});
assert.equal((await h(callback())).status,200,'expired stored session gives guidance');
sessionMap.set(state,saved);
const res=await h(callback());
assert.equal(res.status,200,'current callback displays browser return guidance');
assert.match(await res.text(),/Garminの認証が終了/);
assert.ok(res.headers.get('set-cookie').includes('Max-Age=0'));
assert.equal(sessionMap.has(state),false,'completed one-use OAuth session must be removed');
assert.equal(stored.user_id,'synthetic-owner');
assert.equal(stored.garmin_user_id,'synthetic-garmin-user');
assert.equal(stored.import_enabled,true);
assert.ok(stored.connection_version);
assert.ok(!stored.tokens_ciphertext.includes('synthetic-access'),'tokens must be encrypted');
const tokenExchange=events.find(e=>e.url.includes('/oauth/token'));
const verifier=tokenExchange.init.body.get('code_verifier');
const challenge=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))).toString('base64url');
assert.equal(challenge,auth.searchParams.get('code_challenge'));
assert.equal(tokenExchange.init.body.get('redirect_uri'),base+'/callback');
assert.ok(events.every(e=>!e.url.includes('strava')&&!e.url.includes('/garmin_connections')));
assert.equal((await h(callback())).status,200,'replayed callback cannot reuse deleted session');
// The current disconnect uses an unguarded first PATCH. This test documents
// existing behavior; the race is covered separately and still No-Go for production.
async function disconnectScenario(remoteStatus){
 const calls=[];
 const mock=async(url,init={})=>{
  const method=init.method||'GET';
  calls.push({url,method,init});
  if(url.endsWith('/auth/v1/user'))return Response.json({id:'synthetic-owner'});
  if(url.includes('/rest/v1/garmin_api_connections')&&method==='PATCH')return Response.json([{...stored,import_enabled:false}]);
  if(url.endsWith('/rpc/garmin_worker_lease'))return Response.json(true);
  if(url.includes('select=tokens_ciphertext'))return Response.json([{...stored,import_enabled:false}]);
  if(url.endsWith('/user/registration'))return remoteStatus===204?new Response(null,{status:204}):new Response('',{status:remoteStatus});
  if(url.includes('/rest/v1/garmin_api_connections')&&method==='DELETE')return Response.json([]);
  throw Error('Unexpected disconnect mock: '+method+' '+url);
 };
 const result=await createHandler(k=>values[k],mock)(post('/disconnect'));
 assert.equal(result.status,303);
 assert.equal(result.headers.get('location'),origin+'/?garmin=disconnected');
 assert.equal(calls.find(e=>e.method==='PATCH').init.body.includes('"import_enabled":false'),true);
 assert.ok(calls.some(e=>e.url.endsWith('/rpc/garmin_worker_lease')&&JSON.parse(e.init.body).p_release===true),'worker lease must release');
 assert.ok(calls.some(e=>e.url.endsWith('/user/registration')),'must try Garmin remote revoke');
 assert.equal(calls.some(e=>e.method==='DELETE'&&e.url.includes('/garmin_api_connections')),remoteStatus===204,
  'remote outage must preserve local credentials for worker retry');
 return calls;
}
const cleared=await disconnectScenario(204);
assert.ok(cleared.some(e=>e.method==='DELETE'&&e.url.includes('connection_version=eq.'+stored.connection_version)),
 'connection delete must be generation fenced');
await disconnectScenario(503);
const statusMock=async url=>{
 if(url.endsWith('/auth/v1/user'))return Response.json({id:'synthetic-owner'});
 assert.ok(url.includes('user_id=eq.synthetic-owner&import_enabled=eq.true&select=user_id'));
 return Response.json([{user_id:'synthetic-owner'}]);
};
const sh=createHandler(k=>values[k],statusMock);
const status=await sh(post('/status'));
assert.equal(status.status,200);
assert.deepEqual(await status.json(),{connected:true});
assert.equal(status.headers.get('access-control-allow-origin'),origin);
assert.equal((await sh(post('/status','synthetic-jwt',{Origin:'https://untrusted.invalid'}))).status,403);
console.log('Garmin OAuth current-source regression PASS: PKCE, persisted session, callback, replay, encrypted token, revoke success/503, status and origin.');
