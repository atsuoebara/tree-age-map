import assert from 'node:assert/strict';
import {actors,mutations,externalDelete,goNoGo} from '../src/garmin-lifecycle-integration-plan.mjs';
assert.deepEqual(Object.keys(actors).sort(),['manual_disconnect','oauth_callback','push_worker']);
for(const [actor,actions] of Object.entries(actors)){
 assert.ok(actions.length>0,actor);
 for(const a of actions)assert.ok(mutations[a],actor+' has undefined action '+a);
}
assert.ok(actors.manual_disconnect.includes('request_disconnect'));
assert.ok(actors.oauth_callback.includes('stage_new_consent'));
assert.ok(actors.oauth_callback.includes('activate_new_consent'));
assert.ok(actors.push_worker.includes('claim_remote_revoke'));
for(const [action,rule] of Object.entries(mutations)){
 assert.ok(rule.scope.startsWith('owner+'),action+' must always scope mutations by owner');
 assert.equal(rule.remote,false,action+' must not call a remote provider from a DB transaction');
 if(action!=='activate_new_consent')assert.notEqual(rule.next,'connected',action+' must never auto-activate new consent');
 if(['complete_remote_revoke','mark_remote_unknown'].includes(action)){
  assert.ok(rule.scope.includes('generation'));
  assert.ok(rule.scope.includes('lease'));
  assert.equal(rule.import,false);
 }
}
assert.deepEqual(externalDelete.allowedActorActions,['claim_remote_revoke']);
assert.equal(externalDelete.requiredState,'revoke_inflight');
assert.equal(externalDelete.timeoutNext,'revoke_unknown');
assert.equal(externalDelete.safeToActivateNewConsentDuringFlight,false);
assert.equal(externalDelete.providerScopeKnown,false);
assert.equal(externalDelete.retryAfterTimeoutWithoutProviderGuarantee,false);
assert.ok(['owner','generation','lease_token','lease_deadline','attempt_id'].every(x=>externalDelete.requiredProof.includes(x)));
assert.ok(goNoGo.includes('official_provider_delete_scope_confirmed'));
assert.ok(goNoGo.includes('muse_independent_audit_and_owner_approval'));
assert.ok(goNoGo.includes('oauth_regressions_and_year_ring_push_ack_nonregression'));
console.log('Garmin three-actor integration DESIGN CONTRACT PASS; production implementation and provider guarantees remain No-Go');
