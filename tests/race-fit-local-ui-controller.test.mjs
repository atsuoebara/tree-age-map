// 2026-11-14: the former public inline FIT picker is retired.
// Modern iPhone FIT controller cancellation tests are covered separately.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../previews/ima-wo-shirou-fit-local-file-draft-20261113.html',import.meta.url),'utf8');
const current=readFileSync(new URL('../src/rings-now-private-fit-ui-controller.mjs',import.meta.url),'utf8');
assert.match(html,/旧FIT試作ページは終了しました/);
assert.match(html,/script-src 'none'/);
assert.doesNotMatch(html,/<input\b|<script\b|reviewSingleUserFitBuffer|\.arrayBuffer\(/);
assert.match(current,/isContextCurrent/);
assert.match(current,/invalidate\(\)/);
console.log('Former public FIT inline controller disabled; newer isolated controller has separate tests.');
