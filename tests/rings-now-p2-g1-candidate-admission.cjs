'use strict';
// Pure, offline G1 candidate cross-check. No registry, process or execution.
const SERVICES=['postgres','gotrue','postgrest'];
const DIGEST=/^sha256:[0-9a-f]{64}$/;
const NAMES={postgres:'docker.io/library/postgres',gotrue:'docker.io/supabase/gotrue',postgrest:'docker.io/postgrest/postgrest'};
function inspectCandidate({candidate,ledger,activeManifest}={}) {
 const issues=[],add=x=>issues.push(x);
 if(!candidate||typeof candidate!=='object'||Array.isArray(candidate)||
    !ledger||typeof ledger!=='object'||Array.isArray(ledger)||
    !activeManifest||typeof activeManifest!=='object'||Array.isArray(activeManifest))
   return Object.freeze({status:'BLOCKED',issues:['invalid_input'],g1Verified:false,p2ExecutionAuthorized:false});
 if(candidate.schemaVersion!==1||candidate.status!=='BLOCKED_NOT_RUN'||
    candidate.purpose!=='AUDIT_ONLY_CANDIDATE_NOT_RUNTIME_INPUT'||candidate.platform!=='linux/amd64')
    add('candidate_not_blocked');
 if(candidate.checkoutCommit!==null||candidate.explicitExecutionApproval!==false||
    candidate.productionAccess!==false||candidate.g1Verified!==false||
    candidate.billingZeroAdditionalCost!=='NOT_VERIFIED'||
    candidate.independentAudit!=='PENDING'||candidate.authJwtCompatibility!=='NOT_PROVEN')
    add('candidate_gate_promotion');
 if(activeManifest.status!=='BLOCKED_NOT_RUN'||activeManifest.explicitExecutionApproval!==false||
    activeManifest.productionAccess!==false||activeManifest.checkoutCommit!==null||
    activeManifest.billingZeroAdditionalCost!=='NOT_VERIFIED'||
    activeManifest.independentAudit!=='PENDING'||
    activeManifest.authJwtCompatibility!=='NOT_PROVEN')add('active_gate_changed');
 if(ledger.platform!=='linux/amd64'||ledger.kind!=='AUDITOR_REPORTED_REGISTRY_OBSERVATION'||
    ledger.status!=='EVIDENCE_HANDOFF_NOT_G1_APPROVAL'||ledger.g1Verified!==false||
    ledger.p2ExecutionAuthorized!==false||ledger.originalRawRegistryResponseIncluded!==false)
    add('ledger_provenance_invalid');
 if(!Array.isArray(ledger.sourceRecords)||ledger.sourceRecords.length!==3)add('ledger_service_count');
 for(const key of SERVICES){
   const entries=Array.isArray(ledger.sourceRecords)?ledger.sourceRecords.filter(x=>x&&x.component===key):[];
   if(entries.length!==1){add(key+'_missing_or_duplicate_ledger');continue;}
   const record=entries[0],image=candidate.images?.[key],active=activeManifest.images?.[key];
   // Only two valid blocked states: ALL image fields null, or ALL three
   // exact audited child-digest pairs. Mixed/partial pins must fail closed.
   if(!active||!((active.digest===null&&active.reference===null)||
     (active.digest===record.platformManifestDigest&&
      active.reference===NAMES[key]+'@'+record.platformManifestDigest)))
     add(key+'_active_pin_mismatch');
   if(record.repository!==NAMES[key])add(key+'_repository_mismatch');
   if(!image||!DIGEST.test(image.digest||'')||
      image.digest!==record.platformManifestDigest||
      image.reference!==NAMES[key]+'@'+record.platformManifestDigest||
      image.digest===record.indexDigestAtAudit||image.digest===record.previousPageIndexDigest)
      add(key+'_candidate_pin_mismatch');
 }
 if(Object.keys(candidate.images||{}).sort().join(',')!==SERVICES.slice().sort().join(','))
   add('candidate_extra_or_missing_service');
 if(Object.keys(activeManifest.images||{}).sort().join(',')!==SERVICES.slice().sort().join(','))
   add('active_extra_or_missing_service');
 const isNull=SERVICES.map(k=>activeManifest.images?.[k]?.digest===null&&
   activeManifest.images?.[k]?.reference===null);
 if(isNull.some(Boolean)&&!isNull.every(Boolean))add('active_partial_pin_state');
 return Object.freeze({status:issues.length?'BLOCKED':'CANDIDATE_MATCHES_REPORTED_LEDGER_ONLY',
   issues:Object.freeze(issues),g1Verified:false,p2ExecutionAuthorized:false});
}
module.exports={inspectCandidate};
