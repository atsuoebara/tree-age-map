import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FIT_HTTPS_DELIVERY_REQUIREMENTS as requirements,assessRingsNowHttpsDeliveryEvidence} from '../src/rings-now-https-delivery-evidence-gate.mjs';
const doc=readFileSync(new URL('../docs/rings-now-iphone-real-device-lifecycle-evidence-20261114.md',import.meta.url),'utf8');
test('three separately reported real iPhone navigation cases accurately recorded',()=>{
 for(const phrase of ['別アプリへ移動','別Safariタブへ移動','Safariの「戻る」','「消えていた」','「消えていたよ」'])assert.ok(doc.includes(phrase),phrase);
});
test('do not turn Back into Forward or simulated bfcache into runtime proof',()=>{
 for(const phrase of ['「進む」を試したことにはならない','bfcacheが使用されたことを確認したわけでもない','ネットワーク監視','HTTPキャッシュ/CDN残存'])assert.ok(doc.includes(phrase),phrase);
});
test('refile and explicit confirm are not passive result resurrection',()=>{
 assert.match(doc,/「ファイルを選択すれば復活した」/);
 assert.match(doc,/「同じファイルを読み込んで、確認を押した」/);
 assert.match(doc,/旧結果の無操作での復活と同一視しない/);
});
test('evidence ledger does not unlock any of 14 real-FIT delivery requirements',()=>{
 assert.equal(requirements.length,14);
 const r=assessRingsNowHttpsDeliveryEvidence({evidence:{}});
 assert.equal(r.status,'blocked');
 assert.equal(r.failures.filter(x=>x.startsWith('evidence_missing:')).length,14);
 for(const key of ['iosSafariLifecycleTested','httpCacheAndServiceWorkerReviewed','incidentRollbackAndOldTabPlan'])
  assert.match(doc,new RegExp(key));
 assert.equal(r.mayReadRealFit,false);
 assert.equal(r.mayPublishRealFitPage,false);
 assert.equal(r.mayEnableProduction,false);
});
test('main production flags and synthetic-only page remain unchanged by record-only PR',()=>{
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const preview=readFileSync(new URL('../previews/rings-now-iphone-synthetic-handoff-20261114.html',import.meta.url),'utf8');
 assert.match(index,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
 assert.match(preview,/createSyntheticOnlyInspector/);
 assert.match(preview,/connect-src 'none'/);
});
