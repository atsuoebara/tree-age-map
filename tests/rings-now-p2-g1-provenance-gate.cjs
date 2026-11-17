'use strict';
// Static P2 G1 provenance completeness checker. Offline only.
// This is NOT registry verification, signature verification or execution permission.
const assert = require('node:assert/strict');
const SERVICES = Object.freeze(['postgres', 'gotrue', 'postgrest']);
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const SHA = /^[a-f0-9]{40}$/;
const ISO_UTC = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/;
function inspectG1Evidence(manifest, evidence) {
  assert.ok(manifest && typeof manifest === 'object' && !Array.isArray(manifest));
  assert.ok(evidence && typeof evidence === 'object' && !Array.isArray(evidence));
  const issues=[];
  const add=(service,issue)=>issues.push(service+':'+issue);
  for(const service of SERVICES) {
    const image=manifest.images?.[service];
    const e=evidence.images?.[service];
    if(!image || !e || typeof e!=='object'||Array.isArray(e)) {
      add(service,'missing_evidence'); continue;
    }
    if(!DIGEST.test(image.digest||'')||!DIGEST.test(e.digest||''))add(service,'digest_missing_or_invalid');
    if(image.digest!==e.digest)add(service,'digest_mismatch');
    if(typeof image.reference!=='string'||!image.reference.endsWith('@'+e.digest))
      add(service,'manifest_reference_mismatch');
    if(typeof e.tag!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(e.tag))
      add(service,'tag_not_recorded');
    if(e.platform!=='linux/amd64')add(service,'wrong_platform');
    if(typeof e.registryUrl!=='string'||!/^https:\/\/[^/?#@]+\//.test(e.registryUrl))
      add(service,'registry_url_invalid');
    if(typeof e.officialSourceUrl!=='string'||!/^https:\/\/[^/?#@]+\//.test(e.officialSourceUrl))
      add(service,'official_source_missing');
    if(!ISO_UTC.test(e.observedAt||'')||Number.isNaN(Date.parse(e.observedAt))||
       new Date(e.observedAt).toISOString().replace('.000','')!==e.observedAt)
      add(service,'observation_time_invalid');
    if(!SHA.test(e.checkedOutCommit||''))add(service,'checkout_commit_missing');
    if(e.checkedOutCommit!==manifest.checkoutCommit)add(service,'checkout_commit_mismatch');
    if(e.registryQueryType!=='platform_manifest_digest')
      add(service,'registry_digest_kind_unproven');
    if(e.verifier!=='INDEPENDENTLY_AUDITED_EXTERNAL_PROBE')
      add(service,'verifier_unproven');
  }
  // All supplied strings can look valid without ever having contacted a registry.
  // Thus even structurally complete inputs cannot yield PASS.
  return Object.freeze({
    status:issues.length?'BLOCKED':'EVIDENCE_FORMAT_COMPLETE_UNVERIFIED',
    g1Verified:false, p2ExecutionAuthorized:false,
    issues:Object.freeze(issues)
  });
}
module.exports={inspectG1Evidence,SERVICES};
