#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const page=fs.readFileSync(path.join(root,'rings-atlas.html'),'utf8');
const script=fs.readFileSync(path.join(root,'rings-atlas-prefecture-preview.js'),'utf8');
assert.match(html,/html\.rrAtlasEmbedded #rrGlobalNavigation,/);
assert.match(html,/html\.rrAtlasEmbedded #rrGlobalFooter,/);
assert.match(html,/html\.rrAtlasEmbedded #siteFooter,/);
assert.match(html,/html\.rrAtlasEmbedded body > #scrollToTopButton \{ display:none !important; \}/);
assert.match(html,/#prefectureList\.rrAtlasPreviewLimited > \.prefectureCard:nth-child\(n\+6\)/);
assert.match(page,/id="rrAtlasAppFrame"/);
assert.match(page,/src="\.\/index\.html\?atlas=embedded"/);
assert.match(page,/new ResizeObserver\(schedule\)\.observe\(child\.body\)/);
assert.match(page,/new MutationObserver\(schedule\)\.observe\(child\.body/);
assert.match(page,/child\.body\.scrollHeight/);
assert.match(page,/frame\.scrolling = 'no'/);
assert.doesNotMatch(page,/postMessage|createClient|fetch\s*\(/);
assert.doesNotMatch(script,/fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|cloneNode|postMessage/);
let count=0, toggled=false, observerFns=[];
const classes=new Set(),events={};
const list={classList:{toggle(name,on){toggled=on;if(on)classes.add(name);else classes.delete(name);}},
  querySelectorAll(sel){assert.equal(sel,':scope > .prefectureCard');return Array.from({length:count});}};
const section={appendChild(node){this.button=node;},open:false};
const document={
  documentElement:{lang:'ja',classList:{contains(s){return s==='rrAtlasEmbedded';}}},
  getElementById(id){return id==='prefectureSection'?section:id==='prefectureList'?list:null;},
  createElement(tag){assert.equal(tag,'button');return {hidden:false,attributes:{},
    setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,fn){events[k]=fn;}};}
};
class Observer {constructor(fn){observerFns.push(fn);} observe(){}}
vm.runInNewContext(script,{document,MutationObserver:Observer,console});
assert.equal(section.open,true,'prefecture list should open by default');
assert.equal(section.button.hidden,true,'no more button during loading');
count=8;observerFns[0]();
assert.equal(toggled,true,'only five cards should be shown at first');
assert.equal(section.button.hidden,false);
assert.match(section.button.textContent,/8件/);
assert.equal(section.button.attributes['aria-expanded'],'false');
events.click();
assert.equal(toggled,false,'show all should reveal all existing cards');
assert.equal(section.button.attributes['aria-expanded'],'true');
events.click();
assert.equal(toggled,true,'can collapse to first five');
count=4;observerFns[0]();
assert.equal(toggled,false,'4-card set must show all');
assert.equal(section.button.hidden,true,'show-more button hidden below six');
count=7;document.documentElement.lang='en';observerFns[1]();
assert.match(section.button.textContent,/Show all regions \(7\)/);
console.log('PASS: Atlas iframe-only clean shell, outer-page sizing, five default prefectures and show all');
