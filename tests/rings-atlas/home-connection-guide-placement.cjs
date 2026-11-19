#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const menuStart=html.indexOf('<details id="rrDataConnectionMenu">');
const addRun=html.indexOf('<label id="addRunButton"');
const guide=html.indexOf('<details id="dataSetupGuide"');
const auth=html.indexOf('<details class="setupGuide setupGuideAuth" id="authImportGuide">');
assert(menuStart>=0&&guide>menuStart&&guide<addRun,'signed-in guide is nested in connection menu');
assert(auth>=0&&auth<menuStart,'public logged-out guide is retained');
assert.equal((html.match(/id="dataSetupGuide"/g)||[]).length,1);
assert.equal((html.match(/id="rrDataConnectionMenu"/g)||[]).length,1);
for(const id of ['stravaConnectButton','corosConnectButton','garminShortcutButton','intervalsImportButton']){
  assert(html.slice(menuStart,guide).includes('id="'+id+'"'),'connection action intact: '+id);
}
assert(html.slice(guide,addRun).includes('data-import-share-panel'),'existing signed-in import stats retained');
assert(html.slice(guide,addRun).includes('intervals-guide-03.png.png'),'Intervals guide intact');
assert(html.includes("document.getElementById(\n        'dataSetupGuide'"),'existing guide behavior reference intact');
const a=html.match(/const APP_BUILD = '([^']+)'/);
const b=sw.match(/const RR_BUILD = '([^']+)'/);
assert(a&&b);
assert.equal(a[1],b[1],'build identifiers match');
console.log('PASS: signed-in connection help consolidated; public guide and interactions retained');
