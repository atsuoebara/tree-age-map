// Legacy Chromium smoke retired because the publicly reachable FIT input was
// deliberately deactivated. Actual FIT SDK candidates remain tested in
// race-fit-local-file-review.test.mjs and the independent Rings Now UI tests.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../previews/ima-wo-shirou-fit-local-file-draft-20261113.html',import.meta.url),'utf8');
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
assert.match(html,/旧FIT試作ページは終了しました/);
assert.match(html,/script-src 'none'/);
assert.doesNotMatch(html,/<input\b|<script\b|<form\b|\.arrayBuffer\(/);
assert.ok(!sw.includes('ima-wo-shirou-fit-local-file-draft-20261113.html'));
console.log('Legacy FIT preview disabled: no FIT picker, scripts, form, or service-worker replay path.');
