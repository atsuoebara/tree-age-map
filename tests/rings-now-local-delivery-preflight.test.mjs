import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {inspectSourceGraph} from '../scripts/rings-now-local-delivery-preflight.mjs';
const root=resolve(new URL('..',import.meta.url).pathname);
const html='previews/rings-now-iphone-synthetic-handoff-20261114.html';
const good="<html><meta http-equiv=\"Content-Security-Policy\" content=\"connect-src 'none'; form-action 'none'\"><script type=\"module\">import {ok} from './safe.mjs';</script></html>";
function run(files,entry='preview/test.html'){
 const read=p=>{
  const key=p.slice(root.length+1);
  if(!Object.hasOwn(files,key))throw Error('not found');
  return files[key];
 };
 return inspectSourceGraph({rootDir:root,entryPath:entry,read});
}
test('synthetic iPhone real-device A-E acceptance is separately documented',()=>{
 const doc=readFileSync(new URL('../docs/rings-now-iphone-acceptance-and-private-delivery-20261114.md',import.meta.url),'utf8');
 for(const s of ['2026-11-14','PR #120','A〜E','本人によるiPhone実機','実FITの利用許可ではない','再読み込み','追加費用0円'])assert.ok(doc.includes(s),s);
});
test('unflagged static source is still manual review, NEVER approved',()=>{
 const f={'preview/test.html':good,'preview/safe.mjs':'export const ok=true;'};
 const result=run(f);
 assert.equal(result.status,'requires_manual_review');
 assert.deepEqual(result.inspected,['preview/safe.mjs','preview/test.html']);
});
test('finds transitive network and storage calls and blocks',()=>{
 const f={'preview/test.html':good,'preview/safe.mjs':"import './deeper.mjs';",'preview/deeper.mjs':"fetch('/upload'); localStorage.setItem('x','y');"};
 const result=run(f);
 assert.equal(result.status,'blocked');
 assert.ok(result.problems.some(x=>x.code==='fetch'&&x.file==='preview/deeper.mjs'));
 assert.ok(result.problems.some(x=>x.code==='persistent_storage'));
});
test('blocks direct forbidden patterns, dynamic imports and bad CSP',()=>{
 const f={'preview/test.html':"<script>import('./evil.mjs');window.open('/share')</script><form></form>"};
 const codes=run(f).problems.map(x=>x.code);
 for(const c of ['missing_connect_src_none','missing_form_action_none','form_element_requires_review','dynamic_import','navigation'])assert.ok(codes.includes(c),c);
});
test('blocks external, escaped, absent dependencies without reading them',()=>{
 for(const importExpr of ["import 'https://example.org/a.js';","import '../../secret.mjs';","import './missing.mjs';"]){
  const f={'preview/test.html':"<meta http-equiv=\"Content-Security-Policy\" content=\"connect-src 'none'; form-action 'none'\"><script type=\"module\">"+importExpr+"</script>"};
  const r=run(f);
  assert.equal(r.status,'blocked',importExpr);
 }
 assert.equal(run({},'../outside.html').status,'blocked');
});
test('new public synthetic page is only a source-review target, not real FIT authorization',()=>{
 const res=inspectSourceGraph({rootDir:root,entryPath:html});
 assert.ok(res.inspected.includes(html));
 assert.ok(res.inspected.includes('src/rings-now-iphone-synthetic-inspector.mjs'));
 assert.ok(res.inspected.includes('src/rings-now-iphone-isolated-handoff.mjs'));
 assert.notEqual(res.status,'approved');
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(index,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
});
