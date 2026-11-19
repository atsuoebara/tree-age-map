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
const sections={prefectureSection:{open:false},citySection:{open:false}};
const document={
 documentElement:{classList:{contains(v){return v==='rrAtlasEmbedded';}}},
 getElementById(id){return sections[id]||null;}
};
vm.runInNewContext(js,{document});
assert.equal(sections.prefectureSection.open,true);
assert.equal(sections.citySection.open,true);
const nonEmbedded={
 documentElement:{classList:{contains(){return false;}}},
 getElementById(id){return sections[id]||null;}
};
sections.prefectureSection.open=false;sections.citySection.open=false;
vm.runInNewContext(js,{document:nonEmbedded});
assert.equal(sections.prefectureSection.open,false,'home must remain unchanged');
assert.equal(sections.citySection.open,false,'home must remain unchanged');
console.log('PASS: Atlas sticky return header + footer links, 240px map, both sections open and 5 city rows; home unchanged');
