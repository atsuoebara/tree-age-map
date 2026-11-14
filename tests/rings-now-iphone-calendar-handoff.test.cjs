'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const root=join(__dirname,'..');
const live=readFileSync(join(root,'index.html'),'utf8');
const preview=readFileSync(join(root,'previews/rings-now-iphone-synthetic-only-20261114.html'),'utf8');
const adapter=readFileSync(join(root,'src/ima-wo-shirou-calendar-selection-review.mjs'),'utf8');
const localReview=readFileSync(join(root,'src/race-fit-local-file-review.mjs'),'utf8');
test('keep the existing calendar route and all individual choices',()=>{
 assert.match(live,/b\.onclick=\(\)=>focusCloudRun\(row\)/);
 assert.match(live,/runs\.length>1/);
 assert.match(live,/const RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(live,/const RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
});
test('calendar selection must validate owner, started_at and eight-day window without authorizing diagnosis',()=>{
 assert.match(adapter,/String\(currentUserId\)!==String\(row\.user_id\)/);
 assert.match(adapter,/utcStart\(row\.started_at\)/);
 assert.match(adapter,/maxAgeSeconds:EIGHT_DAYS_SECONDS/);
 assert.match(adapter,/selectedAsGachiRun=false/);
 assert.match(adapter,/analysisAllowed:false/);
 assert.doesNotMatch(adapter,/reviewSingleUserFitBuffer|fetch\s*\(|localStorage|sessionStorage/);
});
test('synthetic iPhone demo must stay gated and separate from saved runs',()=>{
 assert.match(preview,/Rings Now/);
 assert.match(preview,/NOW × KNOW/);
 assert.match(preview,/if\(digest!==EXPECTED_SHA256\)/);
 assert.match(preview,/readSingleUserFitBuffer|reviewSingleUserFitBuffer/);
 assert.match(preview,/合成FIT以外は読み取りできません/);
 assert.doesNotMatch(preview,/\.from\(['"]runs['"]\)|\.insert\(|\.update\(|localStorage|indexedDB/);
 assert.match(localReview,/qualityCertified:false,analysisAllowed:false/);
 assert.match(localReview,/writeAllowed:false,providerDataCombined:false/);
});
