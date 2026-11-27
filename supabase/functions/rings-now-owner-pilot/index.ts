// Candidate only. No deployment authorized by this commit.
// Server-held allowlist and expiry are unset by default. No JWT or user data logging.
import {createOwnerPilotHandler} from './contract.mjs';
const url=Deno.env.get('SUPABASE_URL');
const key=Deno.env.get('SUPABASE_ANON_KEY');
Deno.serve(createOwnerPilotHandler({
 enabled:Deno.env.get('RR_NOW_PILOT_ENABLED')==='true',
 ownerId:Deno.env.get('RR_NOW_PILOT_OWNER_ID'),
 expiresAtMs:Number(Deno.env.get('RR_NOW_PILOT_EXPIRES_MS')||0),
 async getUser(token:string){
  if(!url||!key)return null;
  const r=await fetch(url+'/auth/v1/user',{headers:{apikey:key,Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(2000)});
  if(!r.ok)return null;
  return await r.json();
 }
}));
