#!/usr/bin/env node
import {strict as assert} from 'node:assert';
import {estimateAtlasSnapshotSizes} from './atlas-a-browser-capacity.mjs';
const keys=['municipalityDistance','prefectureDistance','countryDistance','regionDistance',
'admin1Distance','admin2Distance','municipalityRunCount','prefectureRunCount',
'countryRunCount','regionRunCount','admin1RunCount','admin2RunCount'];
const stats=(runs,unknown=false)=>{
 const s={runCount:runs,totalDistanceKm:runs*5.25,activities:[{id:'POISON_ID',route:'POISON_ROUTE',user_id:'POISON_OWNER'}]};
 keys.forEach(k=>s[k]={});
 if(runs>0){
  s.countryDistance.ZZZ=runs*5.25;s.countryRunCount.ZZZ=runs;
  s.admin1Distance['ZZZ|ADM1|A']=runs*5.25;s.admin1RunCount['ZZZ|ADM1|A']=runs;
  if(!unknown){s.admin2Distance['ZZZ|ADM2|A']=runs*5.25;s.admin2RunCount['ZZZ|ADM2|A']=runs;}
 }
 return s;
};
const complete={authValidated:true,boundOwner:true,cloudPagesComplete:true,localSourcesComplete:true,
 allPeriodsComputed:true,noErrors:true,snapshotCurrent:true,ownerScopeMatch:true};
const ownerContext={currentSessionConfirmed:true,noOwnerSwitch:true,afterBfcacheRevalidated:true};
const input={complete,ownerContext,snapshots:[
 {scope:{kind:'all'},stats:stats(12)},
 {scope:{kind:'year',year:2026},stats:stats(7)},
 {scope:{kind:'month',year:2026,month:11},stats:stats(3)},
 {scope:{kind:'month',year:2025,month:1},stats:stats(0)},
 {scope:{kind:'year',year:2025},stats:stats(1,true)}
]};
const output=estimateAtlasSnapshotSizes(input);
assert.equal(output.scopeCount,5);
assert.equal(output.periods[3].regions,0);
assert.equal(output.periods[4].regions,'—');
assert(!JSON.stringify(output).includes('POISON'));
assert(output.periods.every(p=>p.bytes>0&&p.categoryEntries>=0));
function blocked(change){
 const changed=structuredClone(input);change(changed);
 assert.throws(()=>estimateAtlasSnapshotSizes(changed),/BLOCKED/);
}
blocked(i=>i.complete.cloudPagesComplete=false);
blocked(i=>i.complete.localSourcesComplete=false);
blocked(i=>i.complete.ownerScopeMatch=false);
blocked(i=>i.ownerContext.afterBfcacheRevalidated=false);
blocked(i=>i.complete.noErrors=false);
blocked(i=>i.snapshots.shift());
blocked(i=>i.snapshots.push(structuredClone(i.snapshots[0])));
blocked(i=>i.snapshots[0].scope={kind:'month',year:2026,month:13});
blocked(i=>{delete i.snapshots[0].stats.admin2Distance;});
blocked(i=>i.snapshots[0].stats.countryDistance.ZZZ=Infinity);
console.log('PASS: 5 synthetic scopes, 10 negative controls, zero/— separation, no poison output');
console.log(JSON.stringify(output,null,2));
