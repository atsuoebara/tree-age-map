#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const map=html.indexOf('<div id="map"></div>');
const panel=html.indexOf('<details id="rrMapGuideGroup"');
const photos=html.indexOf('<section id="mapPhotosPanel"');
assert(map>=0&&panel>map&&photos>panel,'group belongs between map and photos');
const group=html.slice(panel,photos);
assert.equal((html.match(/id="rrMapGuideGroup"/g)||[]).length,1);
for(const id of ['mapDisplayHelp','mapPrivacyNotice','rainbowLegend']){
 assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id+' preserved');
 assert(group.includes('id="'+id+'"'),id+' inside map group');
}
assert(group.includes('class="mapBoundaryNotice"'),'boundary text retained');
assert(group.includes('faq.html#map-boundaries'),'boundary FAQ retained');
assert(group.includes('data-boundary-lang="en"'),'boundary English retained');
assert(group.includes('rainbowLegendItems'),'rainbow guide retained');
assert(group.includes('ご自身で共有しない限り'),'privacy explanation retained');
assert(html.includes("if(id==='mapPrivacyNotice'&&disclosure.open){document.getElementById('rrMapGuideGroup')?.setAttribute('open','');}"),'first visit opens containing group when privacy open');
assert(html.includes("localStorage.getItem(key)!=='1'"),'existing first-visit privacy rule retained');
assert(html.includes('html.rrAtlasEmbedded #appRoot > :not(#mapPeriodControls)'), 'Atlas embedded whitelist preserved');
const app=html.match(/const APP_BUILD = '([^']+)'/),worker=sw.match(/const RR_BUILD = '([^']+)'/);
assert(app&&worker);assert.equal(app[1],worker[1]);
console.log('PASS: grouped map notes, privacy first-visit opening, Atlas and bilingual notes preserved');
