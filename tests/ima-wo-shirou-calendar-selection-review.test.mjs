import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewSelectedCalendarRun as review} from '../src/ima-wo-shirou-calendar-selection-review.mjs';
const started='2026-11-13T00:00:00Z',baseMs=Date.parse(started);
const row={id:21,user_id:'user-A',activity_date:'2026-11-14',started_at:started,distance_km:10,deleted_at:null};
const common={row,currentUserId:'user-A',selectedAsGachiRun:true,featureStartedAtMs:baseMs-1,nowMs:baseMs+691200000};
test('single selected run remains distinct from its calendar date',()=>{
 const result=review(common);
 assert.equal(result.status,'eligible_window_only');
 assert.equal(result.runId,'21');
 assert.equal(result.timeBasis,'started_at');
 assert.equal(result.analysisAllowed,false);
});
test('same-day multiple runs are not combined',()=>{
 assert.equal(review({...common,row:{...row,id:22}}).runId,'22');
 assert.equal(review({...common,row:{...row,id:23}}).runId,'23');
});
test('owner mismatch, deleted or missing identity fail closed',()=>{
 assert.equal(review({...common,currentUserId:'user-B'}).reason,'owner_mismatch_or_missing');
 assert.equal(review({...common,row:{...row,user_id:undefined}}).eligible,false);
 assert.equal(review({...common,row:{...row,deleted_at:'2026-11-13'}}).reason,'deleted_run');
 assert.equal(review({...common,row:{...row,id:undefined}}).eligible,false);
});
test('missing start time cannot be inferred from activity_date',()=>{
 assert.equal(review({...common,row:{...row,started_at:null}}).reason,'run_start_missing_or_invalid');
 assert.equal(review({...common,row:{...row,started_at:'2026-11-13'}}).eligible,false);
 assert.equal(review({...common,row:{...row,started_at:'not a timestamp'}}).eligible,false);
});
test('selected only; inclusive 8d boundary and expiration',()=>{
 assert.equal(review({...common,selectedAsGachiRun:false}).reason,'user_selection_required');
 assert.equal(review({...common,nowMs:baseMs+691200001}).reason,'eight_day_window_expired');
});
test('feature launch cutoff not guessed; old runs denied',()=>{
 assert.equal(review({...common,featureStartedAtMs:undefined}).reason,'timestamp_missing_or_invalid');
 assert.equal(review({...common,featureStartedAtMs:baseMs+1}).reason,'pre_feature_activity_not_eligible');
});

test('impossible civil dates and clock times are rejected',()=>{
 assert.equal(review({...common,row:{...row,started_at:'2026-02-31T00:00:00Z'}}).reason,'run_start_missing_or_invalid');
 assert.equal(review({...common,row:{...row,started_at:'2026-11-13T25:00:00Z'}}).reason,'run_start_missing_or_invalid');
});
