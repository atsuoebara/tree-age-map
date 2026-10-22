// Activity API 2.0 sections 3, 4, 6.3: Starter Push; no Ping/Pull or backfill.
// Never log URLs, payloads, provider tokens or secrets.
const allowedKinds=new Set(['RUNNING','INDOOR_RUNNING','OBSTACLE_RUN','STREET_RUNNING','TRACK_RUNNING','TRAIL_RUNNING','TREADMILL_RUNNING','ULTRA_RUN','VIRTUAL_RUN']);
const env=name=>Deno.env.get(name)||'';
const response=(status,message)=>new Response(message,{status,headers:{'Cache-Control':'no-store','Content-Type':'text/plain;charset=utf-8','X-Content-Type-Options':'nosniff'}});
async function db(path,init={}) {
  const key=env('SUPABASE_SERVICE_ROLE_KEY');
  const r=await fetch(env('SUPABASE_URL')+'/rest/v1/'+path,{...init,headers:{apikey:key,Authorization:'Bearer '+key,...(init.headers||{})},signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw Error('database unavailable');
  return r.status===204?[]:r.json();
}
const rpc=(name,body)=>db('rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const patch=(path,body)=>db(path,{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(body)});
function equal(a,b) {
  const x=new TextEncoder().encode(a),y=new TextEncoder().encode(b);
  if(x.length!==y.length)return false;
  let z=0;for(let i=0;i<x.length;i++)z|=x[i]^y[i];return z===0;
}
function validDetails(d) {
  return !!(d&&typeof d==='object'&&!Array.isArray(d)&&typeof d.userId==='string'&&d.userId.length>0&&d.userId.length<=256&&
    typeof d.summaryId==='string'&&d.summaryId.length>0&&d.summaryId.length<=256&&d.summary&&typeof d.summary==='object'&&!Array.isArray(d.summary));
}
function parsed(d) {
  if(!validDetails(d))return null;
  const s=d.summary;
  if(!allowedKinds.has(s.activityType)||s.manual===true||s.isParent===true)return null;
  if(!Number.isFinite(s.startTimeInSeconds)||!Number.isFinite(s.distanceInMeters)||s.distanceInMeters<=0||!Array.isArray(d.samples))return null;
  const route=d.samples.filter(p=>p&&typeof p==='object').map(p=>[p.latitudeInDegree,p.longitudeInDegree])
    .filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=90&&Math.abs(p[1])<=180);
  if(route.length<2)return null;
  const offset=Number.isFinite(s.startTimeOffsetInSeconds)?s.startTimeOffsetInSeconds:0;
  const started=new Date(s.startTimeInSeconds*1000),local=new Date((s.startTimeInSeconds+offset)*1000);
  if(!Number.isFinite(started.getTime())||!Number.isFinite(local.getTime()))return null;
  const id=d.activityId??s.activityId??d.summaryId;
  if(!['string','number'].includes(typeof id)||String(id).length>256)return null;
  return {activity_date:local.toISOString().slice(0,10),started_at:started.toISOString(),distance_km:s.distanceInMeters/1000,
    name:String(s.activityName||'Garmin Run').slice(0,200),route,source:'garmin',source_external_id:'garmin-api:'+id};
}
// Persist importer fields only: discard legacy userAccessToken and unused sensor data.
function sanitized(d) {
  const s=d.summary;
  return {userId:d.userId,summaryId:d.summaryId,activityId:d.activityId,summary:Object.fromEntries(
    ['activityId','activityType','activityName','startTimeInSeconds','startTimeOffsetInSeconds','distanceInMeters','manual','isParent'].filter(k=>s[k]!==undefined).map(k=>[k,s[k]])),
    samples:Array.isArray(d.samples)?d.samples.map(p=>p&&({latitudeInDegree:p.latitudeInDegree,longitudeInDegree:p.longitudeInDegree})):[]};
}
async function enqueue(body) {
  if(!body||typeof body!=='object'||Array.isArray(body))throw Error('invalid notification');
  const keys=Object.keys(body);
  if(!keys.length||keys.some(k=>!['activityDetails','deregistrations','userPermissionsChange'].includes(k)))throw Error('unsupported notification');
  for(const k of keys)if(!Array.isArray(body[k])||body[k].length>100)throw Error('invalid batch');
  if(body.activityDetails&&!body.activityDetails.every(validDetails))throw Error('invalid detail');
  // Lifecycle shapes are not defined by Activity API 2.0. Treat these as hints only;
  // do not trust their permissions or allow a delayed event to delete a new registration.
  const hints=[...(body.deregistrations||[]),...(body.userPermissionsChange||[])];
  if(hints.some(d=>!d||typeof d.userId!=='string'||!d.userId.length||d.userId.length>256))throw Error('invalid lifecycle hint');
  if(hints.length)await rpc('garmin_invalidate_permissions',{p_user_ids:[...new Set(hints.map(d=>d.userId))]});
  if(body.activityDetails)await rpc('garmin_receive_details',{p_details:body.activityDetails.map(sanitized)});
}
const encoder=new TextEncoder();
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const unb64=value=>Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
async function tokenKey() {
  const value=env('GARMIN_TOKEN_KEY');
  if(!/^[0-9a-f]{64}$/i.test(value))throw Error('token configuration');
  return crypto.subtle.importKey('raw',Uint8Array.from(value.match(/../g),x=>parseInt(x,16)),'AES-GCM',false,['encrypt','decrypt']);
}
async function openTokens(c) {
  const [iv,body]=c.tokens_ciphertext.split('.');
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv),additionalData:encoder.encode('tokens:'+c.user_id)},await tokenKey(),unb64(body))));
}
async function sealTokens(c,tokens) {
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode('tokens:'+c.user_id)},await tokenKey(),encoder.encode(JSON.stringify(tokens)));
  return b64(iv)+'.'+b64(new Uint8Array(bytes));
}
const connectionPath=c=>'garmin_api_connections?user_id=eq.'+c.user_id+'&connection_version=eq.'+c.connection_version;
async function reconcile(c) {
  const path=connectionPath(c);
  let tokens=await openTokens(c);
  const refresh=async()=>{
    const r=await fetch('https://diauth.garmin.com/di-oauth2-service/oauth/token',{method:'POST',body:new URLSearchParams({grant_type:'refresh_token',client_id:env('GARMIN_CLIENT_ID'),client_secret:env('GARMIN_CLIENT_SECRET'),refresh_token:tokens.refresh_token}),signal:AbortSignal.timeout(10000)});
    if(!r.ok) {
      // A definitive invalid grant cannot recover by retrying the same refresh token.
      if(r.status===400) {
        const error=await r.json().catch(()=>({}));
        if(error.error==='invalid_grant')await db(path,{method:'DELETE',headers:{Prefer:'return=representation'}});
      }
      throw Error('refresh unavailable');
    }
    const t=await r.json();
    if(!t.access_token||!t.refresh_token||!Number.isFinite(t.expires_in))throw Error('invalid tokens');
    tokens={...t,expires_at:Date.now()+t.expires_in*1000};
    if(!(await patch(path,{tokens_ciphertext:await sealTokens(c,tokens)})).length)throw Error('connection changed');
  };
  if(tokens.expires_at<=Date.now()+600000)await refresh();
  const upstream=method=>fetch('https://apis.garmin.com/wellness-api/rest/user/'+(method==='DELETE'?'registration':'permissions'),
    {method,headers:{Authorization:'Bearer '+tokens.access_token},signal:AbortSignal.timeout(10000)});
  let r=await upstream(c.import_enabled?'GET':'DELETE');
  if(r.status===401){await refresh();r=await upstream(c.import_enabled?'GET':'DELETE');}
  if(r.status===403||(!c.import_enabled&&(r.ok||r.status===404||r.status===410))) {
    await db(path,{method:'DELETE',headers:{Prefer:'return=representation'}});return false;
  }
  if(!r.ok)throw Error('permissions unavailable');
  const value=await r.json(),permissions=Array.isArray(value)?value:value?.permissions;
  if(!Array.isArray(permissions)||permissions.some(p=>typeof p!=='string'))throw Error('invalid permissions');
  const changed=await patch(path+'&import_enabled=eq.true',{permissions,permissions_checked_at:new Date().toISOString(),permissions_retry_at:new Date(Date.now()+120000).toISOString()});
  return changed.length===1&&permissions.includes('ACTIVITY_EXPORT');
}
async function drain() {
  const lease=crypto.randomUUID();
  if(!await rpc('garmin_worker_lease',{p_token:lease}))return;
  const deadline=Date.now()+45000;
  const failedChecks=new Set();
  try {
    // Check oldest accounts even without receipts: lost lifecycle hints self-heal.
    const connections=await db('garmin_api_connections?select=*&permissions_retry_at=lte.'+encodeURIComponent(new Date().toISOString())+'&order=permissions_retry_at.asc&limit=2');
    for(const c of connections) {
      if(Date.now()>deadline)break;
      try{await reconcile(c);}catch{failedChecks.add(c.user_id);await patch(connectionPath(c),{permissions_checked_at:null,permissions_retry_at:new Date(Date.now()+300000).toISOString()}).catch(()=>{});}
    }
    const stale=new Date(Date.now()-360000).toISOString();
    await patch('garmin_activity_inbox?state=eq.processing&updated_at=lt.'+encodeURIComponent(stale),{state:'retry',next_retry_at:new Date().toISOString(),updated_at:new Date().toISOString(),last_error:'interrupted processing'});
    const rows=await db('garmin_activity_inbox?state=in.(pending,retry)&next_retry_at=lte.'+encodeURIComponent(new Date().toISOString())+'&select=id,user_id,garmin_user_id,connection_version,payload,attempts&order=next_retry_at.asc,id.asc&limit=10');
    for(const r of rows) {
      if(Date.now()>deadline)break;
      const attempt=r.attempts+1;
      const claimed=await patch('garmin_activity_inbox?id=eq.'+r.id+'&state=in.(pending,retry)&attempts=eq.'+r.attempts,{state:'processing',attempts:attempt,updated_at:new Date().toISOString()});
      if(!claimed.length)continue;
      const receipt='garmin_activity_inbox?id=eq.'+r.id+'&state=eq.processing&attempts=eq.'+attempt;
      try {
        if(failedChecks.has(r.user_id))throw Error('permissions unavailable');
        const cs=await db('garmin_api_connections?user_id=eq.'+r.user_id+'&select=*');
        if(cs.length&&cs[0].import_enabled&&cs[0].connection_version===r.connection_version&&
          (!cs[0].permissions_checked_at||Date.parse(cs[0].permissions_checked_at)<Date.now()-120000)) {
          if(Date.now()>deadline)throw Error('worker deadline');
          await reconcile(cs[0]);
        }
        await rpc('garmin_commit_activity',{p_id:r.id,p_attempt:attempt,p_record:parsed(r.payload)});
      }catch{
        await patch(receipt,{state:'retry',next_retry_at:new Date(Date.now()+Math.min(360,2**Math.min(attempt-1,9))*60000).toISOString(),updated_at:new Date().toISOString(),last_error:'processing unavailable'}).catch(()=>{});
      }
    }
  }finally{await rpc('garmin_worker_lease',{p_token:lease,p_release:true}).catch(()=>{});}
}
async function readBody(req) {
  if(Number(req.headers.get('content-length')||0)>8000000)throw Error('too large');
  const reader=req.body?.getReader();if(!reader)return '';
  const chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8000000)throw Error('too large');chunks.push(value);}}
  finally{await reader.cancel().catch(()=>{});}
  const bytes=new Uint8Array(size);let at=0;for(const part of chunks){bytes.set(part,at);at+=part.length;}
  return new TextDecoder().decode(bytes);
}
Deno.serve(async req=>{
  if(req.method!=='POST')return response(405,'Method not allowed');
  if(!env('SUPABASE_URL')||!env('SUPABASE_SERVICE_ROLE_KEY'))return response(503,'Unavailable');
  const last=new URL(req.url).pathname.split('/').filter(Boolean).at(-1);
  if(last==='drain') {
    const token=(req.headers.get('Authorization')||'').replace(/^Bearer /,'');
    try{
      if(!equal(token,env('SUPABASE_SERVICE_ROLE_KEY'))&&(!/^[0-9a-f]{64}$/.test(token)||!await rpc('garmin_check_drain_token',{p_token:token})))return response(403,'Forbidden');
      EdgeRuntime.waitUntil(drain().catch(()=>console.error('garmin worker unavailable')));
      return response(200,'Accepted');
    }catch{return response(503,'Retry later');}
  }
  const secret=env('GARMIN_PUSH_SECRET');
  if(secret.length<32||!env('GARMIN_CLIENT_ID'))return response(503,'Unavailable');
  if(!equal(last||'',secret))return response(404,'Not found');
  const client=req.headers.get('garmin-client-id');
  if(client&&client!==env('GARMIN_CLIENT_ID'))return response(403,'Forbidden');
  let body;
  try{body=JSON.parse(await readBody(req));}catch(e){return response(e.message==='too large'?413:400,'Invalid notification');}
  try{await enqueue(body);}catch{return response(503,'Retry later');}
  // Acknowledge durable receipt first. Non-200 requests provider redelivery on DB failure.
  EdgeRuntime.waitUntil(drain().catch(()=>console.error('garmin worker unavailable')));
  return response(200,'OK');
});
