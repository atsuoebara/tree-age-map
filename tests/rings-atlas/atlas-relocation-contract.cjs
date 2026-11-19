#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const path=require('node:path');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const js=fs.readFileSync(path.resolve(__dirname,'../../rings-atlas-view.js'),'utf8');
const ids=['countryHeading','countryList','regionSection','admin2Section','prefectureSection','citySection'];
for(const id of ids){
 assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id+' duplicated');
 assert(js.includes("'"+id+"'"),id+' missing in view wiring');
}
for(const id of ['rrAtlasOpen','rrAtlasClose','rrAtlasContent','rrAtlasView','rrAtlasHomeEnd']){
 assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id+' missing/duplicated');
}
assert(html.includes('src="./rings-atlas-view.js'));
assert(html.indexOf('id="rrAtlasHomeEnd"')>html.indexOf('id="citySection"'));
assert(html.indexOf('id="rrAtlasView"')>html.indexOf('id="rrAtlasHomeEnd"'));
assert(js.includes('content.appendChild(node)'));
assert(js.includes('slot.parentNode.insertBefore(node,slot)'));
assert(js.includes("event.persisted"));
assert(js.includes('MutationObserver'));
assert(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|supabaseClient/.test(js));
assert(!/\.cloneNode\s*\(/.test(js));
console.log('PASS: six existing region nodes reused, no duplicate IDs, no new data IO, reversible home/atlas view');
