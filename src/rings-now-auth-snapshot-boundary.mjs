// ISOLATED / REVIEW ONLY. No Supabase SDK, fetch, browser storage, or real calendar.
// A future caller must independently verify session authenticity, RLS, and the
// owner-scoped source. Injected callbacks are NOT themselves proof of identity.
// This barrier rejects stale responses after logout/account switching or overlap.
import {prepareRingsNowOwnerCalendarRows} from './rings-now-calendar-owner-input-contract.mjs';

const denied=reason=>Object.freeze({
  status:'blocked',reason,rows:Object.freeze([]),
  analysisAllowed:false,realFitAllowed:false,productionAllowed:false
});
const sameOwner=(a,b)=>typeof a==='string'&&a.length>0&&a===b;
const empty=()=>denied('not_loaded');

export function createRingsNowAuthSnapshotBoundary({
  readSession,readOwnerScopedRows
}={}){
  if(typeof readSession!=='function'||typeof readOwnerScopedRows!=='function')
    throw new TypeError('Session and owner-scoped snapshot callbacks are required');
  let revision=0,latest=empty(),owner=null;
  function clear(){revision++;latest=empty();owner=null;return latest;}
  function readStableOwner(){
    let session;
    try{session=readSession()}catch{return null}
    // Only an explicitly supplied session.user.id may be used, not a row's
    // user_id or a global fallback. An actual verified Auth session is
    // an obligation of the eventual integration layer.
    const id=session?.user?.id;
    return typeof id==='string'&&id.length>0?id:null;
  }
  async function refresh(){
    const request=++revision;
    latest=empty();owner=null;
    const startOwner=readStableOwner();
    if(!startOwner)return denied('session_missing');
    let snapshot;
    try{
      snapshot=await readOwnerScopedRows(startOwner);
    }catch{
      return request===revision?denied('source_failed'):denied('stale_request');
    }
    if(request!==revision)return denied('stale_request');
    const finalOwner=readStableOwner();
    if(!sameOwner(startOwner,finalOwner))return clear();
    // This flag represents a future integration contract, not evidence that
    // an authentication service, RLS, or query was actually checked here.
    if(!snapshot||snapshot.ownerId!==startOwner||
      snapshot.ownerScoped!==true||snapshot.unmodifiedSnapshot!==true){
      return denied('source_contract_invalid');
    }
    const prepared=prepareRingsNowOwnerCalendarRows({
      ownerId:startOwner,sourceRows:snapshot.rows,
      ownerScoped:true,unmodifiedSnapshot:true
    });
    if(prepared.status!=='owner_rows_only')return denied(prepared.reason);
    // Guard against synchronous identity changes during preparation.
    if(request!==revision||readStableOwner()!==startOwner)return clear();
    owner=startOwner;latest=Object.freeze({
      status:'owner_snapshot_ready',rows:prepared.rows,
      analysisAllowed:false,realFitAllowed:false,productionAllowed:false
    });
    return latest;
  }
  function readRows(){
    if(owner===null||readStableOwner()!==owner){clear();return [];}
    return latest.rows;
  }
  function readCurrentUserId(){
    if(owner===null||readStableOwner()!==owner){clear();return null;}
    return owner;
  }
  return Object.freeze({refresh,readRows,readCurrentUserId,clear});
}
