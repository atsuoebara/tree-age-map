import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const doc=readFileSync(new URL('../docs/rings-now-real-snapshot-preflight-v01.md',import.meta.url),'utf8');
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
test('all eight independently provable release gates documented',()=>{
 for(let n=1;n<=8;n++)assert.match(doc,new RegExp('\\| G'+n+' \\|'));
 for(const term of ['JWT','RLS','ABA','IndexedDB','cloudRows','1,000','691200','FIT']){if(term)assert.ok(doc.includes(term),term)}
});
test('must not misrepresent keyset or double scan as a consistent transaction',()=>{
 assert.match(doc,/キーセットページング.*完全な同時点集合は自動保証しない/);
 assert.match(doc,/#148 二重走査.*整合性証明ではなく/);
 assert.match(doc,/未承認の操作/);
 assert.match(doc,/正式名称は \*\*Rings Now\*\*/);
});
test('public entrypoint remains OFF and rollout time null',()=>{
 assert.match(index,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
 assert.doesNotMatch(index,/rings-now-real-snapshot-preflight-v01/);
 assert.doesNotMatch(sw,/rings-now-real-snapshot-preflight-v01/);
});
