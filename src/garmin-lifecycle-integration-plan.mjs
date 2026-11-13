// REVIEW-ONLY integration contract. Explicitly NOT imported by production code.
// These declarative rules describe the target design, not currently implemented behavior.
export const actors=Object.freeze({
 manual_disconnect:Object.freeze(['request_disconnect','claim_remote_revoke','complete_remote_revoke','mark_remote_unknown']),
 oauth_callback:Object.freeze(['stage_new_consent','activate_new_consent']),
 push_worker:Object.freeze(['claim_remote_revoke','complete_remote_revoke','mark_remote_unknown','reconcile_permissions']),
});
export const mutations=Object.freeze({
 request_disconnect:{expected:'connected',next:'disconnect_requested',scope:'owner+generation',import:false,remote:false},
 claim_remote_revoke:{expected:'disconnect_requested|revoke_unknown',next:'revoke_inflight',scope:'owner+generation+lease',import:false,remote:false},
 complete_remote_revoke:{expected:'revoke_inflight',next:'disconnected',scope:'owner+generation+lease',import:false,remote:false},
 mark_remote_unknown:{expected:'revoke_inflight',next:'revoke_unknown',scope:'owner+generation+lease',import:false,remote:false},
 stage_new_consent:{expected:'disconnect_requested|revoke_inflight|revoke_unknown',next:'same',scope:'owner+generation',import:false,remote:false},
 activate_new_consent:{expected:'disconnected|connected',next:'connected',scope:'owner+new-generation',import:true,remote:false},
 reconcile_permissions:{expected:'connected',next:'connected',scope:'owner+generation',import:true,remote:false},
});
// Remote DELETE is never executed inside a database transaction; it requires a
// durable claim and owns no authorization to activate a newer registration.
export const externalDelete=Object.freeze({
 allowedActorActions:['claim_remote_revoke'],
 requiredState:'revoke_inflight',
 requiredProof:['owner','generation','lease_token','lease_deadline','attempt_id'],
 timeoutNext:'revoke_unknown',
 safeToActivateNewConsentDuringFlight:false,
 providerScopeKnown:false,
 retryAfterTimeoutWithoutProviderGuarantee:false,
});
export const goNoGo=Object.freeze([
 'official_provider_delete_scope_confirmed',
 'callback_manual_worker_share_atomic_owner_transitions',
 'provider_timeout_recovery_strategy_audited',
 'expired_claim_and_restart_handling_tested',
 'production_roles_rls_and_schema_audited',
 'oauth_regressions_and_year_ring_push_ack_nonregression',
 'muse_independent_audit_and_owner_approval',
]);
