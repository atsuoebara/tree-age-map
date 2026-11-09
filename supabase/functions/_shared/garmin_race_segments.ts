/**
 * Optional Garmin race kilometre segment computation.
 * Pure and isolated: never imported by the live Push receiver.
 * Elapsed clock seconds include stops. Results are device-distance based.
 * Original sensor units are not converted; zero heart rate means missing.
 */
import type { PreviewSample } from "./garmin_race_optional.ts";

export type Metric = {
  source_field: string;
  raw_unit: string;
  aggregation_method: "distance_weighted_linear";
  covered_distance_m: number;
  coverage_fraction: number;
  mean_raw_value: number | null;
};
export type Segment = {
  segment_index: number;
  start_m: number;
  end_m: number;
  distance_m: number;
  clock_elapsed_s: number;
  quality_flags: string[];
  metrics: { heart_rate: Metric; cadence: Metric; power: Metric };
};
export type Summary = {
  analysis_version: "garmin-activity-details-v1";
  distance_basis: "device_cumulative_m";
  time_basis: "clock_elapsed_seconds";
  total_distance_m: number;
  total_clock_elapsed_s: number;
  accepted_samples: number;
  excluded_samples: number;
  quality_flags: string[];
  segments: Segment[];
};
type Point = PreviewSample;
const round = (x: number, places=3) => Number(x.toFixed(places));
const ok = (n: number | null): n is number => n !== null && Number.isFinite(n);
const metricSpecs = [
  ["heart_rate","heartRate","bpm"] as const,
  ["cadence","stepsPerMinute","steps/minute as provided"] as const,
  ["power","powerInWatts","W"] as const,
];
function acceptedSensor(field: string, value: number | null): value is number {
  if (!ok(value)) return false;
  // Zero heart rate is not a physiological reading, often an optical dropout.
  if (field === "heartRate") return value > 0;
  // Cadence/power zero can be valid pauses; preserve raw value.
  return value >= 0;
}
/** Nonthrowing result; caller must treat failure as optional-analysis skip. */
export function summarizeRace(samples: readonly Point[]): {ok:true; summary:Summary} | {ok:false; reason:string} {
  try {
    if (!Array.isArray(samples) || samples.length < 2 || samples.length > 20000) return {ok:false,reason:"invalid_size"};
    const clean: Point[] = [], globalFlags = new Set<string>();
    let excluded=0;
    // invalid_sample: missing/non-finite/negative required sample field.\n    // nonmonotonic_samples: finite distance or timestamp decreases.\n    // plateau_or_equal_time: repeated distance or timestamp.\n    let excluded=0;
    for (const p of samples) {
      if (!p || !ok(p.startTimeInSeconds) || !ok(p.totalDistanceInMeters) || p.totalDistanceInMeters < 0) {
        excluded++; globalFlags.add("invalid_sample"); continue;
      }
      const prev=clean.at(-1);
      if (prev && (p.startTimeInSeconds < prev.startTimeInSeconds || p.totalDistanceInMeters < prev.totalDistanceInMeters)) {
        excluded++; globalFlags.add("nonmonotonic_samples"); continue;
      }
      if (prev && (p.startTimeInSeconds === prev.startTimeInSeconds || p.totalDistanceInMeters === prev.totalDistanceInMeters)) {
        excluded++; globalFlags.add("plateau_or_equal_time"); continue;
      }
      clean.push(p);
    }
    if (clean.length < 2) return {ok:false,reason:"insufficient_samples"};
    const base = clean[0].totalDistanceInMeters, end = clean.at(-1)!.totalDistanceInMeters;
    const distance = end-base;
    if (!(distance > 0) || distance > 250000) return {ok:false,reason:"invalid_distance"};
    const timeAt = (d:number):number => {
      if(d<=base)return clean[0].startTimeInSeconds;
      if(d>=end)return clean.at(-1)!.startTimeInSeconds;
      let low=1, high=clean.length-1;
      while(low<high){const mid=Math.floor((low+high)/2);if(clean[mid].totalDistanceInMeters < d)low=mid+1;else high=mid;}
      const a=clean[low-1], b=clean[low];
      return a.startTimeInSeconds+(b.startTimeInSeconds-a.startTimeInSeconds)*(d-a.totalDistanceInMeters)/(b.totalDistanceInMeters-a.totalDistanceInMeters);
    };
    // 1km boundaries are relative to the first captured distance sample.
    const boundaries=[base];
    for(let d=base+1000;d<end;d+=1000)boundaries.push(d);
    boundaries.push(end);
    const segments:Segment[]=[];
    for(let i=0;i<boundaries.length-1;i++){
      const start=boundaries[i], stop=boundaries[i+1], span=stop-start;
      const metrics={} as Segment["metrics"];
      const flags:string[]=[];
      for(const [label,source,unit] of metricSpecs){
        let weightedSum=0, covered=0;
        for(let j=1;j<clean.length;j++){
          const a=clean[j-1], b=clean[j], left=Math.max(start,a.totalDistanceInMeters),right=Math.min(stop,b.totalDistanceInMeters);
          if(right<=left)continue;
          const av=a[source],bv=b[source];
          if(!acceptedSensor(source,av) || !acceptedSensor(source,bv))continue;
          const width=b.totalDistanceInMeters-a.totalDistanceInMeters;
          const x=(left-a.totalDistanceInMeters)/width, y=(right-a.totalDistanceInMeters)/width;
          weightedSum+=(av+(bv-av)*x+av+(bv-av)*y)*0.5*(right-left);
          covered+=right-left;
        }
        const coverage=Math.max(0,Math.min(1,covered/span));
        const mean=covered>0 && coverage>=0.8 ? round(weightedSum/covered,2) : null;
        if (coverage < 0.8) flags.push("sensor_missing");
        metrics[label]={source_field:source,raw_unit:unit,aggregation_method:"distance_weighted_linear",
          covered_distance_m:round(covered),coverage_fraction:round(coverage,5),mean_raw_value:mean};
      }
      if(span<1000-1e-6)flags.push("partial_segment");
      segments.push({segment_index:i+1,start_m:round(start-base),end_m:round(stop-base),
        distance_m:round(span),clock_elapsed_s:round(timeAt(stop)-timeAt(start)),
        quality_flags:[...new Set(flags)],metrics});
    }
    return {ok:true, summary:{analysis_version:"garmin-activity-details-v1",distance_basis:"device_cumulative_m",
      time_basis:"clock_elapsed_seconds",total_distance_m:round(distance),
      total_clock_elapsed_s:round(clean.at(-1)!.startTimeInSeconds-clean[0].startTimeInSeconds),
      accepted_samples:clean.length,excluded_samples:excluded,quality_flags:[...globalFlags].sort(),segments}};
  }catch{return {ok:false,reason:"invalid_samples"};}
}
