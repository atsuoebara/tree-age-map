// REVIEW ONLY: pure parser for the candidate RPC JSON envelope.
// This is not an authenticated/RLS-verified source and cannot authorize the
// existing owner snapshot boundary, a real FIT read, or production.
const deny = reason => Object.freeze({status:'blocked',reason,rows:Object.freeze([]),
 analysisAllowed:false,realFitAllowed:false,productionAllowed:false});
const fields=Object.freeze(['id','user_id','activity_date','distance_km','started_at','deleted_at']);
const allowedReasons=new Set(['unauthenticated','too_many_rows','missing_required_fields']);
const keysExactly=(o,names)=>Object.keys(o).length===names.length&&
 names.every(k=>Object.prototype.hasOwnProperty.call(o,k));
const rowShape=r=>r!==null&&typeof r==='object'&&!Array.isArray(r)&&keysExactly(r,fields);
const isId=x=>(typeof x==='number'||typeof x==='string')&&
 /^[1-9]\\d*$/.test(String(x))&&Number.isSafeInteger(Number(x));
const uuid=x=>typeof x==='string'&&
 /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(x);
const date=x=>typeof x==='string'&&/^\\d{4}-\\d{2}-\\d{2}$/.test(x);
const timestamp=x=>typeof x==='string'&&
 /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,6})?(?:Z|[+-]\\d{2}:\\d{2})$/.test(x);
export function reviewRingsNowRpcEnvelope(payload,{expectedOwnerId}={}){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))
  return deny('rpc_envelope_invalid');
 if(payload.status==='blocked'){
  if(!keysExactly(payload,['status','reason'])||!allowedReasons.has(payload.reason))
   return deny('rpc_blocked_contract_invalid');
  return deny(payload.reason);
 }
 if(payload.status!=='candidate_snapshot'||!keysExactly(payload,['status','rows'])||
    !uuid(expectedOwnerId)||!Array.isArray(payload.rows)||payload.rows.length>1000)
  return deny('rpc_envelope_invalid');
 const rows=[],seen=new Set();let last=0;
 for(const r of payload.rows){
  if(!rowShape(r)||!isId(r.id)||!uuid(r.user_id)||r.user_id!==expectedOwnerId||
     r.deleted_at!==null||!date(r.activity_date)||
     typeof r.distance_km!=='number'||!Number.isFinite(r.distance_km)||
     r.distance_km<=0||r.distance_km>=1000||!timestamp(r.started_at))
   return deny('rpc_row_invalid');
  const id=Number(r.id);
  if(id<=last||seen.has(String(r.id)))return deny('rpc_order_or_duplicate_invalid');
  seen.add(String(r.id));last=id;
  rows.push(Object.freeze(Object.fromEntries(fields.map(k=>[k,r[k]]))));
 }
 // Crucial: no ownerScoped/unmodifiedSnapshot flags here. External Auth/JWT,
 // verified RPC execution context, RLS and epoch gate are required later.
 return Object.freeze({status:'rpc_envelope_review_only',rows:Object.freeze(rows),
  analysisAllowed:false,realFitAllowed:false,productionAllowed:false});
}
