import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeSyntheticRaceFit} from '../scripts/make-synthetic-race-fit.mjs';
import {createRingsNowPrivateFitController as create} from '../src/rings-now-private-fit-ui-controller.mjs';
class Element {
  constructor(){this.handlers={};this.disabled=false;this.checked=false;this.files=[];this.value='';this.textContent='';this.children=[];}
  addEventListener(name,fn){this.handlers[name]=fn;}
  removeEventListener(name,fn){if(this.handlers[name]===fn)delete this.handlers[name];}
  dispatch(name){return this.handlers[name]?.();}
  replaceChildren(...nodes){this.children=nodes;}
  append(...nodes){this.children.push(...nodes);}
}
const keys=['fileInput','ownerCheckbox','gachiCheckbox','reviewButton','cancelButton','statusNode','lapsNode'];
const fixture=()=>{
 const elements=Object.fromEntries(keys.map(k=>[k,new Element()]));
 const document={createElement:()=>new Element()};
 let context=true;
 const controller=create({elements,document,isContextCurrent:()=>context});
 return {e:elements,controller,context:(v)=>context=v};
};
const bytes=makeSyntheticRaceFit();
const file=()=>({name:'sample.fit',size:bytes.byteLength,arrayBuffer:async()=>bytes.slice(0)});
const consent=e=>{e.ownerCheckbox.checked=true;e.ownerCheckbox.dispatch('change');e.gachiCheckbox.checked=true;e.gachiCheckbox.dispatch('change');};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('the UI requires separate explicit confirmations and shows only unverified reference',async()=>{
 const {e,controller}=fixture();
 e.fileInput.files=[file()];e.fileInput.dispatch('change');
 assert.equal(e.ownerCheckbox.checked,false);
 assert.equal(e.gachiCheckbox.checked,false);
 await e.reviewButton.dispatch('click');
 assert.match(e.statusNode.textContent,/確認が必要/);
 consent(e);
 await e.reviewButton.dispatch('click');
 assert.match(e.statusNode.textContent,/参考候補・未認証/);
 assert.match(e.statusNode.textContent,/自動ポーズ/);
 const rows=e.lapsNode.children[0].children;
 assert.equal(rows.length,5);
 assert.deepEqual(rows.map(r=>r.children[1].textContent),['5:15','5:18','5:20','5:24','5:43']);
 controller.destroy();
});
test('cancel during slow file read leaves no data in the UI',async()=>{
 const {e,controller}=fixture();
 let finish;
 const pending=new Promise(resolve=>{finish=resolve});
 e.fileInput.files=[{name:'sample.fit',size:bytes.byteLength,arrayBuffer:()=>pending}];
 e.fileInput.dispatch('change');consent(e);
 const running=e.reviewButton.dispatch('click');
 assert.equal(e.reviewButton.disabled,true);
 e.cancelButton.dispatch('click');
 finish(bytes.slice(0));await running;
 assert.equal(e.lapsNode.children.length,0);
 assert.match(e.statusNode.textContent,/取り消しました/);
 assert.equal(e.reviewButton.disabled,false);
 controller.destroy();
});
test('file switch cancels old FIT; late response never overwrites new result',async()=>{
 const {e,controller}=fixture();
 let finish;
 const pending=new Promise(resolve=>{finish=resolve});
 e.fileInput.files=[{name:'old.fit',size:bytes.byteLength,arrayBuffer:()=>pending}];
 e.fileInput.dispatch('change');consent(e);
 const running=e.reviewButton.dispatch('click');
 e.fileInput.files=[file()];e.fileInput.dispatch('change');consent(e);
 await e.reviewButton.dispatch('click');
 assert.match(e.statusNode.textContent,/参考候補・未認証/);
 finish(bytes.slice(0));await running;
 assert.match(e.statusNode.textContent,/参考候補・未認証/);
 assert.equal(e.lapsNode.children[0].children.length,5);
 controller.destroy();
});
test('logout/calendar invalidation during parsing prevents output',async()=>{
 const {e,controller,context}=fixture();
 let finish;
 const pending=new Promise(resolve=>{finish=resolve});
 e.fileInput.files=[{name:'sample.fit',size:bytes.byteLength,arrayBuffer:()=>pending}];
 e.fileInput.dispatch('change');consent(e);
 const running=e.reviewButton.dispatch('click');
 context(false);
 controller.invalidate();
 finish(bytes.slice(0));await running;
 assert.equal(e.lapsNode.children.length,0);
 assert.equal(e.ownerCheckbox.checked,false);
 controller.destroy();
});
test('destroy removes callbacks and clears old file without reusing private contents',async()=>{
 const {e,controller}=fixture();
 e.fileInput.files=[file()];e.fileInput.dispatch('change');consent(e);
 await e.reviewButton.dispatch('click');
 controller.destroy();
 assert.equal(e.fileInput.value,'');
 assert.equal(e.lapsNode.children.length,0);
 assert.equal(e.reviewButton.dispatch('click'),undefined);
});
test('no public entrypoints, network, persistence, run auto-link or production unlock',()=>{
 const src=readFileSync(new URL('../src/rings-now-private-fit-ui-controller.mjs',import.meta.url),'utf8');
 const live=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const synthetic=readFileSync(new URL('../previews/rings-now-iphone-synthetic-only-20261114.html',import.meta.url),'utf8');
 for(const s of [live,synthetic])assert.ok(!s.includes('rings-now-private-fit-ui-controller.mjs'));
 assert.match(live,/const RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(live,/const RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
 assert.match(src,/inspectRingsNowPrivateFit/);
 assert.doesNotMatch(src,/\bfetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|sendBeacon|\.from\(['"]runs['"]\)|innerHTML|postMessage|console\.log/);
});
