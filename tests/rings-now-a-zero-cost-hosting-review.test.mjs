import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CANDIDATES,evaluateSyntheticHosting} from '../src/rings-now-a-zero-cost-hosting-review.mjs';
const verifiedClaims={actualPlanVerified:true,hardZeroOverageVerified:true,privacyAndLogsVerified:true,cacheAndAuthenticityVerified:true,oldTabLimitationAcknowledged:true,iphoneSafariVerified:true};
test('static GitHub Pages cannot stand in for fresh dynamic stop authority',()=>{
 const r=evaluateSyntheticHosting({candidate:'GITHUB_PAGES_STATIC',...verifiedClaims});
 assert.equal(r.reviewStatus,'blocked');
 assert.ok(r.gaps.includes('static_pages_cannot_guarantee_fresh_revocation'));
});
test('all candidate zero-cost assertions are insufficient without external verification',()=>{
 for(const candidate of Object.keys(CANDIDATES)){
  const result=evaluateSyntheticHosting({candidate,...verifiedClaims,...(candidate==='CLOUDFLARE_WORKERS_FREE'?{workersOverageFailClosedVerified:true}:{})});
  assert.equal(result.verifiedZeroIncrementalCost,false);
  assert.equal(result.privacyVerified,false);
  assert.equal(result.oldTabsGuaranteedStopped,false);
  assert.equal(result.realFitAllowed,false);
  assert.equal(result.productionAllowed,false);
  assert.equal(result.optionAAdopted,false);
  if(candidate!=='GITHUB_PAGES_STATIC')assert.equal(result.reviewStatus,'requires_independent_external_verification');
 }
});
test('missing plan, billing cap, privacy, cache, old tabs or Safari evidence blocks',()=>{
 for(const key of Object.keys(verifiedClaims)){
  const r=evaluateSyntheticHosting({candidate:'CLOUDFLARE_WORKERS_FREE',...verifiedClaims,workersOverageFailClosedVerified:true,[key]:false});
  assert.equal(r.reviewStatus,'blocked',key);
  assert.ok(r.gaps.length>0);
 }
});
test('Workers overage fail-open or unverified configuration blocks, and unknown/nonboolean fields block',()=>{
 const base={candidate:'CLOUDFLARE_WORKERS_FREE',...verifiedClaims};
 assert.ok(evaluateSyntheticHosting(base).gaps.includes('workers_overage_fail_closed_unverified'));
 assert.ok(evaluateSyntheticHosting({...base,workersOverageFailClosedVerified:false}).gaps.includes('workers_overage_fail_closed_unverified'));
 assert.equal(evaluateSyntheticHosting({...base,workersOverageFailClosedVerified:'true'}).reviewStatus,'blocked');
 assert.equal(evaluateSyntheticHosting({...base,workersOverageFailClosedVerified:true}).reviewStatus,'requires_independent_external_verification');
 assert.equal(evaluateSyntheticHosting({...base,workersOverageFailClosedVerified:true,fit:'x'}).reviewStatus,'blocked');
 assert.equal(evaluateSyntheticHosting({...base,workersOverageFailClosedVerified:true,actualPlanVerified:'true'}).reviewStatus,'blocked');
 assert.equal(evaluateSyntheticHosting({candidate:'SUPABASE_EDGE_EXISTING',...verifiedClaims,workersOverageFailClosedVerified:true}).reviewStatus,'blocked');
 assert.throws(()=>evaluateSyntheticHosting(null));
});
test('missing evidence and unknown candidate fail closed',()=>{
 assert.equal(evaluateSyntheticHosting({candidate:'SUPABASE_EDGE_EXISTING'}).reviewStatus,'blocked');
 assert.throws(()=>evaluateSyntheticHosting({candidate:'made-up'}));
});
test('isolated source neither communicates nor enters live UI',()=>{
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 const source=readFileSync(new URL('../src/rings-now-a-zero-cost-hosting-review.mjs',import.meta.url),'utf8');
 assert.match(index,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
 assert.doesNotMatch(index,/rings-now-a-zero-cost-hosting-review/);
 assert.doesNotMatch(sw,/rings-now-a-zero-cost-hosting-review/);
 for(const re of [/\bfetch\s*\(/,/\bXMLHttpRequest\b/,/\bWebSocket\b/,/\bFileReader\b/,/\blocalStorage\b/,/\bindexedDB\b/])assert.doesNotMatch(source,re);
});
