/**
 * Isolated R1 batch-size probe: Deno runtime, synthetic Garmin-style JSON.
 * No network, Garmin account, secrets, PostgreSQL, or production code import.
 * A >8,000,000-byte raw body is rejected BEFORE sanitized fallback can run.
 */
const RAW_LIMIT = 8_000_000;
const COUNT = 12_561;
function activity(n: number) {
  return {
    userId: "synthetic-user", summaryId: "synthetic-" + n, activityId: "synthetic-" + n,
    summary: {activityType:"RUNNING",distanceInMeters:42397.15,startTimeInSeconds:1794090000},
    samples: Array.from({length:COUNT},(_,i)=>({
      startTimeInSeconds:1794090000+i,
      totalDistanceInMeters:42397.15*i/(COUNT-1),
      latitudeInDegree:36.4+i/100000,longitudeInDegree:139.1+i/100000,
      heartRate:150+i%15,stepsPerMinute:88+i%6,powerInWatts:320+i%40,
      speedMetersPerSecond:3.3,elevationInMeters:110
    }))
  };
}
function baseOnly(d: ReturnType<typeof activity>) {
  return {userId:d.userId, summaryId:d.summaryId,activityId:d.activityId,
    summary:d.summary,
    samples:d.samples.map(p=>({latitudeInDegree:p.latitudeInDegree,longitudeInDegree:p.longitudeInDegree}))};
}
function bytes(v:unknown) {return new TextEncoder().encode(JSON.stringify(v)).byteLength;}
Deno.test("R1 synthetic Garmin batches: measure raw limit and fallback feasibility", ()=>{
  const measurements=[];
  for(const n of [1,2,3]){
    const list=Array.from({length:n},(_,i)=>activity(i));
    const raw=bytes({activityDetails:list});
    const gps=bytes({activityDetails:list.map(baseOnly)});
    const accepted=raw<=RAW_LIMIT;
    const m={activities:n,samples:n*COUNT,raw_bytes:raw,gps_only_bytes:gps,
      raw_within_8mb:accepted,post_parse_fallback_possible:accepted};
    measurements.push(m);
    if(n===1 && !accepted)throw Error("single synthetic run above guard");
    if(n===3 && accepted)throw Error("expected 3-run batch to exceed current guard");
  }
  console.log(JSON.stringify({kind:"synthetic_deno_r1_batch",measurements},null,2));
});
Deno.test("8MB boundary is strict (preparse)",()=>{
  if(!(8_000_000<=RAW_LIMIT && 8_000_001>RAW_LIMIT))throw Error("guard boundary");
});
