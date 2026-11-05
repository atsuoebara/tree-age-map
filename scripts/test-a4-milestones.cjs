const assert=require('node:assert/strict');
const {first30km,validRoute,verifiedImportedRun,hundredthRun,numberedRunMilestones}=require('../a4-milestones-core.js');
const route=[[35.1,139.1],[35.2,139.2]];
const base={id:1,started_at:'2026-10-01T02:00:00Z',distance_km:30,route,deleted_at:null,verifiedRun:true};
const run=r=>first30km(r,x=>x.verifiedRun===true);
assert.equal(run([{...base,distance_km:29.999}]),null);
assert.equal(run([{...base,distance_km:29.9995}]),null);
assert.equal(run([base]).id,1);
assert.equal(run([{...base,route:[]}]),null);
assert.equal(run([{...base,route:[[100,139],[35,139]]}]),null);
assert.equal(run([{...base,started_at:null}]),null);
assert.equal(run([{...base,deleted_at:'2026-10-02T00:00:00Z'}]),null);
assert.equal(run([{...base,verifiedRun:false}]),null);
assert.equal(run([{...base,id:3,started_at:'2026-11-01T00:00:00Z'},{...base,id:2}]).id,2);
assert.equal(run([{...base,id:3},{...base,id:2}]).id,2);
assert.equal(validRoute([[0,0],[0,0]]),false);
assert.equal(validRoute(Array(100).fill([0,0])),false);
assert.equal(validRoute([[0,0],[0,0],[0.0001,0]]),true);
assert.equal(validRoute([[100,139],[0,0],[0,0]]),false);
assert.equal(validRoute([[35.1,139.1],[35.2,139.2]]),true);
assert.equal(run([{...base,route:[[0,0],[0,0]]}]),null);
assert.equal(run([{...base,route:Array(100).fill([0,0])}]),null);
assert.throws(()=>first30km([base]),/verifier/);
// A-4 Strava expansion: source alone is not enough; require a linked Strava ID.
const candidate={...base,verifiedRun:undefined,source:'strava',strava_id:123456789};
const eligible=rows=>first30km(rows,verifiedImportedRun);
assert.equal(eligible([{...candidate,source:'fit',strava_id:null}])?.id,1);
assert.equal(eligible([candidate])?.id,1);
assert.equal(eligible([{...candidate,strava_id:'123456789'}])?.id,1);
assert.equal(eligible([{...candidate,strava_id:null}]),null);
assert.equal(eligible([{...candidate,strava_id:0}]),null);
assert.equal(eligible([{...candidate,source:'gpx'}]),null);
assert.equal(eligible([{...candidate,source:'tcx'}]),null);
assert.equal(eligible([{...candidate,source:'garmin'}]),null);
assert.equal(eligible([{...candidate,source:'intervals'}]),null);
assert.equal(eligible([{...candidate,source:'unknown'}]),null);
assert.equal(eligible([{...candidate,source:'strava',distance_km:29.9995}]),null);
assert.equal(eligible([{...candidate,source:'strava',route:[[0,0],[0,0]]}]),null);
assert.equal(eligible([{...candidate,source:'strava',deleted_at:'2026-11-02T00:00:00Z'}]),null);
assert.equal(eligible([{...candidate,source:'strava',started_at:null}]),null);
assert.equal(eligible([{...candidate,id:3,started_at:'2026-10-02T00:00:00Z'},{...candidate,id:2,started_at:'2026-09-02T00:00:00Z'}])?.id,2);
// A linked Strava row retains the previous saved route/distance: threshold
// remains based on saved distance, never an invented Strava distance.
assert.equal(eligible([{...candidate,source:'strava',distance_km:30,route:[[35.1,139.1],[35.2,139.2]]}])?.id,1);
// A-4 number milestones: 99/100/101 boundaries, GPS-less runs and chronology.
const mkRun=(id,overrides={})=>({
  id,source:'strava',strava_id:100000+id,
  started_at:new Date(Date.UTC(2024,0,1,0,id)).toISOString(),
  distance_km:5,route:[],deleted_at:null,...overrides
});
const hundred=rows=>hundredthRun(rows,verifiedImportedRun);
const ninetyNine=Array.from({length:99},(_,i)=>mkRun(i+1));
assert.equal(hundred(ninetyNine).record,null);
assert.equal(hundred(ninetyNine).eligibleCount,99);
const oneHundred=[...ninetyNine,mkRun(100)];
assert.equal(hundred(oneHundred).record.id,100);
assert.equal(hundred(oneHundred).eligibleCount,100);
assert.equal(hundred([...oneHundred,mkRun(101)]).record.id,100);
assert.equal(hundred([...oneHundred].reverse()).record.id,100);
// The earliest by started_at wins regardless of import order and route presence.
const past=mkRun(200,{started_at:'2023-01-01T00:00:00Z'});
assert.equal(hundred([...oneHundred,past]).record.id,99);
// Same timestamp is ordered by runs primary key, not Strava ID.
const tied=oneHundred.map(r=>({...r,started_at:'2024-01-01T00:00:00Z'})).reverse();
assert.equal(hundred(tied).record.id,100);
assert.equal(hundred([...oneHundred,mkRun(101,{deleted_at:'2026-10-01T00:00:00Z'})]).eligibleCount,100);
assert.equal(hundred([...ninetyNine,mkRun(100,{started_at:null})]).record,null);
assert.equal(hundred([...ninetyNine,mkRun(100,{source:'gpx'})]).record,null);
assert.equal(hundred([...ninetyNine,mkRun(100,{source:'garmin'})]).record,null);
assert.equal(hundred([...ninetyNine,mkRun(100,{source:'strava',strava_id:null})]).record,null);
assert.equal(hundred([...ninetyNine,mkRun(100,{source:'fit',strava_id:null})]).record.id,100);
assert.equal(hundred([...ninetyNine,mkRun(100,{route:[]})]).record.id,100);
assert.throws(()=>hundred([...oneHundred,oneHundred[0]]),/Duplicate saved run ID/);
assert.throws(()=>hundredthRun(oneHundred),/verifier/);
assert.throws(()=>hundred(null),/Expected array/);
// Growing milestones must work for long-term runners, not stop at 2,500.
const milestones=rows=>numberedRunMilestones(rows,verifiedImportedRun);
const mkMany=n=>Array.from({length:n},(_,i)=>mkRun(i+1));
assert.equal(milestones(mkMany(499)).records[500],null);
assert.equal(milestones(mkMany(500)).records[500].id,500);
assert.equal(milestones(mkMany(999)).records[1000],null);
assert.equal(milestones(mkMany(1000)).records[1000].id,1000);
const m1434=milestones(mkMany(1434));
assert.equal(m1434.eligibleCount,1434);
assert.equal(m1434.records[1000].id,1000);
assert.equal(m1434.records[1500],null);
const m1500=milestones(mkMany(1500));
assert.equal(m1500.records[1500].id,1500);
assert.equal(m1500.records[2000],null);
const m6000=milestones(mkMany(6000));
assert.equal(m6000.records[5000].id,5000);
assert.equal(m6000.records[6000].id,6000);
assert.equal(m6000.records[6500],null);
assert.equal(milestones(mkMany(100)).records[500],null);
assert.equal(milestones([...mkMany(100),mkRun(200,{deleted_at:'2026-01-01T00:00:00Z'})]).eligibleCount,100);
assert.throws(()=>milestones([...mkMany(100),mkRun(1)]),/Duplicate saved run ID/);
assert.throws(()=>numberedRunMilestones(mkMany(100),verifiedImportedRun,[100,100]),/Invalid milestone targets/);
assert.throws(()=>numberedRunMilestones(mkMany(100),verifiedImportedRun,[0]),/Invalid milestone targets/);
assert.equal(numberedRunMilestones(mkMany(500),verifiedImportedRun,[500]).records[500].id,500);
assert.equal(hundred(mkMany(500)).record.id,100);
console.log('A-4 prototype tests passed');
