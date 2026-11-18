'use strict';
// P2 boot configuration shape preflight ONLY. Pure offline checks, no I/O.
// No credentials, environment values, shell commands or runnable container argv.
// A successful shape review NEVER proves service readiness or authorizes P2.
const {inspectCandidate}=require('./rings-now-p2-g1-candidate-admission.cjs');
const ledger=require('../docs/rings-now-p2-g1-auditor-registry-evidence-20261117.json');
const REQUIRED=Object.freeze({
 postgres:Object.freeze(['POSTGRES_DB','POSTGRES_USER','POSTGRES_PASSWORD','PGDATA']),
 gotrue:Object.freeze([
  'GOTRUE_SITE_URL','API_EXTERNAL_URL','GOTRUE_DB_DRIVER',
  'GOTRUE_DB_DATABASE_URL','GOTRUE_JWT_SECRET','GOTRUE_JWT_AUD',
  'GOTRUE_JWT_DEFAULT_GROUP_NAME'
 ]),
 postgrest:Object.freeze([
  'PGRST_DB_URI','PGRST_DB_SCHEMAS','PGRST_DB_ANON_ROLE',
  'PGRST_JWT_SECRET','PGRST_JWT_ROLE_CLAIM_KEY'
 ])
});
const SERVICES=Object.freeze(['postgres','gotrue','postgrest']);
const TMPFS=Object.freeze(['/var/lib/postgresql/data','/tmp']);
function sameNames(actual,expected){
 return Array.isArray(actual)&&actual.length===new Set(actual).size&&
  actual.every(x=>typeof x==='string')&&
  actual.slice().sort().join('\0')===expected.slice().sort().join('\0');
}
function inspectP2ServiceBootPlan({plan,candidate,activeManifest}={}){
 const issues=[],fail=x=>issues.push(x);
 if(!plan||typeof plan!=='object'||Array.isArray(plan))
  return Object.freeze({status:'BLOCKED',issues:Object.freeze(['invalid_plan']),serviceBootProven:false,p2ExecutionAuthorized:false});
 if(!candidate||!activeManifest||
  inspectCandidate({candidate,ledger,activeManifest}).status!=='CANDIDATE_MATCHES_REPORTED_LEDGER_ONLY')
  fail('candidate_or_active_manifest_not_admitted');
 if(plan.purpose!=='OFFLINE_SERVICE_BOOT_SHAPE_REVIEW_ONLY'||
  plan.executionApproval!==false||plan.dockerExecutionAllowed!==false||
  plan.credentialsIncluded!==false||plan.realResourcesObserved!==false)
  fail('execution_or_secret_boundary_changed');
 if(plan.network?.kind!=='isolated-internal-run-network'||
  plan.network?.internal!==true||plan.network?.attachable!==false||
  plan.network?.hostPortsPublished!==false||
  plan.network?.hostNetworkAllowed!==false||
  plan.network?.externalApplicationEgressAllowed!==false)
  fail('network_boundary_not_fixed');
 if(plan.runner?.kind!=='github-hosted-standard'||plan.runner?.jobs!==1||
  plan.runner?.manualOnly!==true||plan.runner?.maximumMinutes!==10||
  plan.runner?.workflowEnabled!==false)
  fail('runner_not_blocked');
 if(plan.secrets?.source!=='GENERATE_AT_RUNTIME_INSIDE_DISPOSABLE_RUNNER'||
  plan.secrets?.logged!==false||plan.secrets?.storedInRepo!==false||
  plan.secrets?.fromProduction!==false||plan.secrets?.providedNow!==false)
  fail('secret_provision_not_isolated');
 if(plan.cleanup?.runScopedLabels!==true||plan.cleanup?.reconcileAfterTimeout!==true||
  plan.cleanup?.verifyDaemonResourcesEmpty!==true||
  plan.cleanup?.cannotClaimProvenNow!==true)
  fail('cleanup_evidence_incomplete');
 if(plan.auth?.jwtAlgorithm!=='HS256_PROPOSED_NOT_TESTED'||
  plan.auth?.sharedSigningKeyReference!=='EPHEMERAL_REFERENCE_ONLY'||
  plan.auth?.expiryTestMethod!=='NATURAL_EXPIRATION_PROPOSED_NOT_TESTED'||
  plan.auth?.realJWTVerificationCompleted!==false||
  plan.auth?.postgrestClaimsGucObserved!==false)
  fail('auth_preflight_missing');
 if(Object.keys(plan.services||{}).sort().join(',')!==SERVICES.slice().sort().join(','))
  fail('service_set_wrong');
 for(const service of SERVICES){
  const s=plan.services?.[service],image=candidate?.images?.[service];
  if(!s||typeof s!=='object'||s.imageReference!==image?.reference||
   s.platform!=='linux/amd64'||s.portsPublished!==false||
   s.privileged!==false||s.persistentVolumes!==false||
   s.healthcheckVerified!==false||s.startupVerified!==false)
   {fail(service+'_service_contract_invalid');continue;}
  if(!sameNames(s.requiredEnvironmentKeys,REQUIRED[service])||
   s.environmentValuesIncluded!==false||s.credentialsLogged!==false)
   fail(service+'_env_shape_wrong');
 }
 if(plan.services?.postgres?.ephemeralWritePaths?.slice().sort().join(',')!==
    TMPFS.slice().sort().join(',')||
    plan.services?.postgres?.dataDurable!==false||
    plan.services?.postgres?.writableMountsCompatibilityVerified!==false)
  fail('postgres_ephemeral_data_not_reviewed');
 if(plan.services?.gotrue?.emailDeliveryEnabled!==false||
    plan.services?.gotrue?.phoneDeliveryEnabled!==false||
    plan.services?.gotrue?.externalOAuthEnabled!==false||
    plan.services?.gotrue?.authSchemaMigrationVerified!==false)
  fail('gotrue_external_or_migration_unknown');
 if(plan.services?.postgrest?.roleConfigVerified!==false||
    plan.services?.postgrest?.claimsGucVerified!==false||
    plan.services?.postgrest?.externalHostnameAllowed!==false)
  fail('postgrest_role_or_network_unverified');
 if(plan.billing?.futureRunIncrementalCostProven!==false||
  plan.billing?.accountUiEvidenceVerified!==false)
  fail('billing_unverified_flag_was_promoted');
 if(plan.serviceBootProven!==false||plan.g3Verified!==false||
    plan.p2ExecutionAuthorized!==false)
  fail('proof_flag_promoted');
 return Object.freeze({
  status:issues.length?'BLOCKED':'BOOT_SHAPE_REVIEW_COMPLETE_NOT_RUN',
  issues:Object.freeze(issues),serviceBootProven:false,realJWTVerified:false,
  dockerResourcesVerified:false,g1Verified:false,g2Verified:false,
  g3Verified:false,p2ExecutionAuthorized:false
 });
}
module.exports={inspectP2ServiceBootPlan,REQUIRED};
