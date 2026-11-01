import assert from 'node:assert/strict';
// B-1: synthetic adversarial regression — NOT privacy certification.
// No real users, no database access, no published values.
const round=(n,s)=>Math.round(n/s)*s;
const sum=a=>a.reduce((x,y)=>x+y,0);
function candidate(rows, policy){
  const totals=new Map();
  for(const {user,km} of rows) if(Number.isFinite(km)&&km>0) totals.set(user,(totals.get(user)||0)+km);
  const values=[...totals.values()].sort((a,b)=>b-a);
  const total=sum(values);
  if(!total||values.length<policy.minUsers)return null;
  if(values[0]/total>policy.maxOne)return null;
  if(sum(values.slice(0,3))/total>policy.maxThree)return null;
  return round(total,policy.step);
}
const p={minUsers:10,maxOne:.2,maxThree:.4,step:500};
const baseline=Array.from({length:10},(_,i)=>({user:'u'+i,km:1000}));
assert.equal(candidate(baseline,p),10000);
// Duplicate runs do not become duplicate unique users.
assert.equal(candidate([{user:'one',km:1000},...Array.from({length:19},()=>({user:'one',km:1000}))],p),null);
// One contributor can inflate activity but cannot pass dominance.
assert.equal(candidate([...baseline,{user:'u0',km:20000}],p),null);
// Even plausible-looking distinct accounts cannot establish distinct humans.
// This passes a naive count; it is a FINDING, not a privacy pass.
const fakeAccounts=Array.from({length:10},(_,i)=>({user:'account'+i,km:1000}));
assert.equal(candidate(fakeAccounts,p),10000);
console.log('FINDING: 10 accounts pass naive user count; real-person uniqueness remains unproven.');
// Revision differencing exposes a known new participant.
const old=round(sum(baseline.map(x=>x.km)),500);
const updated=round(sum([...baseline.map(x=>x.km),2000]),500);
assert.equal(updated-old,2000);
console.log('FINDING: repeated snapshots disclose 2000 km incremental contribution.');
// Combining an aggregate with separately public subtotal leaks the remainder.
assert.equal(22000-20000,2000);
console.log('FINDING: related public aggregates disclose suppressed remainder.');
// Rounding constrains a residual when other contributors are known.
const known=9700,observed=10000,step=500;
const interval=[observed-step/2-known,observed+step/2-known];
assert.deepEqual(interval,[50,550]);
console.log('FINDING: an external observer bounds unknown contribution to [50,550) km.');
// Fail-closed pure mock; this does not test live DB, network or caches.
function read(s){return s.enabled&&!s.dirty&&s.consent&&s.generation===s.reviewGeneration?s.value:null;}
const state={enabled:true,dirty:false,consent:true,generation:1,reviewGeneration:1,value:10000};
assert.equal(read(state),10000);
assert.equal(read({...state,consent:false}),null);
assert.equal(read({...state,generation:2}),null);
assert.equal(read({...state,dirty:true}),null);
console.log('PASS: synthetic controls and attack examples behave as expected.');
console.log('NOT VERIFIED: Sybil protection, actual anonymity, SQL races, HTTP/CDN cache, real consent, production release.');
