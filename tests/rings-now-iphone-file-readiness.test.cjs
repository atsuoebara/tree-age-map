'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const root=join(__dirname,'..');
const retired=readFileSync(join(root,'previews/ima-wo-shirou-fit-local-file-draft-20261113.html'),'utf8');
const synthetic=readFileSync(join(root,'previews/rings-now-iphone-synthetic-only-20261114.html'),'utf8');
const core=readFileSync(join(root,'src/race-fit-local-file-review.mjs'),'utf8');
const live=readFileSync(join(root,'index.html'),'utf8');
test('former real FIT public preview is inert',()=>{
 assert.match(retired,/旧FIT試作ページは終了しました/);
 assert.match(retired,/script-src 'none'/);
 assert.match(retired,/connect-src 'none'/);
 for(const p of [/<script\b/i,/<input\b/i,/<form\b/i,/reviewSingleUserFitBuffer/,/\.arrayBuffer\s*\(/,/\bfetch\s*\(/,/localStorage/,/sessionStorage/])
  assert.doesNotMatch(retired,p);
});
test('synthetic-only iPhone preview still uses File API and digest gate',()=>{
 assert.match(synthetic,/<input id="fit" type="file"/);
 assert.match(synthetic,/file\.arrayBuffer\(\)/);
 assert.match(synthetic,/digest!==EXPECTED_SHA256/);
 assert.match(core,/qualityCertified:false,analysisAllowed:false/);
 assert.match(core,/writeAllowed:false,providerDataCombined:false/);
});
test('production calendar remains OFF and rollout start unset',()=>{
 assert.match(live,/const RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(live,/const RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
});
