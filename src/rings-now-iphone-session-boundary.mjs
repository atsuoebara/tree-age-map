// ISOLATED / REVIEW ONLY — no public page imports this module.
// A future iPhone UI must provide the authenticated context, selected calendar
// row and an explicit rollout start. This does NOT authorize FIT use or joining.
import {reviewSelectedCalendarRun} from './ima-wo-shirou-calendar-selection-review.mjs';

const safeId=x=>x!=null&&String(x).length>0?String(x):null;
export function createRingsNowIphoneSessionBoundary({
  readContext,nowMs,featureStartedAtMs=null,
  pageEvents,visibilityEvents,
}={}){
  if(typeof readContext!=='function'||typeof nowMs!=='function'||
     !pageEvents||typeof pageEvents.addEventListener!=='function'||
     typeof pageEvents.removeEventListener!=='function'||
     !visibilityEvents||typeof visibilityEvents.addEventListener!=='function'||
     typeof visibilityEvents.removeEventListener!=='function')
    throw new TypeError('explicit live context, time and lifecycle events required');

  // Capture only the caller's explicit user selection, never infer from FIT.
  let first;
  try{first=readContext()}catch{return inertBoundary();}
  const selected=first?.row;
  const owner=safeId(first?.currentUserId);
  const id=safeId(selected?.id);
  const token=first?.selectionToken;
  const start=selected?.started_at;
  const date=selected?.activity_date;
  let active=!!owner&&!!id&&token!=null&&first?.selectedAsGachiRun===true;
  const onPageHide=()=>{active=false};
  // Even bfcache restore cannot revive the previously chosen file/row.
  const onPageShow=event=>{if(event?.persisted)active=false};
  const onVisibility=()=>{if(visibilityEvents.hidden===true)active=false};
  pageEvents.addEventListener('pagehide',onPageHide);
  pageEvents.addEventListener('pageshow',onPageShow);
  visibilityEvents.addEventListener('visibilitychange',onVisibility);
  const isContextCurrent=()=>{
    if(!active||visibilityEvents.hidden===true)return false;
    try{
      const current=readContext();
      const row=current?.row;
      if(current?.selectedAsGachiRun!==true||
         safeId(current?.currentUserId)!==owner||
         safeId(row?.id)!==id||
         row?.user_id==null||safeId(row.user_id)!==owner||
         current?.selectionToken!==token||
         row?.started_at!==start||row?.activity_date!==date||
         current?.selectionDate!==date)return false;
      const time=nowMs();
      return reviewSelectedCalendarRun({
        row,currentUserId:current.currentUserId,
        selectedAsGachiRun:true,nowMs:time,featureStartedAtMs
      }).status==='eligible_window_only';
    }catch{return false}
  };
  return {
    isContextCurrent,
    invalidate(){active=false},
    destroy(){
      active=false;
      pageEvents.removeEventListener('pagehide',onPageHide);
      pageEvents.removeEventListener('pageshow',onPageShow);
      visibilityEvents.removeEventListener('visibilitychange',onVisibility);
    }
  };
}
function inertBoundary(){
  return {isContextCurrent:()=>false,invalidate(){},destroy(){}};
}
