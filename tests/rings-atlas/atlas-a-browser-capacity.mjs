// Atlas-2 candidate A. Audit-only in-memory browser size estimator.
// Does not read a browser global, network, storage, login, DOM, or source run.
const DIST_KEYS=Object.freeze(['municipalityDistance','prefectureDistance','countryDistance','regionDistance','admin1Distance','admin2Distance']);
const RUN_KEYS=Object.freeze(['municipalityRunCount','prefectureRunCount','countryRunCount','regionRunCount','admin1RunCount','admin2RunCount']);
const BAGS=Object.freeze([...DIST_KEYS,...RUN_KEYS]);
const en=new TextEncoder();
function fail(reason){throw new Error('Atlas capacity BLOCKED: '+reason);}
function plainObject(value){return value!==null&&typeof value==='object'&&!Array.isArray(value)&&
  (Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);}
function bag(value,label){
 if(!plainObject(value))fail('invalid '+label);
 const out=Object.create(null);
 for(const [key,v] of Object.entries(value)){
  if(!key||key.length>180||['__proto__','constructor','prototype'].includes(key)||
     !Number.isFinite(v)||v<0)fail('invalid numeric category');
  out[key]=v;
 }
 return out;
}
function scopeKey(scope){
 if(!plainObject(scope))fail('invalid scope');
 const keys=Object.keys(scope).sort();
 if(scope.kind==='all'&&keys.join(',')==='kind')return 'all';
 if(scope.kind==='year'&&keys.join(',')==='kind,year'&&
    Number.isInteger(scope.year)&&scope.year>=2000&&scope.year<=2100)return 'y:'+scope.year;
 if(scope.kind==='month'&&keys.join(',')==='kind,month,year'&&
    Number.isInteger(scope.year)&&scope.year>=2000&&scope.year<=2100&&
    Number.isInteger(scope.month)&&scope.month>=1&&scope.month<=12)
   return 'm:'+scope.year+'-'+String(scope.month).padStart(2,'0');
 fail('invalid or ambiguous period');
}
function certifiedComplete(e,ownerContext){
 // This is an ASSERTION by a future trusted integration, not proof of real auth.
 // This module has no access to authenticated source to verify these claims.
 if(!plainObject(e)||!plainObject(ownerContext))fail('missing trusted verification envelope');
 const expected=['authValidated','boundOwner','cloudPagesComplete','localSourcesComplete',
  'allPeriodsComputed','noErrors','snapshotCurrent','ownerScopeMatch'];
 if(Object.keys(e).sort().join(',')!==expected.sort().join(','))fail('unexpected completion fields');
 if(!expected.every(k=>e[k]===true))fail('incomplete data or unverified owner');
 if(ownerContext.currentSessionConfirmed!==true||ownerContext.noOwnerSwitch!==true||
    ownerContext.afterBfcacheRevalidated!==true)fail('not reverified');
 if(Object.keys(ownerContext).sort().join(',')!==
    ['afterBfcacheRevalidated','currentSessionConfirmed','noOwnerSwitch'].sort().join(','))
    fail('unexpected owner context');
}
function sanitized(stats,scope){
 if(!plainObject(stats))fail('invalid stats');
 if(!Number.isFinite(stats.totalDistanceKm)||stats.totalDistanceKm<0)fail('invalid total distance');
 if(!Number.isSafeInteger(stats.runCount)||stats.runCount<0)fail('invalid run count');
 const result={schema:'atlas-a-size-only-v0',scope,totalDistanceKm:stats.totalDistanceKm,
  runCount:stats.runCount};
 for(const k of BAGS){if(!Object.hasOwn(stats,k))fail('incomplete categories');result[k]=bag(stats[k],k);}
 const d=Object.values(result.municipalityDistance).filter(n=>n>0.01).length;
 const a=Object.values(result.admin2Distance).filter(n=>n>0.01).length;
 const unknown=!a&&Object.values(result.countryDistance).some(n=>n>0.01)&&
   Object.keys(result.admin1Distance).length>0;
 result.regions=unknown&&!d?'—':d+a;
 return result;
}
export function estimateAtlasSnapshotSizes(input){
 // No automatic input acquisition. Calling code must supply fully verified,
 // complete in-memory aggregates under a separately audited authorization.
 if(!plainObject(input)||Object.keys(input).sort().join(',')!==
   ['complete','ownerContext','snapshots'].sort().join(','))fail('unexpected request shape');
 certifiedComplete(input.complete,input.ownerContext);
 if(!Array.isArray(input.snapshots)||input.snapshots.length===0||input.snapshots.length>1200)
   fail('invalid number of scopes');
 const seen=new Set(),records=[];
 for(const item of input.snapshots){
  if(!plainObject(item)||Object.keys(item).sort().join(',')!=='scope,stats')fail('invalid snapshot');
  const scope=scopeKey(item.scope);
  if(seen.has(scope))fail('duplicate scope');
  seen.add(scope);
  const view=sanitized(item.stats,scope);
  const json=JSON.stringify(view);
  const bytes=en.encode(json).byteLength;
  if(bytes>10_000_000)fail('measurement exceeds prototype memory budget');
  records.push(Object.freeze({scope,bytes,runCount:view.runCount,
    regions:view.regions,categoryEntries:BAGS.reduce((sum,k)=>sum+Object.keys(view[k]).length,0)}));
 }
 if(!seen.has('all'))fail('missing all-period snapshot');
 // Return metadata ONLY; no regional names, values, individual IDs, route data.
 return Object.freeze({status:'synthetic-or-authorized-input-measured',scopeCount:records.length,
  totalBytes:records.reduce((sum,x)=>sum+x.bytes,0),
  maxBytes:Math.max(...records.map(x=>x.bytes)),periods:Object.freeze(records)});
}
