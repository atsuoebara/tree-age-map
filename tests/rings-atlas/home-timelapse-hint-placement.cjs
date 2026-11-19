#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const launch=html.indexOf('<div id="timelapseLaunchArea">');
const panel=html.indexOf('<section id="timelapsePanel"');
const dashboard=html.indexOf('<section id="dashboard">');
assert(launch>=0&&panel>launch&&dashboard>panel);
const launchHtml=html.slice(launch,panel),panelHtml=html.slice(panel,dashboard);
assert(launchHtml.includes('id="timelapseOpenButton"'),'open button remains available');
assert(launchHtml.includes('class="timelapseFaqLink" href="./faq.html#faq-video"'),'Q&A remains visible at launcher');
assert(!launchHtml.includes('class="timelapseLaunchHint"'),'long hint no longer crowds launcher');
assert(panelHtml.includes('class="timelapseLaunchHint"'),'hint moved inside settings panel');
assert(panelHtml.includes('期間動画は選んだ期間の記録を積み上げ、月の振り返りはランニング1回ごとに振り返ります。'));
assert.equal((html.match(/class="timelapseLaunchHint"/g)||[]).length,1,'same hint exactly once');
for(const id of ['timelapseOpenButton','timelapseStartMonth','timelapseEndMonth','timelapseGenerateButton','timelapseMonthlyReviewButton','timelapseCloseButton','timelapsePreview']){
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,'existing video control remains once: '+id);
}
assert(html.includes('#timelapsePanel.isOpen'),'panel reveal behavior remains');
assert(html.includes('id="authImportGuide"'),'public onboarding preserved');
const a=html.match(/const APP_BUILD = '([^']+)'/),b=sw.match(/const RR_BUILD = '([^']+)'/);
assert(a&&b);assert.equal(a[1],b[1]);
console.log('PASS: Timelapse hint within panel; FAQ, video controls and public guidance preserved');
