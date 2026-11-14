'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const root=join(__dirname,'..');
const html=readFileSync(join(root,'previews/ima-wo-shirou-fit-local-file-draft-20261113.html'),'utf8');
const core=readFileSync(join(root,'src/race-fit-local-file-review.mjs'),'utf8');
const live=readFileSync(join(root,'index.html'),'utf8');
test('existing local FIT picker uses mobile-supported browser File API; no PC-only browser calls',()=>{
 assert.match(html,/name="viewport" content="width=device-width,initial-scale=1"/);
 assert.match(html,/<input id="fit" type="file" accept="\.fit,application\/octet-stream">/);
 assert.match(html,/const buffer=await file\.arrayBuffer\(\)/);
 assert.match(html,/file\.size>16\*1024\*1024/);
 assert.match(html,/\.files\?\.\[0\]!==file/);
 assert.doesNotMatch(html,/showOpenFilePicker|window\.showDirectoryPicker|ActiveXObject|Electron|node:fs/);
});
test('FIT is a local unverified candidate only, without saving or network transport',()=>{
 assert.match(core,/qualityCertified:false,analysisAllowed:false/);
 assert.match(core,/writeAllowed:false,providerDataCombined:false/);
 assert.match(html,/参考候補・未認証/);
 assert.match(html,/信号待ちやトイレ休憩、自動ポーズなどの影響により、正しく分析できない場合があります。/);
 for(const source of [html,core]){
  for(const p of [/\bfetch\s*\(/,/XMLHttpRequest/,/WebSocket/,/indexedDB/,/localStorage/,/sessionStorage/,/sendBeacon/,/navigator\.share\s*\(/,/\bFormData\s*\(/])
   assert.doesNotMatch(source,p);
 }
 assert.match(html,/type="button" disabled/);
});
test('live calendar entry stays hard-disabled pending iPhone real-device audit',()=>{
 assert.match(live,/const RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(live,/const RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
});
