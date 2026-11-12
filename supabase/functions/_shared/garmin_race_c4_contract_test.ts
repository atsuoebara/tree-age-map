import {previewOwnedGarminRace, type AuthenticatedContext, type OwnedRun, type TrustedGarminPayload, type UserChoice} from "./garmin_race_c4_contract.ts";
function assert(v: unknown, msg: string): asserts v {if(!v) throw Error(msg);}
const setup=()=>{
  const auth:AuthenticatedContext={userId:"owner-a",requestedAt:"2026-11-13T10:00:00+09:00",activatedAt:"2026-11-12T00:00:00+09:00",maxAgeSeconds:8*86400};
  const run:OwnedRun={id:"run-1",user_id:"owner-a",source:"garmin",source_external_id:"garmin-api:activity-12",
    started_at:"2026-11-13T07:00:00+09:00",ingested_at:"2026-11-13T09:00:00+09:00",deleted_at:null};
  const payload:TrustedGarminPayload={user_id:"owner-a",run_id:"run-1",source_external_id:"garmin-api:activity-12",
    started_at:run.started_at,connection_version:"generation-1",active_connection_version:"generation-1",
    samples:Array.from({length:101},(_,i)=>({startTimeInSeconds:1800000000+i*25,totalDistanceInMeters:i*100,heartRate:140}))};
  const choice:UserChoice={selectedRunId:"run-1",intent:"race",confirmed:true};
  return {auth,run,payload,choice};
};
Deno.test("single Garmin run passes only with internally matching owner/run/source/generation",()=>{
 const x=setup(); const r=previewOwnedGarminRace(x.auth,x.run,x.payload,x.choice);
 assert(r.ok&&r.runId==="run-1"&&r.provisional===true&&r.summary.segments.length===10,JSON.stringify(r));
});
Deno.test("other owner or deleted run cannot be analyzed",()=>{
 const a=setup();a.run.user_id="owner-b";
 const b=setup();b.payload.user_id="owner-b";
 const c=setup();c.run.deleted_at="2026-11-13T10:00:00+09:00";
 for(const x of [a,b,c]) {const r=previewOwnedGarminRace(x.auth,x.run,x.payload,x.choice);
  assert(!r.ok&&r.reason==="unauthorized","unauthorized run accepted");}
});
Deno.test("other run IDs and selected same-day run mixing refused",()=>{
 const a=setup();a.choice.selectedRunId="run-2";
 const b=setup();b.payload.run_id="run-2";
 for(const x of [a,b]){const r=previewOwnedGarminRace(x.auth,x.run,x.payload,x.choice);
  assert(!r.ok&&r.reason==="run_mismatch","cross-run mix accepted");}
});
Deno.test("Strava source or wrong Garmin external activity rejected",()=>{
 const a=setup();a.run.source="strava";
 const b=setup();b.payload.source_external_id="garmin-api:other-activity";
 for(const x of [a,b]){const r=previewOwnedGarminRace(x.auth,x.run,x.payload,x.choice);
  assert(!r.ok&&r.reason==="source_mismatch","cross-source accepted");}
});
Deno.test("stale Garmin connection generation rejected",()=>{
 const x=setup();x.payload.active_connection_version="generation-2";
 const r=previewOwnedGarminRace(x.auth,x.run,x.payload,x.choice);
 assert(!r.ok&&r.reason==="stale_connection","stale receipt accepted");
});
Deno.test("wrong payload activity start rejected",()=>{
 const x=setup();x.payload.started_at="2026-11-13T07:01:00+09:00";
 const r=previewOwnedGarminRace(x.auth,x.run,x.payload,x.choice);
 assert(!r.ok&&r.reason==="payload_mismatch","mismatched activity accepted");
});
Deno.test("JOG, unconfirmed choice, expired race rejected by existing C3 gate",()=>{
 const jog=setup();jog.choice.intent="jog";
 const notConfirmed=setup();notConfirmed.choice.confirmed=false;
 const expired=setup();expired.auth.requestedAt="2026-11-22T10:00:00+09:00";
 const results=[jog,notConfirmed,expired].map(x=>previewOwnedGarminRace(x.auth,x.run,x.payload,x.choice));
 assert(!results[0].ok&&results[0].reason==="not_race_effort","jog accepted");
 assert(!results[1].ok&&results[1].reason==="not_selected","unconfirmed accepted");
 assert(!results[2].ok&&results[2].reason==="not_recent","expired accepted");
});
