import assert from 'node:assert/strict';
// B-1 model based on read-only inspection of public.get_import_share_origin_page (2026-11-01).
// SYNTHETIC DATA ONLY; real production code and user records remain untouched.
const runs=[
 {id:'a',user:'u1',year:2025,km:40,deleted:false,start:'JP',alloc:{JP:20,US:20},consented:true},
 {id:'b',user:'u1',year:2025,km:10,deleted:false,start:'JP',alloc:{JP:10},consented:true},
 {id:'c',user:'u2',year:2026,km:30,deleted:false,start:'JP',alloc:{JP:30},consented:false},
 {id:'d',user:'u3',year:2025,km:50,deleted:true,start:'JP',alloc:{JP:50},consented:true},
 {id:'e',user:'u4',year:2025,km:20,deleted:false,start:null,alloc:{US:20},consented:true},
 {id:'f',user:'u5',year:2025,km:15,deleted:false,start:'US',alloc:{US:15},consented:false}
];
const sum=a=>a.reduce((x,y)=>x+y,0);
function existingStats(data){
 const eligible=data.filter(r=>!r.deleted),country={};
 for(const r of eligible) if(r.start)country[r.start]=(country[r.start]||0)+r.km;
 return {count:eligible.length,totalKm:sum(eligible.filter(r=>r.km>0).map(r=>r.km)),country};
}
function b1Synthetic(data,country,year){
 return sum(data.filter(r=>!r.deleted&&r.consented&&r.year===year).map(r=>r.alloc[country]||0));
}
const pub=existingStats(runs);
assert.deepEqual(pub,{count:5,totalKm:115,country:{JP:80,US:15}});
assert.equal(b1Synthetic(runs,'JP',2025),30);
assert.equal(b1Synthetic(runs,'US',2025),40);
assert.equal(b1Synthetic(runs,'JP',2026),0);
assert.notEqual(pub.country.JP,b1Synthetic(runs,'JP',2025));
// The gap is not a person. It includes other years, non-consent and different country assignment.
assert.equal(pub.country.JP-b1Synthetic(runs,'JP',2025),50);
// A foreign-country segment can contribute to B-1 but not the start-country public chip.
assert.equal(runs[0].alloc.US,20);
assert.equal(pub.count,runs.filter(r=>!r.deleted).length);
// Duplicate-like records are not deduplicated in the inspected pagination SQL.
// This model does not claim duplicate records exist in production.
const duplicateLike=[...runs,{...runs[1],id:'b-copy'}];
assert.equal(existingStats(duplicateLike).totalKm,pub.totalKm+10);
console.log('PASS synthetic cohort mismatch: deleted rows, all-years totals, consent, start-country vs allocated-country, duplicate-like record');
console.log('NOT VERIFIED: original upload deduplication, actual B-1 allocation SQL, users or distances in production, safe public release.');
