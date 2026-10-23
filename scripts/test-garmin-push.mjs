import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../supabase/functions/garmin-activity-push/index.ts',import.meta.url),'utf8');
let handler,requests=[],tasks=[];
const secret='test-only-'.repeat(4);
const values={GARMIN_PUSH_SECRET:secret,SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_ROLE_KEY:'test-admin',GARMIN_CLIENT_ID:'test-client',GARMIN_CLIENT_SECRET:'test-client-secret',GARMIN_TOKEN_KEY:'ab'.repeat(32)};
let fetcher=async()=>[];
const context=vm.createContext({TextEncoder,TextDecoder,Response,Request,URL,URLSearchParams,AbortSignal,Date,JSON,crypto,btoa,atob,console,
  Deno:{env:{get:k=>values[k]},serve:fn=>{handler=fn}},EdgeRuntime:{waitUntil:p=>tasks.push(p)},
  fetch:async(url,init={})=>{requests.push({url,init});const value=await fetcher(url,init);return value instanceof Response?value:Response.json(value);}});
vm.runInContext(source,context);
const run=code=>vm.runInContext(code,context);
const detail={userId:'garmin-1',summaryId:'summary',activityId:42,userAccessToken:'must-not-persist',summary:{activityType:'RUNNING',startTimeInSeconds:1700000000,startTimeOffsetInSeconds:32400,distanceInMeters:5000},samples:[null,{latitudeInDegree:35,longitudeInDegree:139,heartRate:140},{latitudeInDegree:35.1,longitudeInDegree:139.1}]};
context.detail=detail;
const record=run('parsed(detail)');
assert.equal(record.source_external_id,'garmin-api:42');assert.equal(record.route.length,2);assert.equal(record.distance_km,5);
// Treadmill/indoor runs retain distance without manufacturing geographic data.
for(const kind of ['TREADMILL_RUNNING','INDOOR_RUNNING']) {
  context.indoorDetail={...detail,summary:{...detail.summary,activityType:kind},samples:[]};
  const indoorRun=run('parsed(indoorDetail)');
  assert.equal(indoorRun.distance_km,5);
  assert.equal(indoorRun.indoor,true);
  assert.equal(indoorRun.route.length,0);
}
context.indoorDetail={...detail,summary:{...detail.summary,activityType:'TREADMILL_RUNNING'},samples:undefined};
assert.equal(run('parsed(indoorDetail)').route.length,0);
context.changed={...detail,summary:{...detail.summary,activityType:'RUNNING'},samples:[]};
assert.equal(run('parsed(changed)'),null);
assert.ok(!JSON.stringify(run('sanitized(detail)')).includes('must-not-persist'));
assert.ok(!JSON.stringify(run('sanitized(detail)')).includes('heartRate'));
for(const changed of [{manual:true},{isParent:true},{activityType:'CYCLING'},{startTimeOffsetInSeconds:1e30},{distanceInMeters:-1}]) {
  context.changed={...detail,summary:{...detail.summary,...changed}};assert.equal(run('parsed(changed)'),null);
}
context.changed={...detail,samples:[null,{latitudeInDegree:91,longitudeInDegree:180}]};assert.equal(run('parsed(changed)'),null);
const post=(path,body='{}',headers={})=>handler(new Request('https://test.invalid/'+path,{method:'POST',body,headers}));
assert.equal((await post('wrong')).status,404);assert.equal((await post('drain')).status,403);assert.equal(requests.length,0);
assert.equal((await post(secret,'{broken')).status,400);
assert.equal((await post(secret,'{}',{'content-length':'8000001'})).status,413);
assert.equal((await post(secret,'{}',{'garmin-client-id':'wrong'})).status,403);
context.bad={activityDetails:[detail,{}]};await assert.rejects(run('enqueue(bad)'));assert.equal(requests.length,0);
fetcher=async()=>{throw Error('database unavailable');};
assert.equal((await post(secret,JSON.stringify({activityDetails:[detail]}))).status,503);
requests=[];
fetcher=async(url)=>url.endsWith('/rpc/garmin_receive_details')?1:false;
assert.equal((await post(secret,JSON.stringify({activityDetails:[detail]}))).status,200);
await Promise.all(tasks);tasks=[];
assert.ok(requests.some(r=>r.url.endsWith('/rpc/garmin_receive_details')));
requests=[];
context.hint={userPermissionsChange:[{userId:'garmin-1',permissions:['WORKOUT_IMPORT']}],deregistrations:[{userId:'garmin-1'}]};
await run('enqueue(hint)');
assert.equal(requests.length,1);
assert.ok(requests[0].url.endsWith('/rpc/garmin_invalidate_permissions'),'hints invalidate cache, never directly delete/regrant');
assert.deepEqual(JSON.parse(requests[0].init.body).p_user_ids,['garmin-1']);
// Provider reconciliation uses encrypted tokens identical to the existing OAuth envelope.
context.connection={user_id:'owner',connection_version:'version',import_enabled:true};
context.tokens={access_token:'access',refresh_token:'refresh',expires_at:Date.now()+3600000};
context.connection.tokens_ciphertext=await run('sealTokens(connection,tokens)');
let permsStatus=200;
fetcher=async(url,init)=>{
  if(url.endsWith('/user/permissions'))return permsStatus===200?Response.json({permissions:['ACTIVITY_EXPORT']}):new Response('',{status:permsStatus});
  if(url.includes('/oauth/token'))return {access_token:'rotated',refresh_token:'rotated-refresh',expires_in:86400};
  return init.method==='PATCH'?[context.connection]:[];
};
assert.equal(await run('reconcile(connection)'),true);
permsStatus=403;requests=[];assert.equal(await run('reconcile(connection)'),false);
assert.ok(requests.some(r=>r.init.method==='DELETE'&&r.url.includes('connection_version=eq.version')));
permsStatus=500;requests=[];await assert.rejects(run('reconcile(connection)'));
assert.ok(!requests.some(r=>r.init.method==='DELETE'),'outage preserves credentials');
context.connection.import_enabled=false;
fetcher=async(url,init)=>url.endsWith('/user/registration')?new Response(null,{status:204}):[];
assert.equal(await run('reconcile(connection)'),false,'remote revocation recovery');
context.connection.import_enabled=true;
context.tokens.expires_at=0;
context.connection.tokens_ciphertext=await run('sealTokens(connection,tokens)');
requests=[];
fetcher=async(url)=>url.includes('/oauth/token')?Response.json({error:'invalid_grant'},{status:400}):[];
await assert.rejects(run('reconcile(connection)'));
assert.ok(requests.some(r=>r.init.method==='DELETE'&&r.url.includes('connection_version=eq.version')),'definitive invalid grant drops only current registration');
// Worker failure keeps the current fenced receipt retryable; stale workers cannot overwrite a later attempt.
requests=[];
fetcher=async(url,init)=>{
  if(url.endsWith('/rpc/garmin_worker_lease'))return true;
  if(url.includes('permissions_retry_at=lte.'))return [];
  if(url.includes('&order=next_retry_at'))return [{id:1,user_id:'owner',connection_version:'version',payload:detail,attempts:0}];
  if(url.includes('&attempts=eq.0'))return [{id:1}];
  if(url.includes('user_id=eq.owner&select=*'))return [{import_enabled:true,connection_version:'version',permissions_checked_at:null}];
  return [];
};
await run('drain()');
assert.ok(requests.some(r=>r.url.includes('state=eq.processing&attempts=eq.1')&&JSON.parse(r.init.body).state==='retry'));
assert.ok(!requests.some(r=>r.url.endsWith('/rpc/garmin_commit_activity')),'unverified permission cannot import');
fetcher=async(url)=>url.endsWith('/rpc/garmin_check_drain_token')?false:[];
assert.equal((await post('drain','{}',{Authorization:'Bearer '+'a'.repeat(64)})).status,403);
await Promise.all(tasks);
console.log('Garmin Push mocks passed: parsing, minimization, auth/body limits, receipt failure, lifecycle hints, permissions, outage, remote revoke recovery, fenced retry.');
