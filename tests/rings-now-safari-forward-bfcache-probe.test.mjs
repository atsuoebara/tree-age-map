import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const launch=readFileSync(new URL('../previews/rings-now-safari-forward-bfcache-start-20261114.html',import.meta.url),'utf8');
const probe=readFileSync(new URL('../previews/rings-now-safari-forward-bfcache-probe-20261114.html',import.meta.url),'utf8');
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
class Element{
 constructor(tag='div'){this.tag=tag;this.children=[];this.textContent='';this.disabled=false;this.handlers={}}
 replaceChildren(...nodes){this.children=[...nodes]}
 append(...nodes){this.children.push(...nodes)}
 addEventListener(name,fn){this.handlers[name]=fn}
 click(){this.handlers.click?.()}
}
function mount(){
 const nodes=new Map(['show','laps','state','resume'].map(id=>[id,new Element()]));
 const events=new Map(),docEvents=new Map();
 const document={
  hidden:false,
  getElementById:id=>nodes.get(id),
  createElement:tag=>new Element(tag),
  addEventListener:(name,fn)=>docEvents.set(name,fn)
 };
 const window={addEventListener:(name,fn)=>events.set(name,fn)};
 const script=probe.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script,'inline test script required');
 vm.runInNewContext(script,{document,window},{timeout:1500});
 return {nodes,document,events,docEvents};
}
function populated(f){
 const laps=f.nodes.get('laps');
 assert.equal(laps.children.length,1);
 assert.equal(laps.children[0].children.length,5);
 assert.equal(laps.children[0].children[0].children[1].textContent,'5:15');
}
function cleared(f){
 assert.equal(f.nodes.get('laps').children.length,0);
 assert.equal(f.nodes.get('show').disabled,true);
 assert.equal(f.nodes.get('state').textContent,'表示：消去済み');
}
test('launch creates a real navigation history: launch -> probe -> browser Back -> Forward',()=>{
 assert.match(launch,/href="\.\/rings-now-safari-forward-bfcache-probe-20261114\.html"/);
 assert.match(launch,/Safariの「戻る」/);
 assert.match(launch,/Safariの「進む」/);
 assert.doesNotMatch(launch,/target="_blank"/);
});
test('fake five laps vanish on pagehide, including bfcache restoration',()=>{
 const f=mount();f.nodes.get('show').click();populated(f);
 f.events.get('pagehide')({});
 cleared(f);
 f.events.get('pageshow')({persisted:true});
 cleared(f);
 assert.equal(f.nodes.get('resume').textContent,'復帰：bfcache (persisted=true)');
 f.nodes.get('show').click();cleared(f);
});
test('fake laps vanish on document hidden and cannot be revived on visible',()=>{
 const f=mount();f.nodes.get('show').click();populated(f);
 f.document.hidden=true;f.docEvents.get('visibilitychange')();cleared(f);
 f.document.hidden=false;f.docEvents.get('visibilitychange')();cleared(f);
});
test('non-bfcache document load reports persisted=false, does not falsely claim bfcache',()=>{
 const first=mount();first.nodes.get('show').click();populated(first);
 const newDocument=mount();
 newDocument.events.get('pageshow')({persisted:false});
 assert.equal(newDocument.nodes.get('resume').textContent,'復帰：新規読み込み (persisted=false)');
 assert.equal(newDocument.nodes.get('laps').children.length,0);
 assert.equal(newDocument.nodes.get('show').disabled,false);
});
test('strict public CSP and no user FIT, fetch, storage or analytics in either page',()=>{
 for(const page of [launch,probe]){
  for(const directive of ["default-src 'none'","connect-src 'none'","img-src 'none'","form-action 'none'"])assert.ok(page.includes(directive),directive);
  for(const forbidden of [/\bfetch\s*\(/,/\bXMLHttpRequest\b/,/\blocalStorage\b/,/\bsessionStorage\b/,/\bindexedDB\b/,/\bnavigator\b/,/\bFileReader\b/,/type="file"/,/\bpostMessage\s*\(/,/\bimport\s*\(/,/<script[^>]+src=/])assert.doesNotMatch(page,forbidden);
 }
 assert.match(index,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
});
