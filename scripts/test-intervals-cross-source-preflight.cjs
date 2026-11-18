'use strict';
// No Supabase or network access: verify the exact client guard from index.html
// against synthetic rows, failures, and owner/date restrictions.
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf('async function isPreviouslySavedCloudRun(activity) {');
const end=html.indexOf('\n\nasync function importFromIntervals()',start);
assert.ok(start>0 && end>start,'guard function must exist');
const source=html.slice(start,end);
assert.match(html,/if \(duplicate \|\| await isPreviouslySavedCloudRun\(activity\)\)/);
function harness(response,initial={}) {
  const calls=[];
  const ctx={
    currentUser: {id:'11111111-1111-4111-8111-111111111111'},
    cloudEnabled:()=>true,
    SUPABASE_RUNS_URL:'https://example.invalid/rest/v1/runs',
    getCloudHeaders:async()=>({Authorization:'Bearer synthetic'}),
    fetch:async(url,opts)=>{calls.push({url,opts});return response},
    ...initial
  };
  const guard=vm.runInNewContext('('+source+')',ctx);
  return {guard,calls};
}
const good=(rows)=>({ok:true,json:async()=>rows});
const activity=(startedAt,distance=5.12)=>({startedAt,distance});
(async()=>{
  const h=harness(good([{id:10,source:'strava',distance_km:5.01}]));
  assert.equal(await h.guard(activity('2026-11-09T10:20:11.000Z')),true);
  assert.equal(h.calls.length,1);
  const uri=new URL(h.calls[0].url);
  assert.equal(uri.searchParams.get('user_id'),'eq.11111111-1111-4111-8111-111111111111');
  assert.equal(uri.searchParams.get('deleted_at'),'is.null');
  assert.equal(uri.searchParams.get('started_at'),'eq.2026-11-09T10:20:11.000Z');
  assert.equal(h.calls[0].opts.headers.Authorization,'Bearer synthetic');
  assert.equal(await harness(good([{distance_km:1.15}])).guard(activity('2026-11-13T10:22:05Z',1.18)),true);
  assert.equal(await harness(good([{distance_km:7.9}])).guard(activity('2026-11-09T10:20:11Z')),false);
  assert.equal(await harness(good([])).guard(activity('2026-11-09T10:20:11Z')),false);
  assert.equal(await harness(good([{distance_km:null}])).guard(activity('2026-11-09T10:20:11Z')),false);
  const incomplete=harness(good([]));
  assert.equal(await incomplete.guard(activity(null)),false);
  assert.equal(incomplete.calls.length,0);
  const outage=harness({ok:false,status:503});
  await assert.rejects(outage.guard(activity('2026-11-09T10:20:11Z')),/duplicate preflight failed HTTP 503/);
  await assert.rejects(harness(good({unexpected:true})).guard(activity('2026-11-09T10:20:11Z')),/invalid data/);
  await assert.rejects(harness(good([]),{currentUser:null}).guard(activity('2026-11-09T10:20:11Z')),/owner unavailable/);
  assert.match(html,/if \(duplicate \|\| await isPreviouslySavedCloudRun\(activity\)\) \{\s*duplicates\+\+;\s*continue;/);
  console.log('PASS Intervals cross-source pre-save guard: owner filter, exact start, distance tolerance, duplicate skip, fail closed, missing start');
})().catch(e=>{console.error(e);process.exitCode=1;});
