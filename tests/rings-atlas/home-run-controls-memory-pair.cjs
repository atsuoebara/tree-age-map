#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const engagement=fs.readFileSync(path.join(root,'rr-engagement.js'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const account=html.slice(html.indexOf('<div id="accountBar">'),html.indexOf('<a id="rrAtlasJumpToRegions"'));
const importArea=html.slice(html.indexOf('<div id="importArea">'),html.indexOf('id="syncInfo"'));
assert(account.includes('id="addRunButton"'));
assert(account.includes('id="rrRunManageActions"'));
for(const id of ['savedRunsButton','cloudRunsButton']){
 assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id+' must exist only once');
 assert(account.includes('id="'+id+'"'),id+' must be near add-run');
 assert(!importArea.includes('id="'+id+'"'),id+' must no longer occupy lower controls');
}
assert(account.indexOf('id="addRunButton"') < account.indexOf('id="rrRunManageActions"'),'manage buttons follow add button');
assert(importArea.includes('id="myTodayShareLink"'),'progress card host retained');
assert(html.includes('#accountBar #rrRunManageActions'),'responsive toolbar style');
assert(engagement.includes("progressPair.id='rrProgressPair'"));
assert(engagement.includes('progressPair.appendChild(card)'));
assert(engagement.includes('progressPair.appendChild(anniversary)'));
assert(engagement.includes('#rrProgressPair:has(> #rrYearAgoToday:not([hidden])) {\n    grid-template-columns:repeat(2,minmax(0,1fr));'),'side-by-side when both cards are visible, including iPhone');
assert(engagement.includes('@media (max-width:520px)'),'compact mobile layout');
assert(html.includes('rr-engagement.js?v=20261119-summary-pair-01'),'mobile Safari uses current layout asset');
const appBuild=html.match(/const APP_BUILD = '([^']+)'/);
const swBuild=sw.match(/const RR_BUILD = '([^']+)'/);
assert(appBuild && swBuild,'both build labels must exist');
assert.equal(appBuild[1],swBuild[1],'APP_BUILD/RR_BUILD must match');
assert(!engagement.includes("progressPair.style.cssText='display:grid;grid-template-columns:"),
 'mobile two-column stylesheet must not be shadowed by an inline column rule');
console.log('PASS: paired memory cards on mobile and unique run controls adjacent to add-run, preserving functionality');
