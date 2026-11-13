import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditGarminThreeActorSources} from '../src/garmin-three-actor-source-gap-audit.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const real={
 oauth:read('supabase/functions/garmin-oauth/index.ts'),
 worker:read('supabase/functions/garmin-activity-push/index.ts'),
 leaseSql:read('supabase/tests/garmin_consent_lease_recovery_setup.sql'),
 recovery:read('src/garmin-unknown-revoke-recovery-gate.mjs')
};
const result=auditGarminThreeActorSources(real);
assert.equal(result.mode,'review_only');
assert.equal(result.canDeploy,false);
assert.equal(result.providerScopeKnown,false);
assert.equal(result.allProtected,false);
assert.deepEqual(result.findings.map(f=>f.id),[
 'oauth_disconnect_version_cas','oauth_callback_owner_transition',
 'worker_remote_delete_owner_claim','unknown_recovery_db_transition',
 'recovery_gate_production_integration']);
for(const finding of result.findings){
 assert.equal(finding.evidencePresent,true,JSON.stringify(finding));
 assert.equal(finding.status,'integration_gap',JSON.stringify(finding));
}
const empty=auditGarminThreeActorSources({});
assert.ok(empty.findings.every(f=>f.status==='evidence_missing'));
// Synthetic guarded fixtures: detectors can distinguish source with a claimed guard.
const guarded={
 oauth:`if(route === '/disconnect'){const rows = await json(\x60\x24{db}?user_id=eq.owner&connection_version=eq.old\x60, {method: 'PATCH'}); } const x='on_conflict=user_id'; await garmin_consent_stage_owner(); await garmin_consent_recover_unknown();`,
 worker:'https://apis.garmin.com/wellness-api/rest/user/registration; await garmin_consent_claim_remote_revoke(); await garmin_consent_recover_unknown();',
 leaseSql:'CREATE OR REPLACE FUNCTION consent_lease_ci.expire(); CREATE OR REPLACE FUNCTION public.garmin_consent_recover_unknown()',
 recovery:'export function reviewUnknownRevoke(){}'
};
const protectedFixture=auditGarminThreeActorSources(guarded);
assert.equal(protectedFixture.allProtected,true);
assert.ok(protectedFixture.findings.every(f=>f.status==='implemented'));
console.log('Garmin three-actor SOURCE GAP audit PASS: five observed integration gaps; protected/absent fixtures detected; deployment forbidden');
