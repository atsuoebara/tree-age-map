// Demonstration-only UI selection logic. NEVER accepts production calendar rows or FIT.
// The 8-day window is counted from start; exactly 691200 seconds is valid.
export const MAX_AGE_SECONDS=691200;
const validRow=r=>r&&typeof r==='object'&&!Array.isArray(r)&&
 typeof r.id==='string'&&/^demo-[a-z0-9-]+$/.test(r.id)&&
 typeof r.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&
 Number.isFinite(r.distanceKm)&&r.distanceKm>0&&
 typeof r.startedAt==='string'&&Number.isFinite(Date.parse(r.startedAt))&&
 Array.isArray(r.splits)&&r.splits.length>0&&r.splits.every((s,i)=>
 Number.isFinite(s)&&s>0&&i<300);
export function makeSyntheticCalendarFlow(rows,{nowMs}={}){
 if(!Array.isArray(rows)||rows.some(r=>!validRow(r))||
 new Set(rows.map(r=>r.id)).size!==rows.length)throw new TypeError('invalid synthetic demo rows');
 if(typeof nowMs!=='function')throw new TypeError('explicit clock required');
 let chosen=null,confirmed=false,generation=0;
 const clean=()=>{chosen=null;confirmed=false;generation++};
 const snapshot=()=>{
  const row=rows.find(r=>r.id===chosen);
  if(!row)return {status:'not_selected',generation};
  const ageSeconds=(nowMs()-Date.parse(row.startedAt))/1000;
  if(!Number.isFinite(ageSeconds)||ageSeconds<0||ageSeconds>MAX_AGE_SECONDS){
   clean();return {status:'expired',generation};
  }
  if(!confirmed)return {status:'gachi_confirmation_required',generation,row:{id:row.id,date:row.date,distanceKm:row.distanceKm}};
  return {status:'synthetic_preview_only',generation,row:{id:row.id,date:row.date,distanceKm:row.distanceKm},
   splits:row.splits.map((seconds,i)=>({km:i+1,clockElapsedSeconds:seconds})),
   analysisAllowed:false,realFitAllowed:false,productionAllowed:false};
 };
 return Object.freeze({
  rows:()=>rows.map(({id,date,distanceKm})=>({id,date,distanceKm})),
  select:id=>{clean();if(!rows.some(r=>r.id===id))return snapshot();chosen=id;return snapshot()},
  confirmGachi:value=>{confirmed=value===true;generation++;return snapshot()},
  clear:()=>{clean();return snapshot()},
  snapshot
 });
}
