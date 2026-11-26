// Parent-only control transport. Never receives FIT data or authentication tokens.
const ENDPOINT='https://fhwvntpzwyenendhcgbw.supabase.co/functions/v1/rings-now-control';
const REQUEST=Object.freeze({protocol:'rings-now-review-v1',build:'v1'});
export function normalizeRingsNowControl(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||
    Object.keys(value).sort().join(',')!=='build,enabled,protocol'||
    value.protocol!==REQUEST.protocol||value.build!==REQUEST.build||
    typeof value.enabled!=='boolean')return null;
 return {...REQUEST,enabled:value.enabled};
}
export function createRingsNowControlRequest({enabled=false,fetchImpl=globalThis.fetch}={}){
 return async()=>{
  if(enabled!==true||typeof fetchImpl!=='function')return null;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),3000);
  try{
   const response=await fetchImpl(ENDPOINT,{method:'POST',mode:'cors',credentials:'omit',
    cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal:controller.signal,
    headers:{'content-type':'application/json'},body:JSON.stringify(REQUEST)});
   if(response.status!==200||response.redirected||response.url!==ENDPOINT||
      !/\bno-store\b/i.test(response.headers.get('cache-control')||'')||
      !/^application\/json(?:;|$)/i.test(response.headers.get('content-type')||''))return null;
   const reader=response.body?.getReader();
   if(!reader)return null;
   const decoder=new TextDecoder('utf-8',{fatal:true});
   let count=0,text='';
   try{
    while(true){
     const {done,value}=await reader.read();
     if(done)break;
     count+=value.byteLength;
     if(count>128){await reader.cancel();return null}
     text+=decoder.decode(value,{stream:true});
    }
    text+=decoder.decode();
   }finally{reader.releaseLock()}
   return normalizeRingsNowControl(JSON.parse(text));
  }catch{return null}
  finally{clearTimeout(timer)}
 };
}
