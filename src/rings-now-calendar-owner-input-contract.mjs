// ISOLATED calendar input contract. Never imports a database client or reads a run.
// The caller MUST provide a pre-authorized, owner-scoped snapshot. Rejects any
// foreign row rather than silently filtering it. Deleted rows are removed locally.
// Outputs ONLY the six row fields required by the audited PR #137 selection adapter.
// This is NOT a production calendar connection or permission to use real records.
const deny = reason => Object.freeze({status:'blocked',reason,rows:Object.freeze([]),
  analysisAllowed:false,realFitAllowed:false,productionAllowed:false});
const id = x => (typeof x==='string' || typeof x==='number') &&
  /^[1-9]\d*$/.test(String(x)) && Number.isSafeInteger(Number(x));
// Supabase Auth user IDs are UUIDs; numeric owner IDs are retained solely for
// existing isolated fixtures. Run IDs remain separately validated as numeric.
const validOwnerId = x => (typeof x==='string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(x)) || id(x);
const date = x => typeof x==='string' && /^\d{4}-\d{2}-\d{2}$/.test(x);
const distance = x => typeof x==='number' && Number.isFinite(x) && x>0 && x<1000;
const timestamp = x => typeof x==='string' &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(x);
export function prepareRingsNowOwnerCalendarRows({
  ownerId,sourceRows,ownerScoped=false,unmodifiedSnapshot=false
}={}){
  if(ownerScoped!==true||unmodifiedSnapshot!==true) return deny('source_contract_not_confirmed');
  if(!validOwnerId(ownerId)||!Array.isArray(sourceRows)||sourceRows.length>1000)
    return deny('owner_or_snapshot_invalid');
  const owner=String(ownerId),seen=new Set(),out=[];
  for(const r of sourceRows){
    if(!r||typeof r!=='object'||Array.isArray(r)||!id(r.id)||!validOwnerId(r.user_id))
      return deny('invalid_row');
    if(String(r.user_id)!==owner) return deny('foreign_owner_in_snapshot');
    const key=String(r.id);
    if(seen.has(key)) return deny('duplicate_run_id');
    seen.add(key);
    // A deletion is not an eligible run, even if its other fields look valid.
    if(r.deleted_at!=null) continue;
    if(!date(r.activity_date)||!distance(r.distance_km)||!timestamp(r.started_at))
      return deny('missing_required_calendar_fields');
    out.push(Object.freeze({
      id:key,user_id:owner,activity_date:r.activity_date,
      distance_km:r.distance_km,started_at:r.started_at,deleted_at:null
    }));
  }
  return Object.freeze({status:'owner_rows_only',
    rows:Object.freeze(out),analysisAllowed:false,realFitAllowed:false,productionAllowed:false});
}
