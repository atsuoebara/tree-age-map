import assert from 'node:assert/strict';
// Entirely synthetic observations. PASS never constitutes privacy approval.
const steps=[100,500,1000,5000], mins=[5,10,20,30,50,100];
const one=[.1,.2,.3,.4],two=[.3,.4,.5,.6],three=[.3,.4,.5,.6];
const modes=['nearest','floor'], sum=a=>a.reduce((x,y)=>x+y,0);
const profiles=[Array(20).fill(1000),Array(100).fill(1000),[9000,9000,...Array(18).fill(1000)],[20000,...Array(19).fill(500)],Array(5).fill(1000)];
function rounded(n,s,m){return (m==='nearest'?Math.round(n/s):Math.floor(n/s))*s;}
function bounds(n,s,m){return m==='nearest'?[n-s/2,n+s/2]:[n,n+s];}
function eligible(v,n,a,b,c){const x=[...v].sort((i,j)=>j-i),t=sum(x);return x.length>=n&&t>0&&x[0]/t<=a&&sum(x.slice(0,2))/t<=b&&sum(x.slice(0,3))/t<=c;}
function residual(v,s,m,k){const t=sum(v),p=rounded(t,s,m),[l,h]=bounds(p,s,m),known=sum(v.slice(0,k));return {lo:Math.max(0,l-known),hi:Math.max(0,h-known),actual:t-known};}
let tested=0,yes=0,no=0,narrow=0,minWidth=Infinity,maxWidth=0;
for(const v of profiles)for(const n of mins)for(const a of one)for(const b of two)for(const c of three)for(const s of steps)for(const m of modes){
 tested++;if(!eligible(v,n,a,b,c)){no++;continue;}yes++;
 for(const k of [0,Math.max(0,v.length-3),v.length-1]){
  const r=residual(v,s,m,k),width=r.hi-r.lo;
  assert.ok(r.lo<=r.actual&&r.actual<r.hi);
  minWidth=Math.min(width,minWidth);maxWidth=Math.max(width,maxWidth);
  if(width<=500)narrow++;
 }
}
assert.equal(tested,15360);assert.equal(tested,yes+no);assert.ok(yes>0&&no>0&&narrow>0);
assert.equal(rounded(22000,500,'nearest')-rounded(20000,500,'nearest'),2000);
console.log(JSON.stringify({kind:'synthetic_interval_exploration',tested,eligibleExamples:yes,suppressedExamples:no,narrowObservations:narrow,minWidthKm:minWidth,maxWidthKm:maxWidth}));
console.log('NOT VALIDATED: actual privacy, Sybil, joint inference, real distributions, API/DB races, acceptable disclosure bounds.');
