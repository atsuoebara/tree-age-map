// ISOLATED / REVIEW ONLY. Never performs HTTP, Supabase Auth, RLS or storage.
// "readPage" is an injected mockable function. Production integration requires
// separate approval and proof of authenticated/RLS-scoped, fresh data retrieval.
// Never use cached cloudRows or IndexedDB results as an authorized source.
const FIELDS=Object.freeze(['id','user_id','activity_date','distance_km','started_at','deleted_at']);
export const RINGS_NOW_PAGE_SIZE=50;
const MAX_ROWS=1000;
const reject=reason=>Object.freeze({
 status:'blocked',reason,rows:Object.freeze([]),
 analysisAllowed:false,realFitAllowed:false,productionAllowed:false
});
const uuid=s=>typeof s==='string'&&
 /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s);
function activeOwner(readSession){
 try{return readSession()?.user?.id}catch{return null}
}
export function createRingsNowPaginatedSnapshotSource({readSession,readPage}={}){
 if(typeof readSession!=='function'||typeof readPage!=='function')
  throw new TypeError('Explicit session and page callbacks required');
 let revision=0;
 const clear=()=>{revision++};
 async function readOwnerScopedRows(ownerId){
  const rev=++revision;
  if(!uuid(ownerId)||activeOwner(readSession)!==ownerId)
   return reject('session_owner_missing_or_changed');
  const results=[],ids=new Set();
  let offset=0;
  while(true){
   if(rev!==revision||activeOwner(readSession)!==ownerId)
    return reject('session_invalidated');
   let page;
   try{
    page=await readPage(Object.freeze({
     ownerId,offset,limit:RINGS_NOW_PAGE_SIZE,
     columns:FIELDS,deletedAtIsNull:true,stableOrder:'id.asc',
     // A future transport MUST bind session authorization to the request.
     // These parameters do not authenticate, verify RLS or do a fetch.
    }));
   }catch{return reject('page_failed')}
   if(rev!==revision||activeOwner(readSession)!==ownerId)
    return reject('session_invalidated');
   if(!Array.isArray(page)||page.length>RINGS_NOW_PAGE_SIZE)
    return reject('page_invalid');
   for(const row of page){
    if(!row||typeof row!=='object'||Array.isArray(row)||
      row.user_id!==ownerId||row.deleted_at!=null||
      !/^[1-9]\d*$/.test(String(row.id))||ids.has(String(row.id)))
      return reject('row_invalid_or_not_owned');
    ids.add(String(row.id));
    if(results.length===MAX_ROWS)return reject('too_many_rows');
    // Freeze a minimal copy: caller's route/GPS/HR data is never propagated.
    results.push(Object.freeze(Object.fromEntries(FIELDS.map(key=>[key,row[key]]))));
   }
   if(page.length<RINGS_NOW_PAGE_SIZE)break;
   offset+=RINGS_NOW_PAGE_SIZE;
  }
  if(rev!==revision||activeOwner(readSession)!==ownerId)
   return reject('session_invalidated');
  // These are strictly caller-supplied assertions for the #138 contract;
  // NEVER interpret them as actual proof of Auth/RLS or freshness.
  return Object.freeze({
   ownerId,ownerScoped:true,unmodifiedSnapshot:true,rows:Object.freeze(results)
  });
 }
 return Object.freeze({readOwnerScopedRows,clear});
}
