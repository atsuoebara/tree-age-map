'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const html=readFileSync(join(__dirname,'../previews/ima-wo-shirou-fit-local-file-draft-20261113.html'),'utf8');
const expected='信号待ちやトイレ休憩、自動ポーズなどの影響により、正しく分析できない場合があります。';
test('review-only FIT preview shows exact latest user-approved pause caveat',()=>{
 assert.ok(html.includes(expected));
 assert.equal(html.split(expected).length-1,1);
 assert.match(html,/<p class="warning" id="pause-quality-warning">/);
 assert.ok(html.includes('停止時間を含む時計の経過時間'));
});
test('no real FIT bytes transmitted, persisted or auto-connected',()=>{
 assert.match(html,/file\.arrayBuffer\(\)/);
 assert.match(html,/import \{reviewSingleUserFitBuffer\} from '\.\.\/src\/race-fit-local-file-review\.mjs'/);
 for(const pattern of [/\bfetch\s*\(/,/XMLHttpRequest/,/WebSocket/,/localStorage/,/sessionStorage/,/indexedDB/,/navigator\.sendBeacon/,/\bFormData\s*\(/,/\binnerHTML\s*=/])
  assert.doesNotMatch(html,pattern.source==='impossible'?null:pattern);
 assert.match(html,/type="button" disabled/);
 assert.match(html,/参考候補・未認証/);
});
