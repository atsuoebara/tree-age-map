#!/usr/bin/env node
'use strict';
const fs=require('node:fs'), assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const tile=html.indexOf('<div class="rrFeatureTiles"');
const map=html.indexOf('<div id="map"></div>');
const photo=html.indexOf('<section id="mapPhotosPanel"');
const cards=html.indexOf('<details id="conquestCardCollection">');
const settings=html.indexOf('<details id="accountPanel"');
const importArea=html.indexOf('<div id="importArea">');
const timelapse=html.indexOf('<div id="timelapseLaunchArea">');
const dashboard=html.indexOf('<section id="dashboard">');
assert([tile,map,photo,cards,settings,importArea,timelapse,dashboard].every(x=>x>=0),'all landmarks exist');
assert(map<photo&&photo<cards&&cards<tile&&tile<settings&&settings<importArea&&importArea<timelapse&&timelapse<dashboard,'feature navigation follows map achievements before settings');
assert.equal((html.match(/class="rrFeatureTiles"/g)||[]).length,1,'one feature tile group');
const tiles=html.slice(tile,settings);
for(const u of ['./journal.html','./ranking.html','./territory.html','./today.html','./rings-atlas.html','./gps-art.html','./rings-people.html','./ring-tools.html']){
 assert(tiles.includes('href="'+u+'"'),'feature preserved '+u);
}
assert(html.includes('#appRoot .rrFeatureTiles'),'feature styles apply after relocation');
assert(!html.includes('#dashboard .rrFeatureTiles'),'no dashboard-only styling');
assert(html.includes('id="authImportGuide"'),'public setup guidance unchanged');
assert(html.includes('<div class="authPublicLinks"')||html.includes('class="authPublicLinks"'),'public discovery links retained');
assert(html.includes('<div class="rrAtlasEntry">'),'Atlas node retained');
assert(html.includes('#appRoot:has(> #rrAtlasView:not([hidden])) > .rrFeatureTiles { display:none !important; }'),'Atlas details hide relocated feature tiles');
const a=html.match(/const APP_BUILD = '([^']+)'/),b=sw.match(/const RR_BUILD = '([^']+)'/);
assert(a&&b);assert.equal(a[1],b[1]);
console.log('PASS: feature links moved nearer map; private controls, Atlas, public discovery preserved');
