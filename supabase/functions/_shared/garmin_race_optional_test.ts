import { previewGarminSensors } from "./garmin_race_optional.ts";

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
function sample(i: number) {
  return {startTimeInSeconds: 1790000000 + i,
    totalDistanceInMeters: 10 * i,
    heartRate: 140 + i,
    stepsPerMinute: 80 + i,
    powerInWatts: 300 + i};
}
Deno.test("valid samples retain raw fields and units without cadence doubling", () => {
  const r = previewGarminSensors({samples:[sample(0),sample(1)]});
  assert(r.ok, "valid samples rejected");
  assert(r.samples[0].stepsPerMinute === 80, "cadence changed");
  assert(r.samples[1].powerInWatts === 301, "power changed");
});
Deno.test("missing sensors remain null, not 0", () => {
  const r = previewGarminSensors({samples:[
    {...sample(0),heartRate:undefined},
    {...sample(1),powerInWatts:NaN}
  ]});
  assert(r.ok && r.samples[0].heartRate === null, "missing HR changed");
  assert(r.ok && r.samples[1].powerInWatts === null, "nonfinite power changed");
});
Deno.test("non-object optional data produces fallback, not exception", () => {
  const r = previewGarminSensors({samples:[sample(0),null]});
  assert(!r.ok && r.reason === "invalid", "malformed sensor did not fallback");
});
Deno.test("oversized batch preview falls back per activity", () => {
  const big=previewGarminSensors({samples:[sample(0),sample(1),sample(2)]},2);
  const small=previewGarminSensors({samples:[sample(0),sample(1)]},2);
  assert(!big.ok && big.reason === "too_many_samples", "oversize not rejected");
  assert(small.ok, "other batch activity unexpectedly rejected");
});
Deno.test("byte cap enforces local preview fallback", () => {
  const r=previewGarminSensors({samples:[sample(0),sample(1)]},100,1);
  assert(!r.ok && r.reason === "too_many_bytes", "byte cap ignored");
});
Deno.test("no mutation of raw input", () => {
  const d={samples:[sample(0),sample(1)]}; const raw=JSON.stringify(d);
  previewGarminSensors(d);
  assert(JSON.stringify(d)===raw,"input mutated");
});
