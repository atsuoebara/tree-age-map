/**
 * Optional, *pure*, in-memory shape counts for an explicit, one-shot probe.
 * NO I/O, logs, storage, identifiers, coordinates, timestamps or sensor values in output.
 * NOT imported by the production Garmin receiver.
 */
const FIELDS = Object.freeze([
  'startTimeInSeconds', 'totalDistanceInMeters', 'heartRate', 'heartrate',
  'stepsPerMinute', 'powerInWatts'
]);
const finite = x => typeof x === 'number' && Number.isFinite(x);
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const counts = () => ({present:0,number:0,null:0,other:0});

export function countGarminSampleShape(input, {maxActivities=100,maxSamples=20000}={}) {
  try {
    if (!Number.isSafeInteger(maxActivities) || maxActivities<1 ||
        !Number.isSafeInteger(maxSamples) || maxSamples<1) return {ok:false,reason:'invalid_limits'};
    const details = Array.isArray(input?.activityDetails) ? input.activityDetails : null;
    if (!details || details.length<1 || details.length>maxActivities) return {ok:false,reason:'invalid_activities'};
    const result={ok:true,activityCount:details.length,sampleCount:0,
      noSamples:0,nonObjectSamples:0,missingTimeDistancePair:0,
      bothHeartRateNames:0, fields:Object.fromEntries(FIELDS.map(name=>[name,counts()]))};
    for (const activity of details) {
      if(!object(activity))return {ok:false,reason:'invalid_activity'};
      const arr=activity.samples;
      if(!Array.isArray(arr)) {result.noSamples++;continue;}
      if(arr.length>maxSamples-result.sampleCount) return {ok:false,reason:'too_many_samples'};
      result.sampleCount+=arr.length;
      for(const sample of arr) {
        if(!object(sample)){result.nonObjectSamples++;continue;}
        if(!finite(sample.startTimeInSeconds) || !finite(sample.totalDistanceInMeters)) result.missingTimeDistancePair++;
        if(Object.hasOwn(sample,'heartRate') && Object.hasOwn(sample,'heartrate'))result.bothHeartRateNames++;
        for(const key of FIELDS) {
          if(!Object.hasOwn(sample,key))continue;
          const tally=result.fields[key];tally.present++;
          if(finite(sample[key]))tally.number++;
          else if(sample[key]===null)tally.null++;
          else tally.other++;
        }
      }
    }
    return result;
  } catch {
    return {ok:false,reason:'inspection_unavailable'};
  }
}
