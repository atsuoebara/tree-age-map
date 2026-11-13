/**
 * R3 fixed expected JSON outputs. Goldens are authored separately from the
 * algorithm: never regenerate snapshots inside the test or on a green CI run.
 * Source: synthetic deterministic device timestamps/distance and sensor fields.
 * No athlete data, credentials, external requests or writes.
 */
import { summarizeRace } from "./garmin_race_segments.ts";
import { previewGarminSensors } from "./garmin_race_optional.ts";
import type { PreviewSample } from "./garmin_race_optional.ts";
import smallExpected from "./fixtures/garmin-race/small-missing-partial.json" with { type: "json" };
import marathonExpected from "./fixtures/garmin-race/marathon-42195.json" with { type: "json" };
import plateauExpected from "./fixtures/garmin-race/plateau-stop.json" with { type: "json" };

function sample(d: number, t: number, hr: number | null, cadence: number | null, power: number | null): PreviewSample {
  return {
    totalDistanceInMeters: d,
    startTimeInSeconds: t,
    heartRate: hr,
    stepsPerMinute: cadence,
    powerInWatts: power,
  };
}

function compareGolden(label: string, input: readonly PreviewSample[], expected: unknown) {
  // Go through the SAME public optional extraction path, not only summary.
  const preview = previewGarminSensors({samples: input});
  if (!preview.ok) throw Error(label + ": optional extraction returned " + preview.reason);
  const result = summarizeRace(preview.samples);
  if (!result.ok) throw Error(label + ": segment calculation returned " + result.reason);
  const actual = result.summary;
  // JSON comparison intentionally includes every key, metric, quality flag,
  // original sensor unit, partial-segment metadata, null and ordering.
  const normalizedActual = JSON.stringify(actual);
  const normalizedExpected = JSON.stringify(expected);
  if (normalizedActual !== normalizedExpected) {
    let path = "root";
    const walk = (a: unknown, b: unknown, where: string): string | undefined => {
      if (Object.is(a,b)) return undefined;
      if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return where + ".length expected " + b.length + " got " + a.length;
        for (let i=0;i<a.length;i++) {
          const err=walk(a[i],b[i],where+"["+i+"]");
          if (err) return err;
        }
        return undefined;
      }
      if (a && b && typeof a==="object" && typeof b==="object") {
        const aa=a as Record<string,unknown>, bb=b as Record<string,unknown>;
        const ak=Object.keys(aa),bk=Object.keys(bb);
        if (JSON.stringify(ak)!==JSON.stringify(bk)) return where+" keys expected "+bk+" got "+ak;
        for (const k of bk) {
          const err=walk(aa[k],bb[k],where+"."+k);
          if (err) return err;
        }
        return undefined;
      }
      return where+": expected "+JSON.stringify(b)+" got "+JSON.stringify(a);
    };
    path=walk(actual,expected,"root") ?? "JSON serialized mismatch";
    throw Error(label+": golden changed at "+path);
  }
  console.log("R3_GOLDEN_PASS "+label+" segments="+actual.segments.length);
}

Deno.test("R3 snapshot: 2.25km sensor dropout and partial last kilometre",()=>{
  compareGolden("small-missing-partial",[
    sample(0,0,150,90,300),
    sample(1000,300,150,90,300),
    sample(2000,720,null,90,300),
    sample(2250,820,null,0,0),
  ],smallExpected);
});

Deno.test("R3 snapshot: true 42.195km marathon 42 full + 195m tail",()=>{
  compareGolden("marathon-42195",[
    sample(0,0,148,88,290),
    sample(42195,12658.5,148,88,290),
  ],marathonExpected);
});

Deno.test("R3 snapshot: repeated-distance pause is reported, clock time includes stop",()=>{
  // Plateau sample discarded for interpolation, but final elapsed includes time.
  compareGolden("plateau-stop",[
    sample(0,0,150,90,300),
    sample(500,200,150,90,300),
    sample(500,320,150,90,300),
    sample(1000,420,150,90,300),
  ],plateauExpected);
});
