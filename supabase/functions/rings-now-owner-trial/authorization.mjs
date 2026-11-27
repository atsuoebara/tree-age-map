// Owner-only trial authorization. No FIT, run IDs or user IDs in the response.
// Configuration is server-side only; missing or malformed configuration denies.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function authorizeOwnerTrial({token,ownerId,enabled,startsAt,expiresAt,now,verifyUser}={}){
 const clock=()=>now===undefined?Date.now():now;
 const checkedAt=clock();
 if(enabled!=='true'||typeof ownerId!=='string'||!UUID.test(ownerId)||
    !Number.isSafeInteger(startsAt)||!Number.isSafeInteger(expiresAt)||
    expiresAt<=startsAt||expiresAt-startsAt>86400000||
    !Number.isSafeInteger(checkedAt)||checkedAt<startsAt||checkedAt>=expiresAt||
    typeof token!=='string'||!token||typeof verifyUser!=='function')return false;
 try{
  const user=await verifyUser(token);
  const after=clock();
  return Number.isSafeInteger(after)&&after>=startsAt&&after<expiresAt&&typeof user?.id==='string'&&user.id===ownerId;
 }catch{return false}
}
