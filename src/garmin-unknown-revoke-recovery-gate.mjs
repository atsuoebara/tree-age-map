// REVIEW ONLY: fail-closed decision aid for an UNKNOWN remote Garmin registration DELETE.
// This is not a recovery executor. Never import into an Edge Function or worker.
const blocked=Object.freeze({
  retryRemoteDelete:false, activatePendingConsent:false, importEnabled:false,
  revokeState:'revoke_unknown', requiresFreshUserAuthorization:true,
});

export function reviewUnknownRevoke(input){
  const s=input && typeof input==='object'?input:{};
  const base={...blocked,decision:'hold',reason:'remote_outcome_unverified',manualReview:true};
  if(s.phase!=='revoke_unknown')return {...base,decision:'invalid_state',reason:'not_unknown'};
  if(!s.ownerId||!s.generation||!s.attemptId)return {...base,decision:'invalid_evidence',reason:'missing_owner_generation_attempt'};
  if(s.currentGeneration!==s.generation)return {...base,decision:'stale_evidence',reason:'generation_changed'};
  if(s.providerScopeConfirmed!==true)return {...base,reason:'provider_delete_scope_unknown'};
  if(s.remoteResultVerified!==true)return {...base,reason:'remote_delete_result_unknown'};
  if(s.independentAuditApproved!==true)return {...base,reason:'independent_audit_required'};
  // Verified evidence allows a human to PLAN a fresh OAuth authorization;
  // it is NOT permission to mutate rows, replay a callback or reactivate tokens.
  return {...base,decision:'fresh_authorization_review',reason:'manual_fresh_oauth_required'};
}
