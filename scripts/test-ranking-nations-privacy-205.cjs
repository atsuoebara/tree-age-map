'use strict';
const assert=require('node:assert/strict');
const sum=a=>a.reduce((x,y)=>x+y,0);
const gated=(a,k=5)=>a.length>=k?sum(a):null;
// Synthetic-only counterexamples; PASS documents a risk, NOT privacy clearance.
assert.equal(gated([42],1),42); // single participant
const before=[10,20,30,40,50],after=[...before,7];
assert.equal(gated(after)-gated(before),7); // threshold crossing reveals new person
const prior=[10,20,30,40,50],later=[11,20,30,40,50];
assert.equal(gated(later)-gated(prior),1); // refreshed snapshot reveals incremental km
const annual=sum([100,50,40,30,20]),otherMonths=sum([90,45,35,25,18]);
assert.equal(annual-otherMonths,27); // additive period totals expose remainder
assert.equal(gated([10,20,30,40]),null); // suppression alone insufficient
assert.equal((()=>null)(),null); // fail-closed response concept
console.log('6/6 synthetic assertions PASS; threshold alone is NOT a privacy guarantee');
