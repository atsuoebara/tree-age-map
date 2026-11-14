import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluateSyntheticTabRetirement as evaluate} from '../src/rings-now-stale-tab-retirement-policy.mjs';

const doc=readFileSync(new URL('../docs/rings-now-bfcache-iphone-evidence-and-stale-tab-review-20261114.md',import.meta.url),'utf8');

test('default and old tab cannot self-authorize',()=>{
 const x=evaluate();
 assert.equal(x.status,'blocked');
 assert.equal(x.allowRealFit,false);
 assert.equal(x.allowProduction,false);
 assert.equal(x.canGuaranteeOldTabRevocation,false);
});
test('every signal mismatch or missing fresh signal remains blocked',()=>{
 const okay={loadedBuild:'v2',expectedBuild:'v2',tabVisible:true,lifecycleRevoked:false,rollbackDeclared:false,freshSignalVerified:true};
 for(const delta of [{loadedBuild:'v1'},{expectedBuild:'v3'},{tabVisible:false},{lifecycleRevoked:true},{rollbackDeclared:true},{freshSignalVerified:false}]){
  const result=evaluate({...okay,...delta});
  assert.equal(result.status,'blocked',JSON.stringify(delta));
 }
});
test('even matching build and verified signal only requests human review',()=>{
 const result=evaluate({loadedBuild:'v2',expectedBuild:'v2',tabVisible:true,lifecycleRevoked:false,rollbackDeclared:false,freshSignalVerified:true});
 assert.equal(result.status,'requires_manual_review');
 assert.equal(result.allowRealFit,false);
 assert.equal(result.canGuaranteeOldTabRevocation,false);
});
test('real iPhone bfcache observation is scoped to synthetic display only',()=>{
 for(const phrase of ['PR #126','persisted=true','5区間が消えていた','戻る→進む','実FIT','HTTPキャッシュ','旧タブ'])assert.ok(doc.includes(phrase),phrase);
});
test('production OFF and synthetic page are untouched',()=>{
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const probe=readFileSync(new URL('../previews/rings-now-safari-forward-bfcache-probe-20261114.html',import.meta.url),'utf8');
 assert.match(index,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
 assert.match(probe,/persisted===true/);
 assert.doesNotMatch(index,/rings-now-stale-tab-retirement-policy/);
});
