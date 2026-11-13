/**
 * Read-only, offline Garmin activityDetails shape inspection.
 * Never connects to Garmin or Supabase, uploads, saves or prints a raw sample.
 * Input: JSON file explicitly provided by operator (local only).
 * Usage: node scripts/inspect-garmin-activity-shape.mjs /path/to/consented.json
 * Output: aggregate counts of allowlisted field presence/types ONLY.
 * Do not put real activity payloads or resulting files in git.
 */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const LIMIT = 8_000_000;
const FIELDS = ['startTimeInSeconds', 'totalDistanceInMeters', 'heartRate', 'heartrate', 'stepsPerMinute', 'powerInWatts', 'latitudeInDegree', 'longitudeInDegree'];
const typeOf = value => typeof value === 'number' && Number.isFinite(value) ? 'finite_number'
  : value === null ? 'null' : typeof value === 'number' ? 'nonfinite_number'
  : Array.isArray(value) ? 'array' : typeof value;
const isObject = x => x && typeof x === 'object' && !Array.isArray(x);
const emptyField = () => ({ present: 0, finite_number: 0, null: 0, other_type: 0 });
const fresh = () => Object.fromEntries(FIELDS.map(f => [f, emptyField()]));

export function inspectActivityShape(payload) {
  const entries = Array.isArray(payload) ? payload
    : isObject(payload) && Array.isArray(payload.activityDetails) ? payload.activityDetails
    : isObject(payload) && Array.isArray(payload.samples) ? [payload] : null;
  if (!entries || entries.length === 0 || entries.length > 100) return {ok:false,reason:'invalid_activity_details'};
  const out = {ok:true, activities:entries.length, sampleCount:0, fields:fresh(),
    activitiesWithSamples:0, activitiesWithoutSamples:0, sampleNonObject:0,
    duplicateHeartRateAlias:0, missingRequiredPair:0};
  for (const entry of entries) {
    if (!isObject(entry)) return {ok:false,reason:'invalid_activity'};
    if (!Array.isArray(entry.samples)) {out.activitiesWithoutSamples++;continue;}
    out.activitiesWithSamples++;
    if (entry.samples.length > 20000) return {ok:false,reason:'too_many_samples'};
    out.sampleCount += entry.samples.length;
    if (out.sampleCount > 20000) return {ok:false,reason:'too_many_samples'};
    for (const sample of entry.samples) {
      if (!isObject(sample)) {out.sampleNonObject++;continue;}
      if (Object.hasOwn(sample,'heartRate') && Object.hasOwn(sample,'heartrate')) out.duplicateHeartRateAlias++;
      const timeValid = typeof sample.startTimeInSeconds === 'number' && Number.isFinite(sample.startTimeInSeconds);
      const distanceValid = typeof sample.totalDistanceInMeters === 'number' && Number.isFinite(sample.totalDistanceInMeters);
      if (!timeValid || !distanceValid) out.missingRequiredPair++;
      for (const field of FIELDS) {
        if (!Object.hasOwn(sample,field)) continue;
        const stats=out.fields[field];stats.present++;
        const kind=typeOf(sample[field]);
        if (kind === 'finite_number')stats.finite_number++;
        else if (kind === 'null')stats.null++;
        else stats.other_type++;
      }
    }
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw Error('usage: node scripts/inspect-garmin-activity-shape.mjs <local-json-file>');
    const stat = await (await import('node:fs/promises')).stat(process.argv[2]);
    if (!stat.isFile() || stat.size > LIMIT) throw Error('input_must_be_a_file_up_to_8MB');
    const payload=JSON.parse(await readFile(process.argv[2],'utf8'));
    const report=inspectActivityShape(payload);
    console.log(JSON.stringify(report,null,2));
    if (!report.ok)process.exitCode=1;
  }catch(e) {
    console.error('inspection_failed:', e instanceof SyntaxError ? 'invalid_json' : e.message === 'input_must_be_a_file_up_to_8MB' ? e.message : 'invalid_input');
    process.exitCode=1;
  }
}
