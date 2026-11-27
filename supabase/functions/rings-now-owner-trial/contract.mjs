import {authorizeOwnerTrial} from './authorization.mjs';
const origin='https://runnersrings.com';
const headers={'cache-control':'no-store','content-type':'application/json','vary':'Origin'};
const cors={'access-control-allow-origin':origin};
const result=(enabled,status=200,allowed=true)=>new Response(JSON.stringify({protocol:'rings-now-review-v1',build:'v1',enabled}),{status,headers:{...headers,...(allowed?cors:{})}});
// A runtime may represent even a bodyless POST as an empty stream.
// Accept zero bytes only; reject the first nonempty chunk, errors, or a stalled
// stream. The chunk budget also bounds pathological zero-length streams.
async function hasEmptyBody(request){
 const length=request.headers.get('content-length');
 if(length!==null&&length!=='0')return false;
 if(request.body===null)return true;
 let reader,timer,complete=false;
 try{
  reader=request.body.getReader();
  const deadline=new Promise(resolve=>{timer=setTimeout(()=>resolve(null),1000)});
  for(let i=0;i<16;i++){
   const part=await Promise.race([reader.read(),deadline]);
   if(part===null)return false;
   if(part.done){complete=true;return true}
   if(!(part.value instanceof Uint8Array)||part.value.byteLength!==0)return false;
  }
  return false;
 }catch{return false}
 finally{
  clearTimeout(timer);
  if(reader){
   if(!complete){try{void reader.cancel().catch(()=>{})}catch{/* deny */}}
   try{reader.releaseLock()}catch{/* deny */}
  }
 }
}
export async function handleOwnerTrial(request,config){
 if(request.headers.get('origin')!==origin)return result(false,403,false);
 if(request.method==='OPTIONS'){
  if(request.headers.get('access-control-request-method')!=='POST'||request.headers.get('access-control-request-headers')?.toLowerCase().trim()!=='authorization')return result(false,403);
  return new Response(null,{status:204,headers:{...headers,...cors,'access-control-allow-methods':'POST','access-control-allow-headers':'authorization','access-control-max-age':'0'}});
 }
 if(request.method!=='POST'||!await hasEmptyBody(request))return result(false,400);
 const token=/^Bearer ([A-Za-z0-9._-]{1,8192})$/.exec(request.headers.get('authorization')||'')?.[1];
 return result(await authorizeOwnerTrial({...config,token}));
}
