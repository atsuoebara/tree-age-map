import assert from 'node:assert/strict';
// B-1 extended synthetic safety checks. These deliberately demonstrate attacks;
// a passing test never authorizes publication.
const round=(x,step)=>Math.round(x/step)*step;
function uniqueContributors(rows){const users=new Map();for(const r of rows){if(r.km>0)users.set(r.user,(users.get(r.user)||0)+r.km);}return [...users.values()];}
function evaluate(rows,{minUsers,maxShare,maxTop3,step}){const v=uniqueContributors(rows).sort((a,b)=>b-a),total=v.reduce((a,b)=>a+b,0);if(!total||v.length<minUsers)return null;if(v[0]/total>maxShare)return null;if(v.slice(0,3).reduce((a,b)=>a+b,0)/total>maxTop3)return null;return round(total,step);}
const sample=n=>Array.from({length:n},(_,i)=>({user:'u'+i,km:1000}));
const rows=sample(20);
const settings={minUsers:20,maxShare:.1,maxTop3:.25,step:500};
assert.equal(evaluate(rows,settings),20000);
assert.equal(evaluate(sample(19),settings),null);
assert.equal(evaluate([...sample(20),{user:'u0',km:100000}],settings),null);
assert.equal(evaluate(sample(20).map((x,i)=>({...x,km:i<3?10000:1000})),settings),null);
assert.equal(uniqueContributors([{user:'a',km:100},{user:'a',km:200},{user:'b',km:0}]).length,1);
for(const step of [100,500,1000,5000]){assert.equal(round(step/2-.01,step),0);assert.equal(round(step/2+.01,step),step);}
function publicRead(s){return s.enabled&&!s.dirty&&!s.oldDirty&&s.generation===s.approvedGeneration&&s.consent&&s.reviewed?s.rounded:null;}
const state={enabled:true,dirty:false,oldDirty:false,generation:1,approvedGeneration:1,consent:true,reviewed:true,rounded:20000};
assert.equal(publicRead(state),20000);
for(const changed of [{enabled:false},{dirty:true},{oldDirty:true},{consent:false},{reviewed:false},{generation:2}])assert.equal(publicRead({...state,...changed}),null);
// Publishing two successive snapshots exposes a new contributor exactly,
// even when both totals have passed coarse rounding.
const old=round(20000,500),newer=round(22000,500);
assert.equal(newer-old,2000);
const knownOthers=19500;
const unknownRange=[old-250-knownOthers,old+250-knownOthers];
assert.deepEqual(unknownRange,[250,750]);
console.log('PASS B-1 extended synthetic checks: uniqueness, suppression, boundary, stop gate, diff and external knowledge');
console.log('NOT TESTED: real PostgreSQL concurrency, HTTP, caches, Sybil resistance, actual consent, privacy adequacy.');
