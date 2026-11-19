#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const script=fs.readFileSync(path.resolve(__dirname,'../../rings-atlas-view.js'),'utf8');
const ids=['countryHeading','countryList','regionSection','admin2Section','prefectureSection','citySection'];
const elements=new Map(),eventListeners={},windowListeners={};
let observer,resize=0,reloads=0;
class Node {
  constructor(id){this.id=id;this.hidden=false;this.parentNode=null;this.children=[];this.attrs={};this.events={};}
  appendChild(node){if(node.parentNode)node.parentNode.children.splice(node.parentNode.children.indexOf(node),1);this.children.push(node);node.parentNode=this;}
  insertBefore(node,anchor){if(node.parentNode)node.parentNode.children.splice(node.parentNode.children.indexOf(node),1);const i=this.children.indexOf(anchor);assert(i>=0);this.children.splice(i,0,node);node.parentNode=this;}
  setAttribute(k,v){this.attrs[k]=v;}
  addEventListener(k,fn){this.events[k]=fn;}
  click(){assert(this.events.click);this.events.click();}
  scrollIntoView(){}
  focus(){}
}
for(const id of [...ids,'dashboard','rrAtlasView','rrAtlasHomeEnd','rrAtlasContent','rrAtlasOpen','rrAtlasClose','appRoot'])elements.set(id,new Node(id));
const el=id=>elements.get(id);
ids.forEach(id=>el('dashboard').appendChild(el(id)));
el('dashboard').appendChild(el('rrAtlasHomeEnd'));
el('rrAtlasView').hidden=true;
el('appRoot').hidden=true;
const document={getElementById:el,documentElement:{classList:{contains:k=>k==='rrAtlasEmbedded'}},addEventListener(k,fn){eventListeners[k]=fn;}};
const window={addEventListener(k,fn){windowListeners[k]=fn;},location:{reload(){reloads++;}}};
const globals={document,window,console,getComputedStyle(node){return {display:node.hidden?'none':'block'};},
  requestAnimationFrame(fn){fn();},mapStub:{invalidateSize(o){assert.deepEqual(JSON.parse(JSON.stringify(o)),{pan:false,animate:false});resize++;}},
  MutationObserver:class{constructor(fn){observer=fn;}observe(node,o){assert.equal(node,el('appRoot'));assert(o.attributeFilter.includes('style'));}}};
vm.runInNewContext('const map=mapStub;\n'+script,globals);
assert.equal(el('rrAtlasView').hidden,true,'logged-out private Atlas must stay hidden');
el('appRoot').hidden=false;observer();
assert.equal(el('rrAtlasView').hidden,false,'sign-in must auto-open Atlas');
assert.equal(el('dashboard').hidden,true);
assert.deepEqual(el('rrAtlasContent').children.map(n=>n.id),ids);
assert.equal(resize,1);
el('appRoot').hidden=true;observer();
assert.equal(el('rrAtlasView').hidden,true,'logout must hide Atlas');
assert.deepEqual(el('dashboard').children.map(n=>n.id),[...ids,'rrAtlasHomeEnd']);
el('appRoot').hidden=false;observer();
assert.equal(el('rrAtlasView').hidden,false,'re-authentication must auto-open Atlas');
windowListeners.pageshow({persisted:true});
assert.equal(reloads,1,'restored frame must reload canonical auth state');
assert.equal(el('rrAtlasView').hidden,true,'stale regional details cannot remain shown');
console.log('PASS: embedded Atlas sign-in, single region DOM, logout, re-login and bfcache reload');
