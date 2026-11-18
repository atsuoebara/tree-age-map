// Node built-in-only behavioral checks for the isolated Garmin split UI preview.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const src = fs.readFileSync('previews/garmin-race-splits-20261109.html','utf8');
const script = src.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'one embedded preview script required');
assert.doesNotMatch(script,/\bfetch\s*\(|\bXMLHttpRequest\b|\blocalStorage\b|\bsessionStorage\b|\bsendBeacon\s*\(/,'no network or browser storage calls');
assert.doesNotMatch(src,/<script\s+src=|<iframe|<form\b/i,'no external script, iframe or form');
class FakeNode {
  constructor(tag='div'){this.tag=tag;this.children=[];this.textContent='';this.className='';this.dataset={};this.listeners={};}
  append(...items){this.children.push(...items);}
  replaceChildren(...items){this.children=[...items];}
  addEventListener(type,callback){this.listeners[type]=callback;}
}
const nodes={lang:new FakeNode('button'),segments:new FakeNode('section')};
const staticKeys=[...src.matchAll(/data-i="([a-z]+)"/g)].map(match=>match[1]);
assert.ok(staticKeys.includes('title') && staticKeys.includes('privacy') && staticKeys.includes('footer'));
const staticNodes=staticKeys.map(key=>{const node=new FakeNode();node.dataset.i=key;return node;});
const staticText=(key)=>staticNodes.find(node=>node.dataset.i===key).textContent;
const el={lang:'ja'};
const document={
  documentElement:el,
  createElement:(tag)=>new FakeNode(tag),
  getElementById:(id)=>nodes[id] ?? null,
  querySelectorAll:(selector)=>selector==='[data-i]'?staticNodes:[]
};
const context=vm.createContext({document});
vm.runInContext(script,context,{timeout:1000});
const cards=()=>nodes.segments.children;
const cells=(i)=>cards()[i].children[1].children;
const childText=(node)=>node.children.map(c=>c.textContent);
assert.equal(staticText('title'),'Garminの1kmごとの解析');
assert.match(staticText('privacy'),/本人だけが閲覧/);
assert.match(staticText('quality'),/同一時刻または同一距離/);
assert.match(staticText('footer'),/本番画面ではありません/);
assert.equal(cards().length,4,'three full km and one 0.42km segment');
assert.equal(cards()[3].children[0].children[0].textContent,'端数区間 · 0.42 km');
assert.equal(cards()[3].children[0].children[1].textContent,'03:08');
assert.equal(cells(0)[1].children[1].textContent,'88','raw cadence is not doubled');
assert.equal(cells(2)[2].children[1].textContent,'0','0 W preserved as valid zero');
assert.equal(cells(2)[2].children.length,3,'0 W has no coverage label');
assert.equal(cells(1)[0].children.length,3,'healthy coverage 98% is hidden');
assert.equal(cells(2)[0].children[1].textContent,'データ不足');
assert.equal(cells(2)[0].children[2].textContent,'計測範囲: 75%');
assert.equal(cells(3)[1].children[2].textContent,'計測範囲: 62%');
assert.equal(cells(3)[2].children[2].textContent,'計測範囲: 43%');
assert.equal(cells(0)[1].children[0].textContent,'平均ピッチ（Garmin値）');
nodes.lang.listeners.click();
assert.equal(el.lang,'en');
assert.equal(staticText('title'),'Garmin 1 km split analysis');
assert.match(staticText('privacy'),/Only you can view/);
assert.match(staticText('quality'),/timestamp or distance/);
assert.match(staticText('footer'),/not a production screen/);
assert.match(staticText('missinghelp'),/less than 80%/);
assert.equal(cells(2)[0].children[1].textContent,'Insufficient data');
assert.equal(cells(2)[0].children[2].textContent,'Coverage: 75%');
assert.equal(cells(0)[1].children[0].textContent,'Average cadence (Garmin)');
assert.equal(cells(0)[1].children[1].textContent,'88');
assert.equal(cells(2)[2].children[1].textContent,'0');
assert.equal(cells(3)[0].children[0].textContent,'Average HR');
assert.equal(cells(3)[0].children.length,3,'healthy 100% coverage hidden in English');
nodes.lang.listeners.click();
assert.equal(el.lang,'ja','language toggle restores Japanese');
assert.equal(staticText('title'),'Garminの1kmごとの解析');
assert.match(staticText('privacy'),/本人だけが閲覧/);
assert.match(staticText('missinghelp'),/80%未満/);
console.log('PASS: isolated preview DOM, JA/EN static copy, missing-only coverage, valid zero, cadence, partial segment, no network');
