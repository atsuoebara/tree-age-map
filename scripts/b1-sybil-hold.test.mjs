import assert from 'node:assert/strict';
// Entirely synthetic: account signals are not proofs of unique humans.
// Fail closed until independent-person verification is actually available.
function assess(accounts, minimum=20){
 const eligible=accounts.filter(a=>a.consent&&a.activity);
 const byExternal=new Map();
 for(const a of eligible)if(a.externalId){const k=a.externalId;byExternal.set(k,(byExternal.get(k)||0)+1);}
 const duplicateExternal=[...byExternal.values()].some(n=>n>1);
 const sharedActivity=new Set(),seenActivity=new Set();
 for(const a of eligible)for(const fp of a.activityKeys||[]){
  if(seenActivity.has(fp))sharedActivity.add(fp);seenActivity.add(fp);
 }
 const unverifiedIdentity=eligible.some(a=>!a.independentPersonVerified);
 return {accounts:eligible.length,naiveThresholdMet:eligible.length>=minimum,duplicateExternal,sharedActivity:sharedActivity.size>0,unverifiedIdentity,decision:'HOLD'};
}
const normal=Array.from({length:20},(_,i)=>({consent:true,activity:true,externalId:'ext'+i,activityKeys:['run'+i],independentPersonVerified:false}));
const sybil=Array.from({length:20},(_,i)=>({consent:true,activity:true,externalId:'same-external',activityKeys:['same-run'],independentPersonVerified:false}));
const split=Array.from({length:20},(_,i)=>({consent:true,activity:true,externalId:'apparently-unique-'+i,activityKeys:['distinct-'+i],independentPersonVerified:false}));
for(const data of [normal,sybil,split]){const r=assess(data);assert.equal(r.naiveThresholdMet,true);assert.equal(r.decision,'HOLD');}
assert.equal(assess(sybil).duplicateExternal,true);
assert.equal(assess(sybil).sharedActivity,true);
assert.equal(assess(split).duplicateExternal,false);
assert.equal(assess(split).unverifiedIdentity,true); // unique identifiers cannot prove distinct humans
assert.equal(assess(normal.slice(0,5)).naiveThresholdMet,false);
console.log(JSON.stringify({kind:'b1_synthetic_sybil_hold',scenarios:4,naiveFalseConfidence:3,sybilDetected:assess(sybil),apparentlyDistinctButUnverified:assess(split)}));
console.log('HOLD is the only outcome. Signals, including external account links, do NOT establish unique-person identity. No personal data, no release.');
