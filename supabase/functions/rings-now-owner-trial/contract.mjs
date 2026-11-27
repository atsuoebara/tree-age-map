import {authorizeOwnerTrial} from './authorization.mjs';
const origin='https://runnersrings.com';
const headers={'cache-control':'no-store','content-type':'application/json','vary':'Origin'};
const cors={'access-control-allow-origin':origin};
const result=(enabled,status=200,allowed=true)=>new Response(JSON.stringify({protocol:'rings-now-review-v1',build:'v1',enabled}),{status,headers:{...headers,...(allowed?cors:{})}});
export async function handleOwnerTrial(request,config){
 if(request.headers.get('origin')!==origin)return result(false,403,false);
 if(request.method==='OPTIONS'){
  if(request.headers.get('access-control-request-method')!=='POST'||request.headers.get('access-control-request-headers')?.toLowerCase().trim()!=='authorization')return result(false,403);
  return new Response(null,{status:204,headers:{...headers,...cors,'access-control-allow-methods':'POST','access-control-allow-headers':'authorization','access-control-max-age':'0'}});
 }
 if(request.method!=='POST'||request.body!==null)return result(false,400);
 const token=/^Bearer ([A-Za-z0-9._-]{1,8192})$/.exec(request.headers.get('authorization')||'')?.[1];
 return result(await authorizeOwnerTrial({...config,token}));
}
