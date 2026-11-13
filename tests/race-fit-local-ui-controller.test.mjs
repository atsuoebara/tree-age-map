// Synthetic DOM+File mock executes the ACTUAL inline mobile controller with controlled promises.
// No browser, network, real FIT data, storage, or production import.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../previews/ima-wo-shirou-fit-local-file-draft-20261113.html',import.meta.url),'utf8');
const inline=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(inline,'inline controller must be present');
assert.ok(inline.includes("import {reviewSingleUserFitBuffer} from '../src/race-fit-local-file-review.mjs';"));
const code=inline.replace("import {reviewSingleUserFitBuffer} from '../src/race-fit-local-file-review.mjs';",'');
class FakeElement{
 constructor(){this.textContent='';this.className='';this.children=[];this.handlers={};this.checked=false;this.disabled=false;this.files=[];}
 addEventListener(event,callback){this.handlers[event]=callback;}
 dispatch(event){return this.handlers[event]?.();}
 replaceChildren(...children){this.children=children;}
 append(...children){this.children.push(...children);}
}
const elements=Object.fromEntries(['fit','owner','race','review','status','distance','laps','flags'].map(id=>[id,new FakeElement()]));
const document={getElementById:id=>{if(!elements[id])throw Error('missing '+id);return elements[id];},createElement:()=>new FakeElement()};
const calls=[];
const calculate=(buffer,confirmation)=>{
 calls.push({buffer,confirmation});
 return {status:'candidate_unverified',distanceM:2000,clockElapsedS:600,segments:[{index:1,clockElapsedS:300},{index:2,clockElapsedS:300}],flags:[]};
};
vm.runInNewContext(code,{document,reviewSingleUserFitBuffer:calculate,Math,String},{timeout:2000});
const e=id=>elements[id],tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{
 let resolve,reject;
 const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
 return {promise,resolve,reject};
};
const file=(name,byteLength=128,wait)=>{
 const f={name,size:byteLength,arrayBuffer:()=>wait?wait.promise:Promise.resolve(new ArrayBuffer(byteLength))};
 return f;
};
e('owner').checked=true;e('race').checked=true;
const old=deferred(),newFile=file('later.fit');
e('fit').files=[file('first.fit',128,old)];
const first=e('review').dispatch('click');
assert.equal(e('review').disabled,true);
assert.equal(e('status').textContent,'端末内で確認中…');
assert.equal(await e('review').dispatch('click'),undefined,'second click ignored');
assert.equal(calls.length,0,'wait for file bytes');
e('fit').files=[newFile];e('fit').dispatch('change');
assert.equal(e('status').textContent,'未解析です','changing file clears old status');
old.resolve(new ArrayBuffer(128));await first;
assert.equal(calls.length,0,'old file must not be decoded');
assert.equal(e('laps').children.length,0,'old file cannot draw new result');
assert.equal(e('review').disabled,false);
await e('review').dispatch('click');
assert.equal(calls.length,1,'new file decoded once');
assert.equal(e('status').textContent,'参考候補・未認証（正式な分析結果ではありません）');
assert.equal(e('laps').children.length,1);
assert.equal(calls[0].confirmation.confirmedOwner,true);
e('owner').checked=false;e('owner').dispatch('change');
assert.equal(e('laps').children.length,0,'changing consent clears displayed split');
await e('review').dispatch('click');
assert.equal(calls.length,1,'missing consent cannot read file');
assert.match(e('status').textContent,/本人確認/);
e('owner').checked=true;e('owner').dispatch('change');
const failed=deferred();e('fit').files=[file('broken.fit',128,failed)];
const promise=e('review').dispatch('click');failed.reject(new Error('synthetic read failure'));await promise;
assert.match(e('status').textContent,/問題が発生/);
assert.equal(e('review').disabled,false,'read failure unlocks button');
e('fit').files=[file('archive.zip')];e('fit').dispatch('change');
await e('review').dispatch('click');
assert.match(e('status').textContent,/ZIP/);
assert.equal(calls.length,1);
console.log('FIT mobile inline controller dynamic mock PASS: stale selection, double tap, consent reset, read errors, ZIP rejection, no real file');
