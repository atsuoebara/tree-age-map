import assert from 'node:assert/strict';
// Synthetic only. Attacker knows own contribution; target and second person unknown.
const own=[12,8,10,10],target=[20,30,40,10],other=[30,20,20,40],z=[10,10];
const round=(x)=>Math.round(x/20)*20;
const cells=own.map((v,i)=>round(v+target[i]+other[i]));
const country=[0,1].map(c=>own[c]+own[c+2]+target[c]+target[c+2]+other[c]+other[c+2]+z[c]);
const options=cells.map((p,i)=>{let a=[];for(let t=0;t<=60;t++)for(let v=0;v<=60;v++)if(round(own[i]+t+v)===p)a.push([t,v]);return a;});
function solve(c,increment=null){
 let base=0,n=0,lo=Infinity,hi=-Infinity;
 for(const [t0,v0] of options[c])for(const [t1,v1] of options[c+2]){
  const extra=country[c]-own[c]-own[c+2]-t0-t1-v0-v1;
  if(extra<0||extra>20)continue;
  base++;
  if(increment!==null&&t1!==increment)continue;
  n++;lo=Math.min(lo,t1);hi=Math.max(hi,t1);
 }
 return {base,n,lo,hi};
}
const before=solve(0),isolated=solve(0,target[2]);
assert.equal(before.base,652145);
assert.equal(isolated.n,12074);
assert.deepEqual([isolated.lo,isolated.hi],[40,40]);
const batchDelta=target[2]+other[2];
assert.equal(batchDelta,60);assert.notEqual(batchDelta,target[2]);
console.log(JSON.stringify({kind:'synthetic_timeseries_integrated',cells,country,before,isolated,batchDelta}));
console.log('Conditional attack only: target ingestion timestamp and isolated update must be externally known; batched changes do not identify a person. No real data or publication approval.');
