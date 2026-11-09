import {summarizeRace} from "./garmin_race_segments.ts";
import type {PreviewSample} from "./garmin_race_optional.ts";
function assert(x:unknown,msg:string):asserts x {if(!x)throw Error(msg);}
function p(d:number,t:number,h:number|null=150,c:number|null=90,w:number|null=300):PreviewSample{
  return {totalDistanceInMeters:d,startTimeInSeconds:t,heartRate:h,stepsPerMinute:c,powerInWatts:w};
}
function get(s:PreviewSample[]){const r=summarizeRace(s);assert(r.ok,JSON.stringify(r));return r.summary;}
Deno.test("1km exact, elapsed includes stop",()=>{
 const r=get([p(0,0),p(500,200),p(500,320),p(1000,420)]);
 assert(r.segments.length===1,"segment count");
 assert(r.segments[0].clock_elapsed_s===420,"elapsed");
 assert(r.quality_flags.includes("plateau_or_equal_time"),"plateau flag");
});
Deno.test("nonzero origin and linear interpolation",()=>{
 const r=get([p(120,10),p(870,310),p(1370,510)]);
 assert(r.segments.length===2,"count");
 assert(r.segments[0].clock_elapsed_s===400,"boundary");
 assert(r.segments[1].distance_m===250 && r.segments[1].clock_elapsed_s===100,"tail");
});
Deno.test("partial coverage below 80 percent hides mean",()=>{
 const r=get([p(0,0,150),p(500,100,150),p(1000,200,null)]);
 const m=r.segments[0].metrics.heart_rate;
 assert(m.coverage_fraction===0.5,"half coverage");
 assert(m.mean_raw_value===null && r.segments[0].quality_flags.includes("sensor_missing"),"mean shown despite low coverage");
});
Deno.test("80 percent threshold shows mean and exact coverage",()=>{
 const r=get([p(0,0,150),p(800,160,150),p(1000,200,null)]);
 const m=r.segments[0].metrics.heart_rate;
 assert(m.coverage_fraction===0.8 && m.mean_raw_value===150,"80% threshold");
});
Deno.test("heart rate zero missing, power/cadence zero preserved",()=>{
 const r=get([p(0,0,0,0,0),p(1000,300,0,0,0)]);
 assert(r.segments[0].metrics.heart_rate.mean_raw_value===null,"zero HR");
 assert(r.segments[0].metrics.power.mean_raw_value===0,"zero W");
 assert(r.segments[0].metrics.cadence.mean_raw_value===0,"zero cadence");
});
Deno.test("missing data is null, not zero",()=>{
 const r=get([p(0,0,null,null,null),p(1000,300,null,null,null)]);
 assert(r.segments[0].metrics.heart_rate.coverage_fraction===0,"coverage");
 assert(r.segments[0].metrics.power.mean_raw_value===null,"power");
});
Deno.test("time reverse and duplicate discarded",()=>{
 const r=get([p(0,0),p(500,100),p(300,110),p(1000,250)]);
 assert(r.excluded_samples===1 && r.quality_flags.includes("nonmonotonic_samples"),"reverse");
});
Deno.test("sparse two points generate 3 segments",()=>{
 const r=get([p(0,0),p(2500,1000)]);
 assert(r.segments.length===3 && r.segments[2].distance_m===500,"segments");
 assert(Math.abs(r.segments.reduce((x,s)=>x+s.clock_elapsed_s,0)-1000)<0.001,"time conservation");
});
Deno.test("insufficient input fails closed",()=>{
 const r=summarizeRace([p(0,0)]);assert(!r.ok,"accepted");
});
Deno.test("synthetic marathon 42 full + final tail, sums conserved",()=>{
 const a=Array.from({length:12561},(_,i)=>p(42397.15*i/12560,12518*i/12560));
 const r=get(a);assert(r.segments.length===43,"43 segments");
 assert(Math.abs(r.segments.reduce((x,s)=>x+s.distance_m,0)-r.total_distance_m)<0.01,"distance");
 assert(Math.abs(r.segments.reduce((x,s)=>x+s.clock_elapsed_s,0)-r.total_clock_elapsed_s)<0.03,"clock");
});

Deno.test("invalid NaN sample has invalid_sample flag, not nonmonotonic",()=>{
 const r=get([p(0,0),p(Number.NaN,100),p(1000,300)]);
 assert(r.excluded_samples===1,"one invalid point should be dropped");
 assert(r.quality_flags.includes("invalid_sample"),"missing invalid_sample");
 assert(!r.quality_flags.includes("nonmonotonic_samples"),"wrong reversal flag");
});
Deno.test("negative distance and missing clock are invalid not reversed",()=>{
 const r=get([p(0,0),p(-2,100),p(500,NaN),p(1000,300)]);
 assert(r.excluded_samples===2,"count");
 assert(r.quality_flags.length===1 && r.quality_flags[0]==="invalid_sample","flag vocabulary");
});
Deno.test("simultaneous invalid and reversed samples retain distinct flags",()=>{
 const r=get([p(0,0),p(500,100),p(NaN,110),p(400,120),p(1000,300)]);
 assert(r.excluded_samples===2,"count");
 assert(r.quality_flags.includes("invalid_sample") && r.quality_flags.includes("nonmonotonic_samples"),"distinct reasons");
});
