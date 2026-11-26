// Dormant connection for the calendar entry. No FIT read, storage, or writes.
import {reviewRingsNowRpcEnvelope} from './rings-now-rpc-envelope-review.mjs';
import {createRingsNowAuthSnapshotBoundary} from './rings-now-auth-snapshot-boundary.mjs';
import {createRingsNowAuthTransitionEpochGate} from './rings-now-auth-transition-epoch-gate.mjs';
import {createRingsNowCalendarSelectionAdapter} from './rings-now-calendar-selection-adapter.mjs';

export function createRingsNowCalendarConnection({client,readSession,subscribeAuthChanges,
  nowMs,featureStartedAtMs=null,onInvalidate=()=>{}}={}){
 if(!client||typeof client.rpc!=='function'||typeof readSession!=='function'||
    typeof subscribeAuthChanges!=='function'||typeof nowMs!=='function')
  throw new TypeError('Explicit authenticated client and lifecycle required');
 let adapter,disposed=false,revision=0;
 const invalidationListeners=new Set();
 const boundary=createRingsNowAuthSnapshotBoundary({readSession,async readOwnerScopedRows(ownerId){
  if(!Number.isSafeInteger(featureStartedAtMs)||featureStartedAtMs<0)
   throw new Error('rollout_not_configured');
  const {data,error}=await client.rpc('rings_now_snapshot_candidate_v03');
  if(error)throw new Error('snapshot_failed');
  const checked=reviewRingsNowRpcEnvelope(data,{expectedOwnerId:ownerId});
  if(checked.status!=='rpc_envelope_review_only')throw new Error('snapshot_blocked');
  return {ownerId,ownerScoped:true,unmodifiedSnapshot:true,rows:checked.rows};
 }});
 const invalidate=()=>{
  revision++;adapter?.invalidate();
  for(const listener of [...invalidationListeners]){
   try{listener()}catch{/* one observer cannot prevent other invalidations */}
  }
  onInvalidate();
 };
 const gate=createRingsNowAuthTransitionEpochGate({boundary,subscribeAuthChanges,onInvalidateSelection:invalidate});
 adapter=createRingsNowCalendarSelectionAdapter({readRows:gate.readRows,
  readCurrentUserId:gate.readCurrentUserId,nowMs,featureStartedAtMs});
 const blocked=()=>({status:'blocked',analysisAllowed:false,realFitAllowed:false,productionAllowed:false});
 async function choose(id,ownerId,activityDate){
  if(disposed)return blocked();
  gate.clear();
  const request=revision;
  const result=await gate.refresh();
  if(disposed||request!==revision||result.status!=='owner_snapshot_ready'||
     gate.readCurrentUserId()!==ownerId)return blocked();
  const choice=adapter.choose(id);
  if(choice.status!=='gachi_confirmation_required'||choice.row.activityDate!==activityDate){
   adapter.clear();return blocked();
  }
  return choice;
 }
 function confirmGachi(value){
  if(disposed)return blocked();
  const result=adapter.confirmGachi(value);
  if(result.status!=='selected_preview_only')gate.clear();
  return result;
 }
 return Object.freeze({choose,confirmGachi,readContext:()=>disposed?null:adapter.readContext(),
  subscribeInvalidation(listener){
   if(disposed||typeof listener!=='function')throw new TypeError('active connection and listener required');
   invalidationListeners.add(listener);return ()=>invalidationListeners.delete(listener);
  },
  clear:()=>{if(!disposed)gate.clear()},
  destroy(){if(!disposed){disposed=true;try{gate.destroy()}finally{invalidationListeners.clear()}}}});
}
