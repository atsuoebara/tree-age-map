import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compareRetirementOption,compareAllOptions,MODES} from '../src/rings-now-retirement-options-review.mjs';
const check=(mode,opts={})=>compareRetirementOption({mode,...opts});
test('all three options are review-only with no production or FIT permission',()=>{
 assert.equal(MODES.length,3);
 for(const result of compareAllOptions()){
  assert.equal(result.realFitAllowed,false);
  assert.equal(result.productionAllowed,false);
  assert.equal(result.verifiedSafe,false);
  assert.equal(result.oldTabGuaranteedStopped,false);
  assert.equal(result.chosen,false);
 }
});
test('A requires fresh signal and fails closed on missing, failed, or offline signal',()=>{
 for(const signal of ['missing','failed','offline'])assert.deepEqual(check('A_NETWORK',{signal}).reasons,['fresh_signal_unavailable']);
 assert.equal(check('A_NETWORK',{signal:'verified'}).status,'requires_manual_review');
 assert.ok(check('A_NETWORK',{signal:'verified',withdrawn:true}).reasons.includes('withdrawn'));
 assert.ok(check('A_NETWORK',{signal:'verified',remoteBuild:'v2'}).reasons.includes('build_mismatch'));
});
test('B short TTL cannot deliver withdrawal, cannot trust backwards clock',()=>{
 assert.ok(check('B_OFFLINE',{ageMs:100}).reasons.includes('remote_withdrawal_unknown'));
 assert.ok(check('B_OFFLINE',{ageMs:60000}).reasons.includes('local_ttl_expired'));
 assert.ok(check('B_OFFLINE',{ageMs:-1}).reasons.includes('clock_unreliable'));
 assert.ok(check('B_OFFLINE',{clockReliable:false}).reasons.includes('clock_unreliable'));
 assert.equal(check('B_OFFLINE',{ageMs:0}).oldTabGuaranteedStopped,false);
});
test('C prohibits public real FIT processing without pretending to stop every old tab',()=>{
 const result=check('C_NO_REAL_FIT_PUBLICATION');
 assert.ok(result.reasons.includes('real_fit_publication_not_available'));
 assert.equal(result.oldTabGuaranteedStopped,false);
});
test('local lifecycle revocation blocks regardless of option',()=>{
 for(const mode of MODES)assert.ok(check(mode,{lifecycleRevoked:true,signal:'verified'}).reasons.includes('lifecycle_revoked'));
});
test('model is not imported into published HTML or service worker and makes no IO calls',()=>{
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 const source=readFileSync(new URL('../src/rings-now-retirement-options-review.mjs',import.meta.url),'utf8');
 assert.match(index,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
 assert.doesNotMatch(index,/rings-now-retirement-options-review/);
 assert.doesNotMatch(sw,/rings-now-retirement-options-review/);
 for(const forbidden of [/\bfetch\s*\(/,/\bXMLHttpRequest\b/,/\blocalStorage\b/,/\bindexedDB\b/,/\bFileReader\b/,/\bpostMessage\s*\(/])assert.doesNotMatch(source,forbidden);
});
