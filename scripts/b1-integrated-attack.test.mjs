import assert from 'node:assert/strict';
// SYNTHETIC miniature; per cell target T and second unknown V; attacker knows own A.
const own=[12,8,10,10],target=[20,30,40,10],second=[30,20,20,40],unrelated=[10,10];
const round=n=>Math.round(n/20)*20;
const cells=own.map((a,i)=>round(a+target[i]+second[i]));
const countries=[0,1].map(c=>own[c]+own[c+2]+target[c]+target[c+2]+second[c]+second[c+2]+unrelated[c]);
const options=cells.map((p,i)=>{const a=[];for(let t=0;t<=60;t++)for(let v=0;v<=60;v++)if(round(own[i]+t+v)===p)a.push([t,v]);return a;});
function countryBounds(c,knownUnrelated){
 let n=0,min=[Infinity,Infinity],max=[-Infinity,-Infinity];
 for(const [t0,v0] of options[c])for(const [t1,v1] of options[c+2]){
  const z=countries[c]-own[c]-own[c+2]-t0-t1-v0-v1;
  if(knownUnrelated?z!==unrelated[c]:z<0||z>20)continue;
  n++;min[0]=Math.min(min[0],t0);min[1]=Math.min(min[1],t1);
  max[0]=Math.max(max[0],t0);max[1]=Math.max(max[1],t1);
 }
 return {n,min,max};
}
const unknown=[countryBounds(0,false),countryBounds(1,false)];
const known=[countryBounds(0,true),countryBounds(1,true)];
assert.deepEqual(unknown.map(x=>x.n),[652145,804140]);
assert.deepEqual(known.map(x=>x.n),[32357,48830]);
for(const c of [0,1])for(let i=0;i<2;i++)assert.ok(known[c].min[i]<=target[c+2*i]&&target[c+2*i]<=known[c].max[i]);
console.log(JSON.stringify({kind:'synthetic_integrated_attack',cells,countries,unknown,known}));
console.log('NOT VERIFIED: production population overlap, temporal linkage, real size, privacy or consent.');
