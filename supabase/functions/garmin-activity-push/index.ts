// Garmin Connect Developer Starter: Activity Details PUSH receiver.
// Does not touch Connect IQ garmin-link/garmin-ingest or Strava sync.
// Configure a high-entropy GARMIN_PUSH_SECRET in Supabase Secrets and Garmin's endpoint
// URL path /functions/v1/garmin-activity-push/<secret>. Do not expose it in source.
const F = 'garmin-activity-push';
const origin = 'https://runnersrings.com';
const allowedKinds = new Set(['RUNNING','INDOOR_RUNNING','OBSTACLE_RUN','STREET_RUNNING','TRACK_RUNNING','TRAIL_RUNNING','TREADMILL_RUNNING','ULTRA_RUN','VIRTUAL_RUN']);
const response = (status, message) => new Response(message,{status,headers:{'Cache-Control':'no-store','Content-Type':'text/plain;charset=utf-8'}});
const env = name => Deno.env.get(name) || '';
const dbHeaders = () => ({'apikey':env('SUPABASE_SERVICE_ROLE_KEY'),'Authorization':'Bearer '+env('SUPABASE_SERVICE_ROLE_KEY')});
async function db(path, init={}) {
  const r = await fetch(env('SUPABASE_URL')+'/rest/v1/'+path,{...init,headers:{...dbHeaders(),...(init.headers||{})},signal:AbortSignal.timeout(12000)});
  if(!r.ok) throw Error('database '+r.status);
  return r.status===204 ? [] : await r.json();
}
function equal(a,b) {
  const x=new TextEncoder().encode(a),y=new TextEncoder().encode(b);
  if(x.length!==y.length)return false;
  let z=0;for(let i=0;i<x.length;i++)z|=x[i]^y[i];return z===0;
}
function validDetails(obj) {
  if(!obj || typeof obj!=='object' || Array.isArray(obj))return false;
  if(!obj.userId || !obj.summaryId || typeof obj.userId!=='string' || typeof obj.summaryId!=='string')return false;
  if(obj.userId.length>256 || obj.summaryId.length>256)return false;
  if(!obj.summary || typeof obj.summary!=='object')return false;
  return true;
}
async function enqueue(raw) {
  if(!raw || typeof raw!=='object' || !Array.isArray(raw.activityDetails))throw Error('invalid push');
  if(Object.keys(raw).some(k=>k!=='activityDetails')) throw Error('unsupported push');
  if(raw.activityDetails.length>100)throw Error('batch too large');
  for(const details of raw.activityDetails) {
    if(!validDetails(details))throw Error('invalid detail');
    const matches=await db('garmin_api_connections?garmin_user_id=eq.'+encodeURIComponent(details.userId)+'&select=user_id&limit=2');
    if(matches.length!==1) continue; // Never create data for unknown / ambiguous accounts.
    const row={user_id:matches[0].user_id,garmin_user_id:details.userId,summary_id:details.summaryId,payload:details};
    // Preserve existing receipts on Garmin re-delivery.
    await db('garmin_activity_inbox?on_conflict=user_id,summary_id',{method:'POST',headers:{'Content-Type':'application/json','Prefer':'resolution=ignore-duplicates,return=representation'},body:JSON.stringify(row)});
  }
}
function parsed(details) {
  const s=details.summary,ty=s.activityType;
  if(!allowedKinds.has(ty)||s.manual===true)return null;
  if(!Number.isFinite(s.startTimeInSeconds)||!Number.isFinite(s.distanceInMeters)||s.distanceInMeters<=0)return null;
  if(!Array.isArray(details.samples))return null;
  const route=details.samples.map(p=>[p.latitudeInDegree,p.longitudeInDegree]).filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=90&&Math.abs(p[1])<=180);
  if(route.length<2)return null;
  const offset=Number.isFinite(s.startTimeOffsetInSeconds)?s.startTimeOffsetInSeconds:0;
  const started=new Date(s.startTimeInSeconds*1000);
  if(!Number.isFinite(started.getTime()))return null;
  const local=new Date((s.startTimeInSeconds+offset)*1000).toISOString().slice(0,10);
  const external='garmin-api:'+String(details.activityId||s.activityId||details.summaryId);
  return {activity_date:local,started_at:started.toISOString(),distance_km:s.distanceInMeters/1000,name:String(s.activityName||'Garmin Run').slice(0,200),route,source:'garmin',source_external_id:external};
}
async function mark(id,state,extra={}) {
  await db('garmin_activity_inbox?id=eq.'+id,{method:'PATCH',headers:{'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify({state,updated_at:new Date().toISOString(),...extra})});
}
async function drain() {
  const rows=await db('garmin_activity_inbox?state=in.(pending,retry)&next_retry_at=lte.'+encodeURIComponent(new Date().toISOString())+'&select=id,user_id,payload,attempts&order=id.asc&limit=15');
  for(const r of rows) {
    try {
      const claimed=await db('garmin_activity_inbox?id=eq.'+r.id+'&state=in.(pending,retry)',{method:'PATCH',headers:{'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify({state:'processing',attempts:r.attempts+1,updated_at:new Date().toISOString()})});
      if(!claimed.length)continue;
      const record=parsed(r.payload);
      if(!record) {await mark(r.id,'ignored');continue;}
      const existing=await db('runs?user_id=eq.'+r.user_id+'&activity_date=eq.'+record.activity_date+'&deleted_at=is.null&select=id,source,source_external_id,distance_km');
      const already=existing.some(e=>e.source_external_id===record.source_external_id || (Number.isFinite(e.distance_km)&&Math.abs(e.distance_km-record.distance_km)<=Math.max(0.5,e.distance_km*0.08)));
      if(already){await mark(r.id,'duplicate');continue;}
      try {
        await db('runs',{method:'POST',headers:{'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify({...record,user_id:r.user_id})});
      } catch(e) {
        // A unique index protects against two simultaneous receipts of the same Garmin ID.
        const check=await db('runs?user_id=eq.'+r.user_id+'&source_external_id=eq.'+encodeURIComponent(record.source_external_id)+'&select=id&limit=1');
        if(!check.length)throw e;
        await mark(r.id,'duplicate');continue;
      }
      await mark(r.id,'saved');
    } catch {
      const mins=Math.min(360,Math.pow(2,Math.min(r.attempts,8)));
      await mark(r.id,'retry',{next_retry_at:new Date(Date.now()+mins*60000).toISOString(),last_error:'processing failed'}).catch(()=>{});
    }
  }
}
Deno.serve(async req=>{
  if(req.method!=='POST')return response(405,'Method not allowed');
  const secret=env('GARMIN_PUSH_SECRET');
  if(!secret || secret.length<32 || !env('SUPABASE_URL') || !env('SUPABASE_SERVICE_ROLE_KEY'))return response(503,'Unavailable');
  const last=new URL(req.url).pathname.split('/').filter(Boolean).at(-1);
  if(last==='drain') {
    if(!equal(req.headers.get('Authorization')||'','Bearer '+env('SUPABASE_SERVICE_ROLE_KEY')))return response(403,'Forbidden');
    await drain();return response(200,'OK');
  }
  if(!equal(last||'',secret))return response(404,'Not found');
  const client=env('GARMIN_CLIENT_ID');
  if(!client || req.headers.get('garmin-client-id')!==client)return response(403,'Forbidden');
  const len=Number(req.headers.get('content-length')||0);
  if(len>8_000_000)return response(413,'Too large');
  let body;
  try {const value=await req.text();if(value.length>8_000_000)return response(413,'Too large');body=JSON.parse(value);}catch{return response(400,'Invalid JSON');}
  try{await enqueue(body);}catch{return response(503,'Retry later');}
  // Garmin requires HTTP 200 before activity processing. Receipt is durably queued above.
  // A scheduled POST /drain is still needed to recover interrupted background processing.
  EdgeRuntime.waitUntil(drain().catch(()=>{}));
  return response(200,'OK');
});
