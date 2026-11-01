import assert from 'node:assert/strict';
// B-1 joint-inference attack model: SYNTHETIC ONLY. Not a production privacy check.
// Variables: target user's eligible annual distance x, other eligible annual distance y,
// and unrelated/ineligible distance z. Public overall statistics may include z.
const round=(v,step)=>Math.round(v/step)*step;
const range=(published,step)=>[published-step/2,published+step/2];
function feasible({b1,step,overall,otherRange=[0,Infinity],unrelatedRange=[0,Infinity],targetRange=[0,Infinity]}){
 let values=[];
 // integer km synthetic exhaustive search, deliberately bounded small inputs
 for(let x=Math.ceil(targetRange[0]);x<=Math.min(targetRange[1],1000);x++)
  for(let y=Math.ceil(otherRange[0]);y<=Math.min(otherRange[1],1000);y++){
   const eligible=x+y;
   if(round(eligible,step)!==b1)continue;
   if(overall){
     const z=overall.value-eligible;
     if(z<unrelatedRange[0]||z>unrelatedRange[1])continue;
   }
   values.push(x);
  }
 return values.length?{min:Math.min(...values),max:Math.max(...values),width:Math.max(...values)-Math.min(...values),count:values.length}:null;
}
function check(name,input,expected){const r=feasible(input);assert.ok(r,name);assert.deepEqual([r.min,r.max],expected,name);console.log(JSON.stringify({case:name,rangeKm:[r.min,r.max],widthKm:r.width,possibleValues:r.count}));}
// B-1 rounded annual eligible sum: x+y=100, published 100 at 100km step.
// An exactly matching public total *does not* imply same cohort unless z known zero.
check('unrelated-included',{b1:100,step:100,overall:{value:150},otherRange:[50,50],unrelatedRange:[0,100],targetRange:[0,200]},[0,99]);
// If exact public subtotal identifies unrelated activities, x is exposed.
check('unrelated-known',{b1:100,step:100,overall:{value:150},otherRange:[50,50],unrelatedRange:[50,50],targetRange:[0,200]},[50,50]);
// Public totals may use another population or time frame; no equation without overlap.
check('no-join-allowed',{b1:100,step:100,otherRange:[50,50],targetRange:[0,200]},[0,99]);
// Attacker knows own contribution; remaining individual can be narrowed.
check('attacker-own-contribution',{b1:100,step:100,otherRange:[90,90],targetRange:[0,200]},[0,59]);
console.log('FINDING: related public statistics and known subgroup values can reduce uncertainty to zero.');
console.log('NOT VALIDATED: real public statistic definitions, population overlap, multiple years, exact live site values, Sybil, consent, API, and privacy acceptance.');
