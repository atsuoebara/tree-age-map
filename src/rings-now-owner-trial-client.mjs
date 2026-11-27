import {normalizeRingsNowControl} from './rings-now-control-client.mjs';
const endpoint='https://fhwvntpzwyenendhcgbw.supabase.co/functions/v1/rings-now-owner-trial';
// Parent only. Never forward credentials to the sandbox.
export function createOwnerTrialRequest({enabled=false,readSession,fetchImpl=globalThis.fetch}={}){
 return async()=>{
  if(enabled!==true||typeof readSession!=='function')return null;
  try{
   const session=await readSession();
   if(typeof session?.access_token!=='string'||!session.access_token)return null;
   const r=await fetchImpl(endpoint,{method:'POST',headers:{authorization:'Bearer '+session.access_token},credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(3000)});
   if(r.status!==200||r.url!==endpoint||r.redirected||! /\bno-store\b/i.test(r.headers.get('cache-control')||'')||!/^application\/json(?:;|$)/i.test(r.headers.get('content-type')||''))return null;
   const reader=r.body?.getReader();if(!reader)return null;
   let count=0,body='';const decoder=new TextDecoder('utf-8',{fatal:true});
   try{while(true){const {done,value}=await reader.read();if(done)break;count+=value.byteLength;if(count>128){await reader.cancel();return null}body+=decoder.decode(value,{stream:true})}body+=decoder.decode()}finally{reader.releaseLock()}
   return normalizeRingsNowControl(JSON.parse(body));
  }catch{return null}
 };
}
