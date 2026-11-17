'use strict';
// Offline consistency checks only, not registry or G1 proof.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const ledger=JSON.parse(fs.readFileSync(path.join(root,'docs/rings-now-p2-g1-auditor-registry-evidence-20261117.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'tests/rings-now-p2-isolated-manifest.json'),'utf8'));
const workflow=fs.readFileSync(path.join(root,'.github/workflows/rings-now-p2-isolated-manual.yml'),'utf8');
const hashes=/^sha256:[0-9a-f]{64}$/;
test('ledger is an auditor-report handoff, not G1 or P2 permission',()=>{
 assert.equal(ledger.kind,'AUDITOR_REPORTED_REGISTRY_OBSERVATION');
 assert.equal(ledger.status,'EVIDENCE_HANDOFF_NOT_G1_APPROVAL');
 assert.equal(ledger.g1Verified,false);
 assert.equal(ledger.p2ExecutionAuthorized,false);
 assert.equal(ledger.originalRawRegistryResponseIncluded,false);
 assert.equal(ledger.independentlyRecheckedForThisPR,false);
});
test('all three platform digests match independent auditor report records',()=>{
 assert.deepEqual(ledger.sourceRecords.map(x=>x.component),['postgres','gotrue','postgrest']);
 assert.deepEqual(ledger.sourceRecords.map(x=>x.platformManifestDigest),[
 'sha256:6f7593c161689b6b02c78668b314af7da8811b592c5519108c57a49d0b6ad788',
 'sha256:839f529492d116b4e8b7777c953a27c381d34c15a744b1bcefde5eefaa1f9f9f',
 'sha256:c847127074bd26e1b8d3f7c0e6e01e5346f4b85dd34f5d699fd230af960827c0'
 ]);
 for(const entry of ledger.sourceRecords){
  assert.match(entry.platformManifestDigest,hashes);
  assert.match(entry.indexDigestAtAudit,hashes);
  assert.notEqual(entry.platformManifestDigest,entry.indexDigestAtAudit);
 }
});
test('PostgreSQL original index and auditor-time index remain distinct',()=>{
 const pg=ledger.sourceRecords[0];
 assert.equal(pg.previousPageIndexDigest,'sha256:dbb9623d5121b5d2c2c9e2fba56e40193cbb3510d4af7f035b1ab1823aff3205');
 assert.equal(pg.indexDigestAtAudit,'sha256:0d938e975177bef9f1f61f3f9dbcf2e0aa0a139568f66d3415ed8892eb97f6ac');
});
test('provenance explicitly lacks raw registry artifacts and exact clock time',()=>{
 assert.equal(ledger.precision,'approximate_minute_from_Muse_addendum_108');
 assert.equal(ledger.rawHeaderDumpIncluded,false);
 assert.equal(ledger.exactRequestAcceptHeadersIncluded,false);
 assert.equal(ledger.registryClientVersionIncluded,false);
});
test('manifest remains blocked and has no promoted image pins',()=>{
 assert.equal(manifest.status,'BLOCKED_NOT_RUN');
 assert.equal(manifest.explicitExecutionApproval,false);
 assert.equal(manifest.productionAccess,false);
 for(const key of ['postgres','gotrue','postgrest']){
  assert.equal(manifest.images[key].digest,null);
  assert.equal(manifest.images[key].reference,null);
 }
});
test('disabled workflow still contains the hard stop',()=>{
 assert.match(workflow,/^    if: \$\{\{ false \}\}/m);
 assert.match(workflow,/^  workflow_dispatch:/m);
});
