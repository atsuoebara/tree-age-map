import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {localReviewHtml} from '../src/rings-now-local-fit-review-page.mjs';
import {discoverAllowedSources} from '../scripts/serve-rings-now-local-review.mjs';
const root=resolve(import.meta.dirname,'..');
test('review-only HTML template is not a public HTML file',()=>{
 const html=localReviewHtml();
 assert.match(html,/Rings Now/);
 assert.match(html,/実FIT使用未承認/);
 assert.match(html,/ガチラン/);
 assert.match(html,/src\/rings-now-iphone-isolated-handoff\.mjs/);
 assert.match(html,/type="file"/);
 assert.match(html,/pagehide/);
 assert.match(html,/visibilitychange/);
});
test('static dependency graph is deterministic and confined to local code',()=>{
 const files=discoverAllowedSources();
 assert.ok(files.size>=5);
 const paths=[...files].map(p=>relative(root,p));
 assert.ok(paths.includes('src/rings-now-iphone-isolated-handoff.mjs'));
 assert.ok(paths.includes('src/rings-now-private-fit-input-gate.mjs'));
 assert.ok(paths.includes('src/race-fit-local-file-review.mjs'));
 assert.ok(paths.every(p=>p.startsWith('src/')||p.startsWith('fit-sdk/')));
 assert.ok(paths.every(p=>p.endsWith('.mjs')||p.endsWith('.js')));
});
test('local host-only server has no POST route, storage, logs or upload handling',()=>{
 const server=readFileSync(new URL('../scripts/serve-rings-now-local-review.mjs',import.meta.url),'utf8');
 assert.match(server,/server\.listen\(port,'127\.0\.0\.1'/);
 assert.match(server,/req\.method!=='GET'/);
 assert.match(server,/no-store/);
 assert.match(server,/connect-src 'none'/);
 assert.match(server,/randomBytes\(32\)/);
 assert.doesNotMatch(server,/\b(?:fetch|XMLHttpRequest|WebSocket|createClient)\s*\(/);
 assert.doesNotMatch(server,/\.writeFile(?:Sync)?\s*\(|console\.log/);
});
test('production remains disabled and not linked',()=>{
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.match(index,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
 for(const text of [index,sw]) {
  assert.doesNotMatch(text,/rings-now-local-fit-review-page|serve-rings-now-local-review/);
 }
});
