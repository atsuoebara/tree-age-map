import { previewSingleRaceRun, type Request } from "./garmin_race_single_run.ts";
function assert(x: unknown, message: string): asserts x { if (!x) throw Error(message); }
const base = (): Request => ({
  runId: "synthetic-run-A", confirmed: true, intent: "race",
  activityStartedAt: "2026-11-13T07:00:00+09:00",
  activatedAt: "2026-11-12T00:00:00+09:00",
  detail: {samples: Array.from({length: 11}, (_, i) => ({
    startTimeInSeconds: 1800000000 + i * 250,
    totalDistanceInMeters: i * 1000,
    heartRate: 140 + i,
  }))},
});
Deno.test("one chosen 10km race has ten complete clock laps", () => {
  const r = previewSingleRaceRun(base());
  assert(r.ok && r.runId === "synthetic-run-A" && r.summary.segments.length === 10, JSON.stringify(r));
  assert(r.summary.total_distance_m === 10000 && r.provisional === true, "distance or provisional label");
});
Deno.test("one 5km TT is still eligible for lap view; no training advice implied", () => {
  const v = base(); v.intent = "time_trial";
  v.detail = {samples: Array.from({length: 6}, (_, i) => ({
    startTimeInSeconds: 1800000000 + i * 240, totalDistanceInMeters: i * 1000,
  }))};
  const r = previewSingleRaceRun(v);
  assert(r.ok && r.summary.segments.length === 5, JSON.stringify(r));
});
Deno.test("selected record attempt allowed", () => {
  const v = base(); v.intent = "record_attempt";
  assert(previewSingleRaceRun(v).ok, "record attempt rejected");
});
Deno.test("JOG recovery and other are not analyzed", () => {
  for (const intent of ["jog", "recovery", "other"] as const) {
    const v=base(); v.intent=intent;
    const r=previewSingleRaceRun(v);
    assert(!r.ok && r.reason==="not_race_effort", "non-race analyzed");
  }
});
Deno.test("no opt in and no run id rejected", () => {
  const a=base(); a.confirmed=false;
  const b=base(); b.runId="";
  assert(!previewSingleRaceRun(a).ok && !previewSingleRaceRun(b).ok, "unselected allowed");
});
Deno.test("past run before activation is excluded, activation boundary inclusive", () => {
  const old=base(); old.activityStartedAt="2026-11-11T23:59:59+09:00";
  const current=base(); current.activityStartedAt=current.activatedAt;
  const a=previewSingleRaceRun(old),b=previewSingleRaceRun(current);
  assert(!a.ok && a.reason==="pre_activation" && b.ok, "activation cutoff incorrect");
});
Deno.test("invalid dates cannot bypass activation cutoff", () => {
  for (const activityStartedAt of ["2026-11-13", "not-a-date", "2026-13-01T00:00:00Z"]) {
    const v=base(); v.activityStartedAt=activityStartedAt;
    const r=previewSingleRaceRun(v);
    assert(!r.ok && r.reason==="invalid_date", "bad date allowed");
  }
});
Deno.test("missing or malformed time/distance cannot be analyzed", () => {
  const v=base(); v.detail={samples:[{startTimeInSeconds:1,totalDistanceInMeters:0},
    {startTimeInSeconds:2,totalDistanceInMeters:null}]};
  const r=previewSingleRaceRun(v);
  assert(!r.ok && r.reason==="missing_samples", "invalid samples allowed");
});
Deno.test("reversed timestamps or stopped distance are not silently repaired", () => {
  for (const samples of [
    [{startTimeInSeconds:0,totalDistanceInMeters:0},{startTimeInSeconds:100,totalDistanceInMeters:500},{startTimeInSeconds:80,totalDistanceInMeters:600},{startTimeInSeconds:240,totalDistanceInMeters:1000}],
    [{startTimeInSeconds:0,totalDistanceInMeters:0},{startTimeInSeconds:100,totalDistanceInMeters:500},{startTimeInSeconds:120,totalDistanceInMeters:500},{startTimeInSeconds:240,totalDistanceInMeters:1000}],
  ]) {
    const v=base(); v.detail={samples};
    const r=previewSingleRaceRun(v);
    assert(!r.ok && r.reason==="unreliable_samples", "suspect samples were accepted");
  }
});
Deno.test("bad input does not throw and source object remains unchanged", () => {
  const v=base(); const before=JSON.stringify(v);
  previewSingleRaceRun(v);
  assert(JSON.stringify(v)===before, "mutated input");
});
