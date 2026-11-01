import assert from 'node:assert/strict';
// SYNTHETIC ONLY. Four country-year cells; attacker knows own contribution.
// Unknown target and another unknown participant are independently enumerated.
const own=[12,8,10,10],target=[20,30,40,10],other=[30,20,20,40];
const rounded=(v,s)=>Math.round(v/s)*s;
const published=own.map((v,i)=>rounded(v+target[i]+other[i],20));
function bounds(knowOther){
 return published.map((pub,i)=>{
  let min=Infinity,max=-Infinity,count=0;
  for(let t=0;t<=80;t++)for(let u=0;u<=80;u++){
   if(knowOther&&u!==other[i])continue;
   if(rounded(own[i]+t+u,20)!==pub)continue;
   min=Math.min(min,t);max=Math.max(max,t);count++;
  }
  return {cell:i,min,max,width:max-min,feasiblePairs:count};
 });
}
const participant=bounds(false),moreKnowledge=bounds(true);
assert.deepEqual(published,[60,60,80,60]);
assert.deepEqual(participant.map(x=>[x.min,x.max]),[[0,57],[0,61],[0,79],[0,59]]);
assert.deepEqual(moreKnowledge.map(x=>[x.min,x.max]),[[8,27],[22,41],[40,59],[0,19]]);
assert.ok(moreKnowledge.every((x,i)=>x.width<participant[i].width));
assert.equal(190-150,40); // isolated exact public total change, identity not established
console.log(JSON.stringify({kind:'synthetic_participant_attack',published,participant,moreKnowledge,isolatedIncrementKm:40}));
console.log('LIMITS: independent cell constraints, no year-country cross-correlation, no actual cohort, identity or security guarantee.');
