'use strict';
// B-1 synthetic-only privacy attack regression harness. No production data.
const assert=require('node:assert/strict');
const sum=a=>a.reduce((s,x)=>s+x,0);
const naive=a=>a.length>=5?sum(a):null;
let n=0;
function leak(name,observed,secret){
 assert.equal(observed,secret);
 console.log('LEAK_DEMONSTRATED '+name+' inferred_km='+observed);
 n++;
}
const five=[10,20,30,40,50];
leak('temporal_new_runner',naive([...five,7])-naive(five),7);
leak('parent_child_subtraction',naive([...five,17])-naive(five),17);
leak('annual_month_difference',(naive(five)+13)-naive(five),13);
leak('consent_revocation_difference',naive([...five,19])-naive(five),19);
const round10=v=>Math.round(v/10)*10;
assert.equal(round10(150),150);
assert.equal(round10(157),160);
console.log('LEAK_DEMONSTRATED rounding_boundary rounded_delta=10_actual_delta=7');
n++;
assert.equal(naive([1,2,3,4]),null);
console.log('BASELINE_SUPPRESSION_OK under_five');
n++;
function publicationGate(_rows,{policyApproved=false,publicationEnabled=false}={}){
 return policyApproved&&publicationEnabled?'NOT_IMPLEMENTED':null;
}
assert.equal(publicationGate([200]),null);
console.log('FAIL_CLOSED_OK no_approved_policy');
n++;
console.log('B1_PRIVACY_ATTACK_HARNESS_OK checks='+n+'; no safe public aggregator certified');
