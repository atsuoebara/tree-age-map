import assert from 'node:assert/strict';
// Synthetic risk evaluation only. No personal data or release authorization.
const own=[12,8,10,10],target=[20,30,40,10],other=[30,20,20,40],z=[10,10];
const round=n=>Math.round(n/20)*20;
const cell=own.map((x,i)=>round(x+target[i]+other[i]));
const total=own[0]+own[2]+target[0]+target[2]+other[0]+other[2]+z[0];
const option=i=>{const a=[];for(let t=0;t<=60;t++)for(let u=0;u<=60;u++)if(round(own[i]+t+u)===cell[i])a.push([t,u]);return a;};
const left=option(0),right=option(2);
function metric(lo,hi,truth){
 const width=hi-lo;
 return {lo,hi,width,evaluatorRelativeWidth:truth>0?width/truth:null,
 attackerRelativeWidthLowerBound:hi>0?width/hi:null,
 attackerRelativeWidthUpperBound:lo>0?width/lo:null,
 attackerRelativeIndeterminate:lo===0,
 zeroPossible:lo===0,participationGuaranteed:lo>0,absenceGuaranteed:hi===0,
 highDistanceGuaranteed:lo>=30};
}
function solve(observedTargetIncrement=null){
 let count=0,lo=Infinity,hi=-Infinity;
 for(const [a,b] of left)for(const [c,d] of right){
  const extra=total-own[0]-own[2]-a-b-c-d;
  if(extra<0||extra>20)continue;
  if(observedTargetIncrement!==null&&c!==observedTargetIncrement)continue;
  count++;lo=Math.min(lo,c);hi=Math.max(hi,c);
 }
 return {count,metric:metric(lo,hi,target[2])};
}
const baseline=solve(),isolated=solve(40);
assert.equal(baseline.count,652145);assert.equal(isolated.count,12074);
assert.deepEqual([baseline.metric.lo,baseline.metric.hi],[0,60]);
assert.deepEqual([isolated.metric.lo,isolated.metric.hi],[40,40]);
assert.equal(baseline.metric.evaluatorRelativeWidth,1.5);
assert.equal(baseline.metric.attackerRelativeWidthLowerBound,1);
assert.equal(baseline.metric.attackerRelativeIndeterminate,true);
assert.equal(isolated.metric.participationGuaranteed,true);
const highLowerBound=metric(4800,5400,5000),absence=metric(0,0,0);
assert.equal(highLowerBound.width,600);assert.equal(highLowerBound.highDistanceGuaranteed,true);
assert.equal(absence.absenceGuaranteed,true);
const batch={increment:60,knownIsolated:false,possibleTargetDistances:[0,40]};
assert.equal(target[2]+other[2],batch.increment);
console.log(JSON.stringify({kind:'synthetic_b1_risk_metrics',baseline,isolated,highLowerBound,absence,batch}));
console.log('LIMITS: 300-second public-statistics cache may combine multiple imports. Isolated attribution requires externally known identity and timing and no concurrent import in the observation window. Synthetic-truth ratios are evaluator metrics, not attacker knowledge. Relative-risk thresholds remain undecided. No real data or public release.');
