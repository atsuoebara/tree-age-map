import assert from 'node:assert/strict';
// B-1 synthetic attack regression tests. Never treat PASS as privacy approval.
const sums=a=>a.reduce((x,y)=>x+y,0);
const round=(n,s)=>Math.round(n/s)*s;
const metrics=values=>{const a=values.filter(x=>x>0).sort((x,y)=>y-x),total=sums(a);return {n:a.length,max:total?a[0]/total:0,top2:total?sums(a.slice(0,2))/total:0,top3:total?sums(a.slice(0,3))/total:0};};
const gate=s=>s.enabled&&!s.dirty&&!s.legacyDirty&&s.generation===s.approvedGeneration&&s.reviewed&&s.consentValid?s.value:null;
const balanced=n=>Array(n).fill(1000);
const cases=[];
function test(id,fn){try{const detail=fn();cases.push({id,status:'PASS',detail});}catch(e){cases.push({id,status:'FAIL',detail:e.message});process.exitCode=1;}}
test('T1',()=>{for(const n of [4,5,10,20,30,50,100])for(const limit of [5,10,20,30,50,100])assert.equal(metrics(balanced(n)).n>=limit,n>=limit);assert.ok(metrics([100000,...balanced(99)]).max>.4);assert.equal(metrics([0,1000,1000]).n,2);return 'Population boundaries and concentration tested';});
test('T2',()=>{const old=round(sums(balanced(20)),500),now=round(sums([...balanced(20),2000]),500);assert.equal(now-old,2000);return 'ATTACK: revision difference exposes one 2000km contribution';});
test('T3',()=>{assert.equal(round(23500,500)-round(20000,500),3500);return 'ATTACK: repeated cross-year difference is observable';});
test('T4',()=>{const jp=new Map([['a',100],['b',200]]),us=new Map([['a',300]]);assert.equal(jp.size,2);assert.equal(us.size,1);assert.ok(metrics([...us.values()]).n<5);return 'Single contributor country suppressed by minimum-count rule';});
test('T5',()=>{assert.equal(12000-9000,3000);return 'ATTACK: public grand total minus known countries reveals 3000km';});
test('T6',()=>{for(const s of [100,500,1000,5000]){assert.equal(round(s/2-.01,s),0);assert.equal(round(s/2+.01,s),s);}return 'Rounding boundaries leak changes';});
test('T7',()=>{const s={enabled:true,dirty:false,legacyDirty:false,generation:1,approvedGeneration:1,reviewed:true,consentValid:true,value:3000};assert.equal(gate(s),3000);s.enabled=false;s.dirty=true;s.generation++;assert.equal(gate(s),null);s.enabled=true;s.dirty=false;assert.equal(gate(s),null);return 'Mock withdrawal generation blocked; concurrency and SQL NOT tested';});
test('T8',()=>{const s={enabled:true,dirty:false,legacyDirty:false,generation:1,approvedGeneration:1,reviewed:true,consentValid:true,value:3000};for(const k of ['enabled','reviewed','consentValid'])assert.equal(gate({...s,[k]:false}),null);for(const k of ['dirty','legacyDirty'])assert.equal(gate({...s,[k]:true}),null);assert.equal(gate({...s,generation:2}),null);return 'Mock gate blocked; actual HTTP/cache/CDN NOT tested';});
test('T9',()=>{const low=10000-500/2-9700,high=10000+500/2-9700;assert.equal(low,50);assert.equal(high,550);return 'ATTACK: external knowledge narrows contribution to [50,550)km';});
for(const c of cases)console.log(c.status,c.id,c.detail);
console.log('These are synthetic proof-of-concept checks, NOT a release certification.');
