import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {A_EVIDENCE_REQUIREMENTS,reviewADeploymentEvidence} from '../src/rings-now-a-deployment-evidence-gate.mjs';
test('nothing supplied is blocked, with every evidence requirement missing',()=>{
 const r=reviewADeploymentEvidence();
 assert.equal(r.status,'blocked');
 assert.deepEqual(r.missing,A_EVIDENCE_REQUIREMENTS);
});
test('each missing field blocks independently, including logs, zero cost and Safari',()=>{
 const full=Object.fromEntries(A_EVIDENCE_REQUIREMENTS.map(k=>[k,true]));
 for(const k of A_EVIDENCE_REQUIREMENTS){
  const r=reviewADeploymentEvidence({...full,[k]:false});
  assert.equal(r.status,'blocked',k);
  assert.deepEqual(r.missing,[k]);
 }
});
test('unknown fields, nonboolean claims and surprising payloads block',()=>{
 const full=Object.fromEntries(A_EVIDENCE_REQUIREMENTS.map(k=>[k,true]));
 assert.equal(reviewADeploymentEvidence({...full,fit:'not-allowed'}).status,'blocked');
 assert.equal(reviewADeploymentEvidence({...full,hardCostCapVerified:'true'}).status,'blocked');
 assert.throws(()=>reviewADeploymentEvidence(null));
});
test('all self-declared evidence still does not verify safety or authorize adoption',()=>{
 const full=Object.fromEntries(A_EVIDENCE_REQUIREMENTS.map(k=>[k,true]));
 const r=reviewADeploymentEvidence(full);
 assert.equal(r.status,'requires_independent_external_verification');
 for(const k of ['privacyVerified','costZeroVerified','networkVerified','oldTabsGuaranteedStopped','realFitAllowed','productionAllowed','optionAAdopted'])assert.equal(r[k],false,k);
 assert.equal(r.selfReportedOnly,true);
});
test('review module has no network or browser storage and stays out of production',()=>{
 const source=readFileSync(new URL('../src/rings-now-a-deployment-evidence-gate.mjs',import.meta.url),'utf8');
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 for(const re of [/\bfetch\s*\(/,/\bXMLHttpRequest\b/,/\bWebSocket\b/,/\blocalStorage\b/,/\bindexedDB\b/,/\bFileReader\b/])assert.doesNotMatch(source,re);
 assert.doesNotMatch(index,/rings-now-a-deployment-evidence-gate/);
 assert.doesNotMatch(sw,/rings-now-a-deployment-evidence-gate/);
 assert.match(index,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
});
