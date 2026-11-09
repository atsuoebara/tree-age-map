import { previewGarminSensors } from "./garmin_race_optional.ts";
function assert(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
function sample(i: number) {
  return { startTimeInSeconds: 1790000000 + i, totalDistanceInMeters: 10 * i,
    heartRate: 140 + i, stepsPerMinute: 80 + i, powerInWatts: 300 + i };
}
Deno.test("preserves original cadence and power without unit conversion", () => {
  const r = previewGarminSensors({samples:[sample(0),sample(1)]});
  assert(r.ok && r.samples[0].stepsPerMinute === 80 && r.samples[1].powerInWatts === 301, "modified raw fields");
});
Deno.test("optional sensor null and NaN are retained as null", () => {
  const r=previewGarminSensors({samples:[{...sample(0),heartRate:undefined},{...sample(1),powerInWatts:NaN}]});
  assert(r.ok && r.samples[0].heartRate===null && r.samples[1].powerInWatts===null, "nonfinite handling");
});
Deno.test("malformed sample safely falls back", () => {
  const r=previewGarminSensors({samples:[sample(0),null]});
  assert(!r.ok && r.reason==="invalid", "malformed sample accepted");
});
Deno.test("per-activity sample cap", () => {
  const a=previewGarminSensors({samples:[sample(0),sample(1),sample(2)]},2);
  const b=previewGarminSensors({samples:[sample(0),sample(1)]},2);
  assert(!a.ok && a.reason==="too_many_samples" && b.ok, "per-activity cap broken");
});
Deno.test("per-activity byte cap", () => {
  const r=previewGarminSensors({samples:[sample(0),sample(1)]},100,1);
  assert(!r.ok && r.reason==="too_many_bytes", "byte cap broken");
});
Deno.test("preserves original input", () => {
  const x={samples:[sample(0),sample(1)]}; const before=JSON.stringify(x);
  previewGarminSensors(x);assert(JSON.stringify(x)===before,"mutated input");
});
Deno.test("missing required time rejects only optional preview", () => {
  const r=previewGarminSensors({samples:[{...sample(0),startTimeInSeconds:undefined},sample(1)]});
  assert(!r.ok && r.reason==="invalid", "missing time accepted");
});
Deno.test("missing required cumulative distance rejects preview", () => {
  const r=previewGarminSensors({samples:[sample(0),{...sample(1),totalDistanceInMeters:null}]});
  assert(!r.ok && r.reason==="invalid", "missing distance accepted");
});
Deno.test("invalid bounds reject without throwing", () => {
  const r=previewGarminSensors({samples:[sample(0),sample(1)]},0,Infinity);
  assert(!r.ok && r.reason==="invalid", "invalid budget accepted");
});
Deno.test("nonzero starting distance is preserved", () => {
  const a={...sample(0),totalDistanceInMeters:1234};
  const b={...sample(1),totalDistanceInMeters:1244};
  const r=previewGarminSensors({samples:[a,b]});
  assert(r.ok && r.samples[0].totalDistanceInMeters===1234, "nonzero origin changed");
});
