// REVIEW-ONLY static evidence audit. This does not implement or patch production code.
// Each detector anchors to observed production source and records unprotected actor boundaries.
export function auditGarminThreeActorSources({oauth,worker,leaseSql,recovery}){
  const source={oauth:String(oauth||''),worker:String(worker||''),leaseSql:String(leaseSql||''),recovery:String(recovery||'')};
  const findings=[];
  function mark(id,actor,evidence,missing){findings.push(Object.freeze({id,actor,evidencePresent:Boolean(evidence),protected:Boolean(missing),status:!evidence?'evidence_missing':missing?'implemented':'integration_gap'}));}
  mark('oauth_disconnect_version_cas','manual_disconnect',/route === '\/disconnect'/.test(source.oauth),/route === '\/disconnect'[\s\S]{0,900}method: 'PATCH'[\s\S]{0,900}connection_version=eq\./.test(source.oauth));
  mark('oauth_callback_owner_transition','oauth_callback',/on_conflict=user_id/.test(source.oauth),/garmin_consent_(stage|activate)_owner/.test(source.oauth));
  mark('worker_remote_delete_owner_claim','push_worker',/wellness-api\/rest\/user\//.test(source.worker)&&/registration/.test(source.worker),/garmin_consent_claim_remote_revoke/.test(source.worker));
  mark('unknown_recovery_db_transition','database',/CREATE OR REPLACE FUNCTION consent_lease_ci\.expire/.test(source.leaseSql),/CREATE OR REPLACE FUNCTION (public\.)?garmin_consent_recover_unknown\(/.test(source.leaseSql));
  mark('recovery_gate_production_integration','integration',/export function reviewUnknownRevoke/.test(source.recovery),/garmin_consent_recover_unknown/.test(source.oauth)&&/garmin_consent_recover_unknown/.test(source.worker));
  return Object.freeze({mode:'review_only',canDeploy:false,providerScopeKnown:false,findings:Object.freeze(findings),allProtected:findings.every(f=>f.status==='implemented')});
}
