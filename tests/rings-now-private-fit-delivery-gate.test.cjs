'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const root=join(__dirname,'..');
const source=path=>readFileSync(join(root,path),'utf8');
const html=source('index.html');
const sw=source('sw.js');
const synthetic=source('previews/rings-now-iphone-synthetic-only-20261114.html');
const oldPreview=source('previews/ima-wo-shirou-fit-local-file-draft-20261113.html');
const input=source('src/rings-now-private-fit-input-gate.mjs');
const controller=source('src/rings-now-private-fit-ui-controller.mjs');
const doc=source('docs/rings-now-iphone-private-fit-delivery-gate-20261114.md');
test('existing production feature stays hard-off, boundary stays unset',()=>{
 assert.match(html,/const RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(html,/const RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
 assert.doesNotMatch(html,/rings-now-private-fit-ui-controller\.mjs/);
 assert.doesNotMatch(html,/rings-now-private-fit-input-gate\.mjs/);
});
test('SW intercepts only icons and homepage; other JS and pages bypass SW response',()=>{
 assert.match(sw,/const RR_STATIC\s*=\s*\[/);
 assert.match(sw,/RR_STATIC\.includes\(url\.pathname\)/);
 assert.match(sw,/request\.mode === 'navigate'/);
 assert.match(sw,/url\.pathname === '\/' \|\| url\.pathname === '\/index\.html'/);
 assert.match(sw,/const RR_CACHE/);
 assert.doesNotMatch(sw,/skipWaiting\s*\(/);
 assert.doesNotMatch(sw,/clients\.claim\s*\(/);
 // Any change here requires full SW review; not evidence about HTTP caches.
 const respond=(sw.match(/event\.respondWith\s*\(/g)||[]).length;
 assert.equal(respond,2,'SW should only intercept static icons and homepage');
});
test('public synthetic page remains SHA-256 gated; private real FIT flow is not linked',()=>{
 assert.match(synthetic,/crypto\.subtle\.digest\('SHA-256',buffer\)/);
 assert.match(synthetic,/digest!==EXPECTED_SHA256/);
 assert.match(synthetic,/file\.size!==294/);
 assert.doesNotMatch(synthetic,/rings-now-private-fit-ui-controller\.mjs/);
 assert.doesNotMatch(synthetic,/rings-now-private-fit-input-gate\.mjs/);
 assert.match(input,/confirmedOwner=false,confirmedGachi=false/);
 assert.match(controller,/createRingsNowPrivateFitController/);
 assert.doesNotMatch(controller,/\bfetch\s*\(|\blocalStorage\b|indexedDB|navigator\.sendBeacon/);
});
test('old real-FIT preview exists, and document must treat it as publicly reachable risk',()=>{
 assert.match(oldPreview,/script-src 'none'/);
 assert.doesNotMatch(oldPreview,/<input\b|<script\b|reviewSingleUserFitBuffer/);
 assert.match(doc,/ima-wo-shirou-fit-local-file-draft-20261113\.html/);
 assert.match(doc,/配信され得る/);
 assert.match(doc,/アクセス制限にならない/);
});
test('real-FIT distribution remains explicitly prohibited pending separate consent',()=>{
 for(const phrase of ['HTTPS','CSP','Service Worker','むせ独立監査','Atsuo本人',
  '実FIT','通信','8日','同一性','GitHub Pages']){
  assert.ok(doc.includes(phrase),phrase+' security issue required in review');
 }
 assert.match(doc,/実FITの新規配信・利用を禁止/);
 assert.match(doc,/合成専用プレビューの公開承認を実FITテストに転用しない/);
 assert.match(doc,/公開HTMLではブラウザのHTTPキャッシュも別途検討する/);
});
