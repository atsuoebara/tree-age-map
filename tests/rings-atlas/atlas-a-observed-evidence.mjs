// Atlas A – isolated evidence producer from observed mock reader returns.
// This module knows no Supabase/browser/global state. It cannot validate real
// authentication; synthetic ports are deliberately supplied only by test code.
const STOP = message => { throw new Error('Atlas observed evidence BLOCKED: '+message); };
const isInt = x => Number.isSafeInteger(x)&&x>=0;
const isPlain = x => x && typeof x==='object'&&!Array.isArray(x) &&
  (Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
const stableKeys = a => a.slice().sort().join(',');
function validScope(s) {
 if(!isPlain(s))STOP('invalid scope');
 const keys=Object.keys(s);
 if(s.kind==='all'&&stableKeys(keys)==='kind')return 'all';
 if(!Number.isInteger(s.year)||s.year<2000||s.year>2100)STOP('invalid year');
 if(s.kind==='year'&&stableKeys(keys)==='kind,year')return 'y:'+s.year;
 if(s.kind==='month'&&stableKeys(keys)==='kind,month,year'&&
   Number.isInteger(s.month)&&s.month>=1&&s.month<=12)
  return 'm:'+s.year+'-'+String(s.month).padStart(2,'0');
 STOP('invalid scope fields');
}
export async function observeSyntheticCompleteness({pageSize,ports,requestedScopes,expectedOwnerEpoch}) {
 if(!isInt(pageSize)||pageSize===0||pageSize>500||!isInt(expectedOwnerEpoch)||
  !Array.isArray(requestedScopes)||requestedScopes.length<1||requestedScopes.length>1200||
  !isPlain(ports))STOP('invalid setup');
 for(const method of ['getContext','readPage','readLocal','computeScope'])
  if(typeof ports[method]!=='function')STOP('missing observed reader');
 const scopes=requestedScopes.map(validScope);
 if(new Set(scopes).size!==scopes.length||!scopes.includes('all'))
  STOP('scope duplication or missing all');
 // Simulated context comes from a supplied reader, not a trusted auth SDK.
 // A real integration MUST separately attest its concrete provenance.
 const before=await ports.getContext();
 if(!isPlain(before)||before.epoch!==expectedOwnerEpoch||
  before.sessionValidated!==true||before.ownerBound!==true||
  before.readOnly===false||before.readOnly!==true||
  typeof before.revision!=='string'||!before.revision||before.revision.length>128)
  STOP('unverified initial context');
 const cloud=[];let offset=0,requests=0;const ids=new Set();
 try {
  while(true){
   if(++requests>10000)STOP('unbounded pagination');
   const page=await ports.readPage({offset,limit:pageSize});
   if(!Array.isArray(page)||page.length>pageSize)STOP('invalid page');
   for(const row of page) {
    if(!isPlain(row)||typeof row.id!=='string'||!row.id||ids.has(row.id))
      STOP('missing or duplicate cloud row ID');
    ids.add(row.id);
   }
   cloud.push(...page);
   offset+=page.length;
   if(page.length<pageSize)break;
  }
  const local=await ports.readLocal();
  if(!isPlain(local)||!Array.isArray(local.rows)||
    local.enumerationComplete!==true||local.parsingComplete!==true||
    local.noErrors!==true||local.rows.some(x=>!isPlain(x)))STOP('local incomplete');
  const results=[];
  for(const key of scopes){
   const value=await ports.computeScope({key,cloud,local:local.rows});
   if(!isPlain(value)||value.complete!==true||
      !isInt(value.sourceCount)||value.sourceCount>cloud.length+local.rows.length||
      !isInt(value.producedCount))STOP('scope incomplete');
   results.push({key,sourceCount:value.sourceCount});
  }
  const after=await ports.getContext();
  if(!isPlain(after)||after.epoch!==expectedOwnerEpoch||
    after.sessionValidated!==true||after.ownerBound!==true||
    after.readOnly!==true||after.revision!==before.revision||
    after.noConcurrentWrites!==true||after.bfcacheRevalidated!==true)
    STOP('stale owner, revision or lifecycle');
  // Return aggregated numeric metadata only. The mock source rows must never
  // be returned, logged, cached or persisted by this function.
  return Object.freeze({kind:'SYNTHETIC_OBSERVED_ONLY',complete:true,
   cloudRows:cloud.length,localRows:local.rows.length,scopeCount:results.length,
   scopeKeys:Object.freeze(results.map(x=>x.key))});
 } catch (error) {
  // Reader errors fail closed; do not propagate details that may contain data.
  STOP('read, completeness, or context verification failed');
 } finally {
  // Only module-local arrays/sets exist. No connection or persisted state.
 }
}
