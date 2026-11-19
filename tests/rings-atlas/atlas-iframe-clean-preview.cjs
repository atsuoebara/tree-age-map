#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const page=fs.readFileSync(path.join(root,'rings-atlas.html'),'utf8');
const js=fs.readFileSync(path.join(root,'rings-atlas-prefecture-preview.js'),'utf8');
const assertContains=(s,part)=>assert(s.includes(part),'Missing: '+part);
for(const part of ['html.rrAtlasEmbedded #rrGlobalNavigation,','html.rrAtlasEmbedded #rrGlobalFooter,','html.rrAtlasEmbedded #siteFooter,'])assertContains(html,part);
assertContains(html,'html.rrAtlasEmbedded body:not(.mapFullscreenActive) #map');
assertContains(html,'height:240px !important; min-height:240px !important; max-height:240px !important');
assertContains(html,"document.documentElement.classList.contains('rrAtlasEmbedded') ? 5 : 10");
assertContains(html,'id="rrAtlasJumpToRegions"');
assertContains(html,':not(#rrAtlasJumpToRegions)');
assertContains(page,'position:sticky;top:0;z-index:500');
assertContains(page,'class="atlasFooterReturn" href="./index.html"');
assertContains(page,'href="./journal.html"');
assertContains(page,'href="./ranking.html"');
assertContains(page,'src="./index.html?atlas=embedded"');
assertContains(page,'child.body.scrollHeight');
assertContains(page,'frame.scrolling = \'no\'');
assert.doesNotMatch(page,/postMessage|createClient|fetch\s*\(/);
assert.doesNotMatch(js,/fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|cloneNode|postMessage/);
const observers=[], events={}, viewport={};
const sections={
  prefectureSection:{open:false,isConnected:true},
  citySection:{open:false,isConnected:true},
  rrAtlasView:{hidden:true,isConnected:true},
  appRoot:{hidden:false,isConnected:true}
};
const obsolete={removed:false,remove(){this.removed=true;}};
let hasObsolete=true;
const document={
 documentElement:{classList:{contains(v){return v==='rrAtlasEmbedded';}}},
 getElementById(id){
   if(id==='rrAtlasShowMorePrefectures') return hasObsolete ? obsolete : null;
   return sections[id] || null;
 }
};
class MutationObserver {
  constructor(callback){observers.push(callback);}
  observe(node,opts){assert(node);assert(opts);}
}
const requestAnimationFrame=callback=>callback();
const window={addEventListener(name,callback){events[name]=callback;}};
vm.runInNewContext(js,{document,MutationObserver,requestAnimationFrame,window});
assert.equal(sections.prefectureSection.open,false,'private sections stay closed until Atlas is visible');
sections.rrAtlasView.hidden=false;
observers[1]();
assert.equal(sections.prefectureSection.open,true);
assert.equal(sections.citySection.open,true);
assert.equal(obsolete.removed,true,'old duplicate button removed');
hasObsolete=false;
// Simulate period rebuild/reparent: the same details are closed while cards change.
sections.prefectureSection.open=false;
sections.citySection.open=false;
observers[0]();
assert.equal(sections.prefectureSection.open,true,'prefecture list is reopened after redraw');
assert.equal(sections.citySection.open,true,'municipality list is reopened after redraw');
sections.appRoot.hidden=true;
sections.citySection.open=false;
observers[0]();
assert.equal(sections.citySection.open,false,'signed-out private view remains protected');
const nonEmbedded={
 documentElement:{classList:{contains(){return false;}}},
 getElementById(id){return sections[id]||null;}
};
sections.prefectureSection.open=false;sections.citySection.open=false;
vm.runInNewContext(js,{document:nonEmbedded});
assert.equal(sections.prefectureSection.open,false,'home must remain unchanged');
assert.equal(sections.citySection.open,false,'home must remain unchanged');
assertContains(html,'rings-atlas-prefecture-preview.js?v=20261119-10');
assertContains(html,'html.rrAtlasEmbedded #rrAtlasShowMorePrefectures { display:none !important; }');
console.log('PASS: Atlas sticky header/footer, 240px map, city and prefecture reopened after redraw, no duplicate toggle; home unchanged');
