/** C6: in-process Deno workload probe, synthetic only. Never runs a server.
 * No credentials, external network, Garmin account or production database.
 * Timings and heap are observations on GitHub-hosted CPU, not edge SLA.
 */
import { previewGarminSensors, MAX_PREVIEW_SAMPLES } from "./garmin_race_optional.ts";
import { summarizeRace } from "./garmin_race_segments.ts";

const rawLimit = 8_000_000;
const encoder = new TextEncoder();
type Shape = { startTimeInSeconds:number; totalDistanceInMeters:number;
  heartRate:number; stepsPerMinute:number; powerInWatts:number;
  latitudeInDegree:number; longitudeInDegree:number; speedMetersPerSecond:number;
  elevationInMeters:number; };
function detail(points:number, name:string) {
  const samples:Shape[] = Array.from({length:points},(_,i)=>({
    startTimeInSeconds:1794090000+i,
    totalDistanceInMeters:42397.15*i/(points-1),
    heartRate:135+i%19, stepsPerMinute:83+i%10, powerInWatts:255+i%65,
    latitudeInDegree:36.4+i/100000,longitudeInDegree:139.1+i/100000,
    speedMetersPerSecond:3.3, elevationInMeters:110,
  }));
  return { userId:"synthetic-user",summaryId:"synthetic-"+name,activityId:name,
    summary:{activityType:"RUNNING",distanceInMeters:42397.15,startTimeInSeconds:1794090000},
    samples};
}
function measured(points:number, iterations:number) {
  const input=detail(points,String(points));
  const payload=JSON.stringify({activityDetails:[input]});
  const rawBytes=encoder.encode(payload).byteLength;
  const heapBefore=Deno.memoryUsage();
  const started=performance.now();
  const parsed=JSON.parse(payload) as {activityDetails:unknown[]};
  const parsedMs=performance.now()-started;
  let totalPreviewMs=0, totalSummarizeMs=0, maxHeapUsed=0;
  let segments=0, previewBytes=0;
  for (let i=0;i<iterations;i++) {
    const b=performance.now();
    const result=previewGarminSensors(parsed.activityDetails[0]);
    totalPreviewMs+=performance.now()-b;
    if (!result.ok) throw Error("preview failed "+result.reason);
    previewBytes=result.bytes;
    const c=performance.now();
    const summary=summarizeRace(result.samples);
    totalSummarizeMs+=performance.now()-c;
    if (!summary.ok)throw Error("summary failed "+summary.reason);
    segments=summary.summary.segments.length;
    if (segments!==43)throw Error("42.397km must yield 43 segments, got "+segments);
    maxHeapUsed=Math.max(maxHeapUsed,Deno.memoryUsage().heapUsed);
  }
  const heapAfter=Deno.memoryUsage();
  const row={
    samples:points,iterations,raw_bytes:rawBytes,
    raw_within_existing_guard:rawBytes<=rawLimit,
    parsed_ms:Number(parsedMs.toFixed(3)),
    preview_avg_ms:Number((totalPreviewMs/iterations).toFixed(3)),
    summarize_avg_ms:Number((totalSummarizeMs/iterations).toFixed(3)),
    combined_avg_ms:Number(((totalPreviewMs+totalSummarizeMs)/iterations).toFixed(3)),
    heap_before_bytes:heapBefore.heapUsed,heap_after_bytes:heapAfter.heapUsed,
    peak_sampled_heap_used_bytes:maxHeapUsed,
    output_preview_bytes:previewBytes,output_segments:segments,
  };
  console.log("C6_SYNTHETIC_LOAD "+JSON.stringify(row));
  return row;
}
Deno.test("C6 synthetic one-marathon 12,561 samples end-to-end Deno processing",()=>{
  const r=measured(12_561,3);
  if (!r.raw_within_existing_guard)throw Error("synthetic marathon exceeded existing 8MB body cap");
});
Deno.test("C6 max 20,000 samples: optional path must be robust, even if raw body exceeds 8MB",()=>{
  const r=measured(MAX_PREVIEW_SAMPLES,2);
  // This test is not permission to raise existing 8MB receive guard.
  if (r.output_preview_bytes>5_000_000)throw Error("optional preview cap overflow");
});
Deno.test("C6 guard: above 20,000 never enters analysis",()=>{
  const input=detail(MAX_PREVIEW_SAMPLES+1,"over");
  const result=previewGarminSensors(input);
  if (result.ok || result.reason!=="too_many_samples")throw Error("missing sample limit rejection");
  console.log("C6_SYNTHETIC_GUARD "+JSON.stringify({samples:input.samples.length,rejection:result.reason}));
});
