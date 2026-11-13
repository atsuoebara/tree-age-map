import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewFitLinkForSelectedRun as check} from '../src/ima-wo-shirou-fit-link-review.mjs';
const calendarEligibility={status:'eligible_window_only',eligible:true,analysisAllowed:false,runId:'21'};
const fitReview={status:'candidate_unverified',qualityCertified:false,analysisAllowed:false,writeAllowed:false,
segments:[{distanceM:1000,clockElapsedS:420}],flags:['distance_plateau_elapsed_kept']};
const input={calendarEligibility,fitReview,selectedRunId:'21'};
test('cannot automatically match a calendar run to an uploaded FIT',()=>{
 const out=check(input);
 assert.equal(out.status,'requires_same_activity_confirmation');
 assert.equal(out.linkVerified,false);
 assert.equal(out.analysisAllowed,false);
});
test('explicit confirmation enables only an unverified local preview with pause warning',()=>{
 const out=check({...input,userConfirmedSameActivity:true});
 assert.equal(out.status,'local_preview_only');
 assert.equal(out.analysisAllowed,false);
 assert.equal(out.linkVerified,false);
 assert.match(out.cautionJa,/信号待ちやトイレ休憩、自動ポーズ/);
 assert.equal('segments' in out,false);
 assert.equal('runId' in out,false);
});
test('switching selected row, stale eligibility or expired window is blocked',()=>{
 assert.equal(check({...input,selectedRunId:'22',userConfirmedSameActivity:true}).reason,'selection_changed_or_invalid');
 assert.equal(check({...input,calendarEligibility:{...calendarEligibility,eligible:false}}).reason,'calendar_window_not_eligible');
});
test('rejects raw/untrusted FIT status and improper quality claims',()=>{
 assert.equal(check({...input,fitReview:{...fitReview,status:'blocked'},userConfirmedSameActivity:true}).reason,'fit_candidate_not_safe');
 assert.equal(check({...input,fitReview:{...fitReview,qualityCertified:true},userConfirmedSameActivity:true}).reason,'fit_candidate_not_safe');
 assert.equal(check({...input,fitReview:{...fitReview,analysisAllowed:true},userConfirmedSameActivity:true}).reason,'fit_candidate_not_safe');
});
test('no user IDs, raw FIT or coordinates flow into result',()=>{
 const result=check({...input,userConfirmedSameActivity:true,selectedRunId:'21',location:[36.5,139.3],rawFit:'private'});
 const json=JSON.stringify(result);
 assert.ok(!json.includes('private'));
 assert.ok(!json.includes('36.5'));
 assert.ok(!json.includes('21'));
});
