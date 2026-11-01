import assert from 'node:assert/strict';
// Synthetic only. Exhaustive search of integer distances in a miniature model.
const actual=[20,30,40,10],other=[30,20,20,40],unrelated=[10,10];
const round=(n,s)=>Math.round(n/s)*s;
const years=[round(actual[0]+actual[1]+other[0]+other[1],20),round(actual[2]+actual[3]+other[2]+other[3],20)];
const publicTotals=[actual[0]+actual[2]+other[0]+other[2]+unrelated[0],actual[1]+actual[3]+other[1]+other[3]+unrelated[1]];
const possible=[];
for(let a=0;a<=60;a++)for(let b=0;b<=60;b++)for(let c=0;c<=60;c++)for(let d=0;d<=60;d++){
 if(round(a+b+other[0]+other[1],20)!==years[0]||round(c+d+other[2]+other[3],20)!==years[1])continue;
 const x=publicTotals[0]-(a+c+other[0]+other[2]),y=publicTotals[1]-(b+d+other[1]+other[3]);
 if(x>=0&&x<=20&&y>=0&&y<=20)possible.push([a,b,c,d]);
}
const known=possible.filter(v=>v[0]+v[2]+other[0]+other[2]+unrelated[0]===publicTotals[0]&&v[1]+v[3]+other[1]+other[3]+unrelated[1]===publicTotals[1]);
const final=known.filter(v=>v[0]===actual[0]&&v[3]===actual[3]);
const bounds=rows=>actual.map((_,i)=>[Math.min(...rows.map(r=>r[i])),Math.max(...rows.map(r=>r[i]))]);
assert.equal(possible.length,185779);
assert.equal(known.length,451);
assert.equal(final.length,1);
assert.deepEqual(bounds(final),actual.map(x=>[x,x]));
console.log(JSON.stringify({kind:'b1_synthetic_joint_worstcase',initial:possible.length,knownUnrelated:known.length,knownTwoTargetValues:final.length,bounds:bounds(final)}));
console.log('ATTACK demonstration only: not real data or proof of privacy.');
