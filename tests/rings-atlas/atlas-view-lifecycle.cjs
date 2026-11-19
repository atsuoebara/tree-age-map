#!/usr/bin/env node
'use strict';
// Deterministic DOM simulation, no network, credentials, browser or GPS data.
// This exercises the real Atlas script, unlike substring-only contract tests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const script = fs.readFileSync(path.resolve(__dirname, '../../rings-atlas-view.js'), 'utf8');
const ids = ['countryHeading','countryList','regionSection','admin2Section','prefectureSection','citySection'];
const elements = new Map();
const listeners = Object.create(null);
const windowListeners = Object.create(null);
let observer;
let resizeCount = 0;
let focused;
class Node {
  constructor(id) { this.id=id; this.children=[]; this.parentNode=null; this.hidden=false; this.events={}; this.attrs={}; }
  appendChild(child) {
    if (child.parentNode) child.parentNode.children.splice(child.parentNode.children.indexOf(child),1);
    this.children.push(child); child.parentNode=this; return child;
  }
  insertBefore(child, sibling) {
    if (child.parentNode) child.parentNode.children.splice(child.parentNode.children.indexOf(child),1);
    const i=this.children.indexOf(sibling);
    assert(i>=0, 'missing insertion marker');
    this.children.splice(i,0,child); child.parentNode=this; return child;
  }
  addEventListener(kind, cb) {this.events[kind]=cb;}
  setAttribute(k,v) {this.attrs[k]=v;}
  focus() {focused=this.id;}
  scrollIntoView() {}
  click() {assert(this.events.click, 'missing click listener');this.events.click();}
}
for (const id of [...ids,'dashboard','rrAtlasView','rrAtlasHomeEnd','rrAtlasContent','rrAtlasOpen','rrAtlasClose','appRoot']) elements.set(id,new Node(id));
const el = id => elements.get(id);
ids.forEach(id => el('dashboard').appendChild(el(id)));
el('dashboard').appendChild(el('rrAtlasHomeEnd'));
el('rrAtlasView').hidden=true;
// Match the real HTML's initial aria-expanded="false" attribute.
el('rrAtlasOpen').attrs['aria-expanded']='false';
const document = {
  getElementById: el,
  addEventListener(type,callback) {listeners[type]=callback;}
};
const window = {addEventListener(type,callback){windowListeners[type]=callback;}};
const fakeMap = {invalidateSize(options){
  assert.deepEqual(JSON.parse(JSON.stringify(options)),{pan:false,animate:false});
  resizeCount++;
}};
const context = {
  document, window, console, globalMap:fakeMap,
  getComputedStyle(node){return {display:node.hidden?'none':'block'};},
  requestAnimationFrame(callback){callback();},
  MutationObserver:class {
    constructor(cb){this.callback=cb;observer=this;}
    observe(node,opts){assert.equal(node,el('appRoot'));assert(opts.attributeFilter.includes('hidden'));}
  }
};
// The original map is a top-level lexical constant in index.html.
// A later classic/defer script can reference it without creating another map.
vm.runInNewContext('const map = globalMap;\n' + script,context,{filename:'rings-atlas-view.js'});
function assertHome() {
  assert.equal(el('dashboard').hidden,false);
  assert.equal(el('rrAtlasView').hidden,true);
  assert.deepEqual(el('dashboard').children.map(n=>n.id),[...ids,'rrAtlasHomeEnd']);
  assert.deepEqual(el('rrAtlasContent').children,[]);
  assert.equal(el('rrAtlasOpen').attrs['aria-expanded'],'false');
}
function assertAtlas() {
  assert.equal(el('dashboard').hidden,true);
  assert.equal(el('rrAtlasView').hidden,false);
  assert.deepEqual(el('rrAtlasContent').children.map(n=>n.id),ids);
  assert.equal(el('rrAtlasOpen').attrs['aria-expanded'],'true');
}
assertHome();
el('rrAtlasOpen').click(); assertAtlas();
assert.equal(focused,'rrAtlasClose');assert.equal(resizeCount,1);
el('rrAtlasClose').click();assertHome();
assert.equal(focused,'rrAtlasOpen');assert.equal(resizeCount,2);
el('rrAtlasOpen').click(); assertAtlas();
listeners.keydown({key:'Escape',preventDefault(){this.prevented=true;}});
assertHome();
el('rrAtlasOpen').click();assertAtlas();
windowListeners.pageshow({persisted:true});assertHome();
el('rrAtlasOpen').click();assertAtlas();
el('appRoot').hidden=true;observer.callback();assertHome();
el('rrAtlasOpen').click();assertHome(); // logged-out users cannot reopen
assert.equal(resizeCount,8, 'all six view transitions should invalidate Leaflet once');
// Identity: all six nodes remain the original objects, not copies.
for(const id of ids)assert.equal(el(id),elements.get(id));
console.log('PASS: Atlas open/close, Escape, bfcache, logout, identity, and Leaflet refresh');
