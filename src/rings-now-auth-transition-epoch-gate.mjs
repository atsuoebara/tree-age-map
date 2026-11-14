// ISOLATED / REVIEW ONLY. Does not subscribe to real Supabase Auth.
// The future integration MUST supply a synchronous auth-change subscription;
// owner UUID equality alone cannot detect logout -> same-user re-login (A/B/A).
// An auth event invalidates both the existing #140 boundary and the optional
// paginated source in PR #141, even when the user ID after re-login is unchanged.
const denied=reason=>Object.freeze({status:'blocked',reason,rows:Object.freeze([]),
 analysisAllowed:false,realFitAllowed:false,productionAllowed:false});
export function createRingsNowAuthTransitionEpochGate({
 boundary,source=null,subscribeAuthChanges
}={}){
 if(!boundary||typeof boundary.refresh!=='function'||
    typeof boundary.readRows!=='function'||
    typeof boundary.readCurrentUserId!=='function'||
    typeof boundary.clear!=='function'||
    (source!==null&&typeof source.clear!=='function')||
    typeof subscribeAuthChanges!=='function')
  throw new TypeError('Existing boundary and synchronous auth subscription required');
 let epoch=0,readyEpoch=null,disposed=false,unsubscribe=null;
 function invalidate(){
  epoch++;
  readyEpoch=null;
  boundary.clear();
  source?.clear();
 }
 const listener=()=>{if(!disposed)invalidate()};
 try{
  unsubscribe=subscribeAuthChanges(listener);
  if(typeof unsubscribe!=='function')throw new TypeError('unsubscribe required');
 }catch(error){
  disposed=true;
  invalidate();
  throw error;
 }
 async function refresh(){
  if(disposed)return denied('disposed');
  const generation=epoch;
  readyEpoch=null;
  let result;
  try{result=await boundary.refresh()}catch{return denied('refresh_failed')}
  if(disposed||generation!==epoch)return denied('auth_changed_during_refresh');
  if(result?.status!=='owner_snapshot_ready')return denied('snapshot_blocked');
  readyEpoch=generation;
  return result;
 }
 function valid(){
  return !disposed&&readyEpoch!==null&&readyEpoch===epoch;
 }
 function readRows(){
  return valid()?boundary.readRows():[];
 }
 function readCurrentUserId(){
  return valid()?boundary.readCurrentUserId():null;
 }
 function clear(){
  if(!disposed)invalidate();
 }
 function destroy(){
  if(disposed)return;
  disposed=true;
  invalidate();
  try{unsubscribe()}finally{unsubscribe=null}
 }
 return Object.freeze({refresh,readRows,readCurrentUserId,clear,destroy});
}
