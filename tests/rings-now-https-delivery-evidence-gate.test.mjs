import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FIT_HTTPS_DELIVERY_REQUIREMENTS as requirements,assessRingsNowHttpsDeliveryEvidence as assess} from '../src/rings-now-https-delivery-evidence-gate.mjs';
test('default fail-closed: no evidence and no real-FIT authorization',()=>{
 const r=assess();
 assert.equal(r.status,'blocked');
 assert.equal(r.failures.length,requirements.length);
 assert.equal(r.mayPublishRealFitPage,false);
 assert.equal(r.mayReadRealFit,false);
 assert.equal(r.mayEnableProduction,false);
});
test('each of the fourteen conditions is mandatory',()=>{
 for(const missing of requirements){
  const evidence=Object.fromEntries(requirements.map(k=>[k,true]));
  evidence[missing]=false;
  const r=assess({evidence});
  assert.equal(r.status,'blocked',missing);
  assert.ok(r.failures.includes('evidence_missing:'+missing));
 }
});
test('no self-certification: all evidence still needs final human approval',()=>{
 const evidence=Object.fromEntries(requirements.map(k=>[k,true]));
 const r=assess({evidence});
 assert.equal(r.status,'requires_explicit_final_authorization');
 assert.equal(r.mayPublishRealFitPage,false);
 assert.equal(r.mayReadRealFit,false);
 assert.equal(r.mayEnableProduction,false);
 assert.ok(!Object.values(r).includes('approved'));
});
test('banned paths are denied even with evidence',()=>{
 const evidence=Object.fromEntries(requirements.map(k=>[k,true]));
 for(const action of ['public_real_fit_html_now','automatic_fit_run_matching','prod_on','unsafe_unknown']){
  const r=assess({evidence,forbiddenActions:[action]});
  assert.equal(r.status,'blocked',action);
 }
});
test('cannot use option B/C evidence as an authorization for A',()=>{
 const evidence=Object.fromEntries(requirements.map(k=>[k,true]));
 for(const candidate of ['B_PRIVATE_LOCAL','C_AUTHENTICATED','unknown']){
  assert.equal(assess({candidate,evidence}).status,'blocked');
 }
});
test('existing public test page remains strictly synthetic and production disabled',()=>{
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const synthetic=readFileSync(new URL('../previews/rings-now-iphone-synthetic-handoff-20261114.html',import.meta.url),'utf8');
 const source=readFileSync(new URL('../src/rings-now-https-delivery-evidence-gate.mjs',import.meta.url),'utf8');
 assert.match(index,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
 assert.match(synthetic,/createSyntheticOnlyInspector/);
 assert.doesNotMatch(index,/rings-now-https-delivery-evidence-gate\.mjs/);
 assert.doesNotMatch(synthetic,/rings-now-https-delivery-evidence-gate\.mjs/);
 for(const disallowed of [/\bfetch\s*\(/,/\bXMLHttpRequest\b/,/\blocalStorage\b/,/\bindexedDB\b/,/\bsendBeacon\s*\(/,/postMessage\s*\(/,/\bFileReader\b/])assert.doesNotMatch(source,disallowed);
});
