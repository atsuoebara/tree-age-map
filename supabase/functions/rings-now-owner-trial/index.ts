import {handleOwnerTrial} from './contract.mjs';
Deno.serve(request=>handleOwnerTrial(request,{
 enabled:Deno.env.get('RR_OWNER_TRIAL_ENABLED'),
 ownerId:Deno.env.get('RR_OWNER_TRIAL_USER_ID'),
 startsAt:Number(Deno.env.get('RR_OWNER_TRIAL_START_MS')??NaN),
 expiresAt:Number(Deno.env.get('RR_OWNER_TRIAL_END_MS')??NaN),
 async verifyUser(token){
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_ANON_KEY');
  if(!url||!key)return null;
  const response=await fetch(new URL('/auth/v1/user',url),{headers:{apikey:key,authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(2500)});
  return response.ok?await response.json():null;
 }
}));
