import assert from 'node:assert/strict';
// SYNTHETIC only. Counts are distinct simulated people, not account verification.
// Analytical interval intersection, not brute force or a proof of privacy.
const steps=[100,500,1000,5000], sizes=[20,50,100,300], unknownExtra=[0,5000,50000,200000];
const scenarios=[];
const round=(n,s)=>Math.round(n/s)*s;
for(const n of sizes)for(const step of steps)for(const zRange of unknownExtra){
 const distances=Array.from({length:n},(_,i)=>100+(i*271+n*17)%3901);
 const total=distances.reduce((a,b)=>a+b,0),own=distances[0],victim=distances[1];
 const published=round(total,step);
 const knownOther=distances.slice(2).reduce((a,b)=>a+b,0);
 // Strong attacker: all others known, and only target unknown.
 const low=Math.max(0,published-step/2-own-knownOther), high=Math.max(0,published+step/2-own-knownOther);
 assert.ok(victim>=low&&victim<high);
 // Existing total non-overlap lies within a symmetric uncertainty interval.
 const actualZ=100000+n*100, existing=total+actualZ;
 const fromExistingLow=Math.max(0,existing-own-knownOther-(actualZ+zRange/2));
 const fromExistingHigh=Math.max(0,existing-own-knownOther-(actualZ-zRange/2));
 const combinedLow=Math.max(low,fromExistingLow),combinedHigh=Math.min(high,fromExistingHigh);
 assert.ok(victim>=combinedLow&&victim<=combinedHigh);
 // Weak attacker knows own only; other n-2 contributors unknown nonnegative.
 const weakLow=0,weakHigh=Math.max(0,published+step/2-own);
 assert.ok(victim<=weakHigh);
 scenarios.push({n,step,zRange,totalKm:total,strongWidthKm:high-low,combinedWidthKm:combinedHigh-combinedLow,weakUpperKm:weakHigh});
}
assert.equal(scenarios.length,64);
const narrow=scenarios.filter(x=>x.combinedWidthKm<=500).length;
console.log(JSON.stringify({kind:'synthetic_scale_parameter_scan',cases:scenarios.length,narrowCases:narrow,examples:scenarios.filter(x=>x.n===100&&x.step===1000)}));
console.log('NOT VALIDATED: real distribution, identity, cross-year linkage, multi-cell exact constraints, feasibility under heterogeneous contributors, Sybil or release safety.');
