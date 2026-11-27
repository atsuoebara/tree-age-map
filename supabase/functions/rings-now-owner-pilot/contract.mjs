// Unpublished owner-only trial candidate. Never accepts FIT or run information.
const ORIGIN='https://runnersrings.com';
const BODY='{"protocol":"rings-now-review-v1","build":"v1"}';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createOwnerPilotHandler({getUser,ownerId,enabled=false,expiresAtMs=0,nowMs=Date.now}={}){
 return async request=>{
  const origin=request.headers.get('origin');
  const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','vary':'Origin'};
  if(origin===ORIGIN)headers['access-control-allow-origin']=ORIGIN;
  const reply=(status,allowed=false)=>new Response(JSON.stringify({protocol:'rings-now-review-v1',build:'v1',enabled:allowed}),{status,headers});
  if(origin!==ORIGIN)return reply(403);
  if(request.method==='OPTIONS'){
   if(request.headers.get('access-control-request-method')!=='POST'||request.headers.get('access-control-request-headers')?.toLowerCase().split(',').map(s=>s.trim()).sort().join(',')!=='authorization,content-type')return reply(403);
   return new Response(null,{status:204,headers:{...headers,'access-control-allow-methods':'POST','access-control-allow-headers':'authorization,content-type','access-control-max-age':'0'}});
  }
  if(request.method!=='POST')return reply(405);
  const active=()=>enabled===true&&UUID.test(ownerId||'')&&Number.isSafeInteger(expiresAtMs)&&nowMs()<expiresAtMs;
  if(!active())return reply(403);
  const authorization=request.headers.get('authorization')||'';
  if(!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(authorization)||authorization.length>8192)return reply(401);
  if(request.headers.get('content-type')!=='application/json')return reply(415);
  try{
   const reader=request.body?.getReader();if(!reader)return reply(400);
   let size=0,body='';const decoder=new TextDecoder('utf-8',{fatal:true});
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>128){await reader.cancel();return reply(400)}body+=decoder.decode(value,{stream:true})}body+=decoder.decode()}finally{reader.releaseLock()}
   if(body!==BODY)return reply(400);
   const user=await getUser(authorization.slice(7));
   if(!active()||user?.id!==ownerId||user?.is_anonymous!==false)return reply(403);
   return reply(200,true);
  }catch{return reply(403)}
 };
}
