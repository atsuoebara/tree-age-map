// ISOLATED / REVIEW ONLY. Adapter for an individual owner-selected calendar row.
// No production UI, API, storage, FIT parsing, writes, or implicit owner selection.
import {assessImaWoShirouEligibility, EIGHT_DAYS_SECONDS} from './ima-wo-shirou-eight-day-eligibility.mjs';
const blocked = reason => ({status:'blocked',reason,eligible:false,analysisAllowed:false});
const preciseTimestamp = s => typeof s==='string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(s);
function utcStart(s){
  if(!preciseTimestamp(s))return null;
  const parsed=Date.parse(s);
  if(!Number.isSafeInteger(parsed)||parsed<0)return null;
  // Validate civil date and clock fields independently: Date.parse may normalize
  // impossible dates (e.g. February 31) rather than rejecting them.
  const year=Number(s.slice(0,4)),month=Number(s.slice(5,7)),day=Number(s.slice(8,10));
  const hour=Number(s.slice(11,13)),minute=Number(s.slice(14,16)),second=Number(s.slice(17,19));
  const utcDay=new Date(Date.UTC(year,month-1,day));
  if(year<100 || utcDay.toISOString().slice(0,10)!==s.slice(0,10) ||
     hour>23 || minute>59 || second>59)return null;
  const zone=s.match(/[+-]([0-9]{2}):([0-9]{2})$/);
  if(zone && (Number(zone[1])>23 || Number(zone[2])>59))return null;
  return parsed;
}
export function reviewSelectedCalendarRun({
  row, currentUserId, selectedAsGachiRun=false, nowMs, featureStartedAtMs,
}={}){
  if(!row || typeof row!=='object' || Array.isArray(row)) return blocked('run_missing');
  if(currentUserId==null || row.user_id==null || String(currentUserId)!==String(row.user_id))
    return blocked('owner_mismatch_or_missing');
  if(row.deleted_at != null)return blocked('deleted_run');
  if(row.id==null || !/^[1-9]\d*$/.test(String(row.id)))return blocked('run_id_missing_or_invalid');
  // activity_date remains solely the calendar display key; never a start-time fallback.
  const startedAtMs=utcStart(row.started_at);
  if(startedAtMs===null)return blocked('run_start_missing_or_invalid');
  const gate=assessImaWoShirouEligibility({
    selectedAsGachiRun,startedAtMs,nowMs,featureStartedAtMs,
    maxAgeSeconds:EIGHT_DAYS_SECONDS // Explicitly passes the 2026-11-13 policy.
  });
  if(!gate.eligible)return {status:'blocked',...gate};
  return {status:'eligible_window_only',eligible:true,analysisAllowed:false,
    runId:String(row.id),timeBasis:'started_at',windowSeconds:EIGHT_DAYS_SECONDS};
}
