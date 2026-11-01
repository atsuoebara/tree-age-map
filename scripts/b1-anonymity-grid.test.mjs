import assert from 'node:assert/strict';
// Synthetic candidate-grid exploration. This is NOT a privacy certification.
const minimums=[5,10,20,30,50,100], oneLimits=[.1,.2,.3,.4];
const twoLimits=[.3,.4,.5,.6],threeLimits=[.3,.4,.5,.6];
const steps=[100,500,1000,5000];
const profiles=[
 {name:'equal-5', values:Array(5).fill(1000)},
 {name:'equal-20', values:Array(20).fill(1000)},
 {name:'equal-100',values:Array(100).fill(1000)},
 {name:'dominant-20',values:[20000,...Array(19).fill(500)]},
 {name:'top-two-20',values:[9000,9000,...Array(18).fill(1000)]},
 {name:'top-three-20',values:[9000,9000,9000,...Array(17).fill(1000)]}
];
const total=a=>a.reduce((x,y)=>x+y,0);
const rounding=(v,step,mode)=>mode==='nearest'?Math.round(v/step)*step:Math.floor(v/step)*step;
function eligible(values,min,one,two,three){const a=values.filter(n=>n>0).sort((x,y)=>y-x),t=total(a);return a.length>=min && t>0 && a[0]/t<=one && total(a.slice(0,2))/t<=two && total(a.slice(0,3))/t<=three;}
let tested=0,approved=0,suppressed=0;
for(const profile of profiles)for(const min of minimums)for(const one of oneLimits)for(const two of twoLimits)for(const three of threeLimits)for(const step of steps)for(const mode of ['nearest','floor']){
 const e=eligible(profile.values,min,one,two,three);
 const output=e?rounding(total(profile.values),step,mode):null;
 if(e){approved++;assert.ok(Number.isFinite(output));}else{suppressed++;assert.equal(output,null);}
 tested++;
}
assert.equal(tested,profiles.length*minimums.length*oneLimits.length*twoLimits.length*threeLimits.length*steps.length*2);
assert.equal(approved+suppressed,tested);
assert.equal(eligible([9000,9000,...Array(18).fill(1000)],20,.3,.4,.6),false); // top2 >40%
assert.equal(eligible(Array(20).fill(1000),20,.1,.3,.3),true);
for(const step of steps){assert.equal(rounding(step-.01,step,'floor'),0);assert.equal(rounding(step+.01,step,'floor'),step);}
const samePerson={2025:1000,2026:2000};
const otherPeople={2025:19000,2026:19000};
const published2025=rounding(samePerson[2025]+otherPeople[2025],500,'nearest');
const published2026=rounding(samePerson[2026]+otherPeople[2026],500,'nearest');
assert.equal(published2026-published2025,1000);
console.log('SYNTHETIC GRID:',JSON.stringify({tested,eligibleExamples:approved,suppressedExamples:suppressed}));
console.log('FINDING: cross-year repeated runner and externally known stable others expose a 1000km change.');
console.log('NOT PROVEN: reidentification resistance, privacy threshold acceptability, Sybil defense, real-data distribution, HTTP/SQL concurrency.');
