// REVIEW-ONLY: double-scan consistency check for an injected #141 source.
// No HTTP, Supabase, cache, storage, FIT or production connection.
// Repeating a paginated read detects common offset shifts due to live writes,
// but is NOT a transaction, repeatable-read snapshot or proof of RLS/freshness.
// The eventual integration must independently authenticate and enforce RLS.
const deny=reason=>Object.freeze({status:'blocked',reason,rows:Object.freeze([]),
 analysisAllowed:false,realFitAllowed:false,productionAllowed:false});
const FIELDS=Object.freeze(['id','user_id','activity_date','distance_km','started_at','deleted_at']);
const uuid=s=>typeof s==='string'&&
 /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s);

export function createRingsNowDoubleScanSource({readSession,source}={}){
 if(typeof readSession!=='function'||!source||
   typeof source.readOwnerScopedRows!=='function'||typeof source.clear!=='function')
  throw new TypeError('Session callback and clearable paginated source required');
 let revision=0;
 const clear=()=>{revision++;source.clear()};
 function activeOwner(){
  try{return readSession()?.user?.id}catch{return null}
 }
 function valid(rev,ownerId){
  return revision===rev&&activeOwner()===ownerId;
 }
 async function readOwnerScopedRows(ownerId){
  const rev=++revision;
  if(!uuid(ownerId)||!valid(rev,ownerId))return deny('session_invalid');
  let first,second;
  try{
   first=await source.readOwnerScopedRows(ownerId);
   if(!valid(rev,ownerId))return deny('session_invalidated');
   if(!first||first.status==='blocked'||first.ownerId!==ownerId||
     first.ownerScoped!==true||first.unmodifiedSnapshot!==true||
     !Array.isArray(first.rows)||first.rows.length>1000)
    return deny('first_scan_invalid');
   second=await source.readOwnerScopedRows(ownerId);
  }catch{return deny('source_failed')}
  if(!valid(rev,ownerId))return deny('session_invalidated');
  if(!second||second.status==='blocked'||second.ownerId!==ownerId||
    second.ownerScoped!==true||second.unmodifiedSnapshot!==true||
    !Array.isArray(second.rows)||second.rows.length!==first.rows.length)
   return deny('second_scan_invalid_or_changed');
  const a=first.rows,b=second.rows;
  for(let i=0;i<a.length;i++){
   const firstRow=a[i],secondRow=b[i];
   if(!firstRow||!secondRow||typeof firstRow!=='object'||
      typeof secondRow!=='object'||Array.isArray(firstRow)||Array.isArray(secondRow))
    return deny('scan_row_invalid');
   for(const field of FIELDS){
    if(!Object.hasOwn(firstRow,field)||!Object.hasOwn(secondRow,field)||
       firstRow[field]!==secondRow[field])
     return deny('scan_mismatch');
   }
  }
  if(!valid(rev,ownerId))return deny('session_invalidated');
  // Output is new, frozen and minimal; never expose either input object.
  const rows=Object.freeze(b.map(r=>Object.freeze(
   Object.fromEntries(FIELDS.map(field=>[field,r[field]]))
  )));
  return Object.freeze({ownerId,ownerScoped:true,unmodifiedSnapshot:true,rows,
   // This is an asserted integration contract, NOT authenticated proof.
  });
 }
 return Object.freeze({readOwnerScopedRows,clear});
}
