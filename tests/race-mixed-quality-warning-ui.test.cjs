'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('previews/race-mixed-quality-warning-synthetic-20261112.html','utf8');
assert.match(html,/<meta name="robots" content="noindex,nofollow">/);
assert.match(html,/DRAFT · SYNTHETIC/);
assert.match(html,/min-height:44px/);
assert.match(html,/aria-pressed="true"/);
assert.ok(!/fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|supabase\.createClient|navigator\.sendBeacon/.test(html));
assert.ok(!/src="https?:|href="https?:|@import|url\(https?:/.test(html));
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const elements=new Map();
function el(id){
 if(!elements.has(id)){
  const listeners={},options=Array.from({length:id==='scenario'?4:0},()=>({textContent:''}));
  elements.set(id,{id,value:id==='scenario'?'mixed':'',textContent:'',children:[],attrs:{},listeners,
   classList:{toggle(name,on){this[name]=on}},setAttribute(k,v){this.attrs[k]=v},
   addEventListener(name,fn){listeners[name]=fn},querySelectorAll(sel){return sel==='option'?options:[]},
   replaceChildren(){this.children=[]},append(...x){this.children.push(...x)}});
 }
 return elements.get(id);
}
const document={getElementById:el,documentElement:{lang:'ja'},createElement(tag){return {tag,textContent:'',className:'',children:[],append(...x){this.children.push(...x)}}}};
const context={document,console};vm.runInNewContext(script,context);
function verify(id,language,lapCount,warningCount){
 el('scenario').value=id;el('scenario').listeners.change();
 assert.equal(el('laps').children.length,lapCount);
 assert.equal(document.documentElement.lang,language);
 assert.match(el('suggestions').textContent,language==='ja'?/表示しません/:/not shown/);
 assert.match(el('notice').textContent,language==='ja'?/未認定/:/unverified/);
 const rows=el('laps').children;
 assert.equal(rows.filter(x=>x.children[0].children[1].textContent.includes(language==='ja'?'疑い':'Possible')).length<=warningCount,true);
 assert.ok(rows.every(x=>/^\d{2}:\d{2}$/.test(x.children[1].textContent)));
 assert.equal(el('summary').textContent.includes(String(warningCount)),true);
}
verify('mixed','ja',8,4);
verify('plateau','ja',8,1);
verify('clean','ja',8,0);
verify('partial','ja',9,1);
assert.match(el('laps').children.at(-1).children[0].children[0].textContent,/0\.42 km/);
el('en').listeners.click();
verify('partial','en',9,1);
assert.equal(el('en').attrs['aria-pressed'],'true');
assert.equal(el('ja').attrs['aria-pressed'],'false');
el('ja').listeners.click();verify('mixed','ja',8,4);
assert.equal(el('ja').attrs['aria-pressed'],'true');
const src=fs.readFileSync('src/race-mixed-quality-policy-review.cjs','utf8');
assert.match(src,/policyDecision:'undecided'/);
assert.match(src,/recommendationsAllowed:false/);
console.log('Synthetic mixed-quality warning UI checks PASS');
