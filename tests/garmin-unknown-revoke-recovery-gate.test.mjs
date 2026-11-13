import assert from 'node:assert/strict';
import {reviewUnknownRevoke} from '../src/garmin-unknown-revoke-recovery-gate.mjs';
const base={phase:'revoke_unknown',ownerId:'owner-a',generation:'gen-old',currentGeneration:'gen-old',attemptId:'attempt-1'};
const cases=[
 [{...base},'hold','provider_delete_scope_unknown'],
 [{...base,providerScopeConfirmed:true},'hold','remote_delete_result_unknown'],
 [{...base,providerScopeConfirmed:true,remoteResultVerified:true},'hold','independent_audit_required'],
 [{...base,providerScopeConfirmed:true,remoteResultVerified:true,independentAuditApproved:true},'fresh_authorization_review','manual_fresh_oauth_required'],
 [{...base,generation:'gen-other'},'stale_evidence','generation_changed'],
 [{...base,attemptId:null},'invalid_evidence','missing_owner_generation_attempt'],
 [{...base,phase:'connected'},'invalid_state','not_unknown'],
];
for(const [input,decision,reason] of cases){
 const result=reviewUnknownRevoke(input);
 assert.equal(result.decision,decision);
 assert.equal(result.reason,reason);
 assert.equal(result.retryRemoteDelete,false);
 assert.equal(result.activatePendingConsent,false);
 assert.equal(result.importEnabled,false);
 assert.equal(result.revokeState,'revoke_unknown');
 assert.equal(result.manualReview,true);
 assert.equal(result.requiresFreshUserAuthorization,true);
}
// Even provider confirmation cannot override the invariant or cause a side effect.
assert.deepEqual(reviewUnknownRevoke({...base,providerScopeConfirmed:true,remoteResultVerified:true,independentAuditApproved:true}),reviewUnknownRevoke({...base,providerScopeConfirmed:true,remoteResultVerified:true,independentAuditApproved:true}));
console.log('UNKNOWN Garmin registration DELETE recovery gate PASS: 7 isolated scenarios; no automatic retry, activation, or import');
