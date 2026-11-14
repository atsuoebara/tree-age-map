// ISOLATED adapter only. Does not read the real calendar or invoke a network/API.
// Owner-supplied normalized rows are only evaluated after explicit selection;
// never infer a selected activity from date/distance, FIT bytes, or row order.
import {reviewSelectedCalendarRun} from './ima-wo-shirou-calendar-selection-review.mjs';
const blocked=reason=>({status:'blocked',reason,analysisAllowed:false,realFitAllowed:false,productionAllowed:false});
const nonemptyId=x=>x!=null && /^[1-9]\d*$/.test(String(x));
// Real Supabase Auth owners use UUIDs, unlike the numeric mock owners in tests.
// This is still only a format check: it does not authenticate the caller.
const ownerId=x=>(typeof x==='string'&&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(x)) ||
  (x!=null && nonemptyId(x));
const isDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x);
const validDistance=x=>Number.isFinite(x)&&x>0&&x<1000;
export function createRingsNowCalendarSelectionAdapter({
  readRows,readCurrentUserId,nowMs,featureStartedAtMs=null,
}={}){
  if(typeof readRows!=='function'||typeof readCurrentUserId!=='function'||typeof nowMs!=='function')
    throw new TypeError('Explicit read-only row source, owner source and clock required');
  let selected=null,confirmed=false,revision=0,lastTime=-Infinity,permanentlyExpired=new Set();
  const clear=()=>{selected=null;confirmed=false;revision++};
  const clock=()=>{
    let value;
    try{value=nowMs()}catch{return null}
    if(!Number.isSafeInteger(value)||value<0||value<lastTime)return null;
    lastTime=value;return value;
  };
  const snapshotRows=()=>{
    let data,owner;
    try{data=readRows();owner=readCurrentUserId()}catch{return null}
    if(!Array.isArray(data)||data.length>1000||!ownerId(owner))return null;
    const ids=new Set(),rows=[];
    for(const row of data){
      if(!row||typeof row!=='object'||Array.isArray(row)||!nonemptyId(row.id)||
         !ownerId(row.user_id)||String(row.user_id)!==String(owner)||
         !isDate(row.activity_date)||!validDistance(row.distance_km)||
         typeof row.started_at!=='string'||row.deleted_at!=null||
         ids.has(String(row.id)))return null;
      ids.add(String(row.id));rows.push({...row});
    }
    return {owner:String(owner),rows};
  };
  const validate=()=>{
    if(!selected)return blocked('not_selected');
    const tick=clock(),data=snapshotRows();
    if(tick===null||!data||data.owner!==selected.owner){clear();return blocked('source_or_clock_invalidated')}
    const row=data.rows.find(r=>String(r.id)===selected.id);
    if(!row||row.started_at!==selected.startedAt||row.activity_date!==selected.date||
       row.distance_km!==selected.distanceKm||row.user_id!=selected.owner){clear();return blocked('row_changed')}
    const result=reviewSelectedCalendarRun({
      row,currentUserId:data.owner,selectedAsGachiRun:confirmed,nowMs:tick,featureStartedAtMs
    });
    if(result.status==='blocked' && !['gachi_confirmation_required','not_selected'].includes(result.reason)){
      // Denied states cannot be recovered by setting the clock backwards.
      permanentlyExpired.add(selected.id);clear();return blocked('eligibility_failed');
    }
    return {tick,row};
  };
  const list=()=>{
    const data=snapshotRows(),tick=clock();
    if(!data||tick===null)return [];
    // Public-facing list includes ONLY the pre-existing calendar display fields.
    return data.rows.filter(r=>!permanentlyExpired.has(String(r.id)))
      .map(r=>({id:String(r.id),activityDate:r.activity_date,distanceKm:r.distance_km}));
  };
  const choose=id=>{
    clear();const data=snapshotRows(),tick=clock();
    if(!data||tick===null||!nonemptyId(id)||permanentlyExpired.has(String(id)))return blocked('selection_invalid');
    const row=data.rows.find(r=>String(r.id)===String(id));
    if(!row)return blocked('row_not_found');
    // Check eight-day validity before permitting even a pending selection.
    const pre=reviewSelectedCalendarRun({row,currentUserId:data.owner,
      selectedAsGachiRun:true,nowMs:tick,featureStartedAtMs});
    if(pre.status!=='eligible_window_only')return blocked('not_eligible');
    selected={id:String(row.id),owner:data.owner,startedAt:row.started_at,
      date:row.activity_date,distanceKm:row.distance_km};
    return {status:'gachi_confirmation_required',row:{id:selected.id,
      activityDate:selected.date,distanceKm:selected.distanceKm},
      analysisAllowed:false,realFitAllowed:false,productionAllowed:false};
  };
  const confirmGachi=value=>{
    if(!selected)return blocked('not_selected');
    if(value!==true){clear();return blocked('confirmation_required')}
    confirmed=true;
    const state=validate();
    if(!state.row)return state;
    return {status:'selected_preview_only',row:{id:selected.id,
      activityDate:selected.date,distanceKm:selected.distanceKm},
      analysisAllowed:false,realFitAllowed:false,productionAllowed:false};
  };
  const readContext=()=>{
    if(!selected||!confirmed)return null;
    const state=validate();
    if(!state.row||!selected)return null;
    return {currentUserId:selected.owner,row:state.row,selectedAsGachiRun:true,
      selectionDate:selected.date,selectionToken:revision};
  };
  return Object.freeze({list,choose,confirmGachi,readContext,
    invalidate:clear,clear});
}
