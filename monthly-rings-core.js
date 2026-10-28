/* Runner's Rings — Monthly Rings A-1 data core (2026-10-28)
 * Pure calculations. No background jobs, remote requests, or user-data persistence.
 * The hosting page supplies *current* activities on each invocation.
 */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RunnerMonthlyRings = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';
  function parseMonth(value) {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(value || ''));
    if (!match) throw new TypeError('Expected YYYY-MM');
    return {year:Number(match[1]), month:Number(match[2])};
  }
  function shiftMonth(value, delta) {
    const {year, month} = parseMonth(value);
    const date = new Date(year, month - 1 + delta, 1);
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2,'0');
  }
  function validDate(activity) {
    const value = activity?.date ?? activity?.startedAt;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  function forMonth(activity, month) {
    const date = validDate(activity);
    if (!date) return false;
    const parsed = parseMonth(month);
    return date.getFullYear() === parsed.year && date.getMonth() + 1 === parsed.month;
  }
  function monthSummary(input, month) {
    parseMonth(month);
    const runs = (Array.isArray(input) ? input : []).filter(a => forMonth(a, month));
    const distanceKm = runs.reduce((total,a) => {
      const value = Number(a?.distance);
      return total + (Number.isFinite(value) && value > 0 ? value : 0);
    },0);
    const withGps = runs.filter(a => Array.isArray(a?.latlngs) && a.latlngs.length >= 2);
    return {month,runCount:runs.length,distanceKm,withGpsCount:withGps.length,runs,withGps};
  }
  function compare(input, month) {
    const current = monthSummary(input, month);
    const previous = monthSummary(input, shiftMonth(month,-1));
    const priorYear = monthSummary(input, shiftMonth(month,-12));
    return {current,previous,priorYear,
      previousDelta:{runs:current.runCount-previous.runCount,km:current.distanceKm-previous.distanceKm},
      priorYearDelta:{runs:current.runCount-priorYear.runCount,km:current.distanceKm-priorYear.distanceKm}
    };
  }
  // A route visualization should use all three sets of coordinates in the same projection.
  // Accepts Leaflet-style [lat,lng] arrays or {lat,lng} objects; excludes invalid positions.
  function toRoute(activity) {
    if (!Array.isArray(activity?.latlngs)) return [];
    return activity.latlngs.map(p => Array.isArray(p)
      ? [Number(p[0]),Number(p[1])]
      : [Number(p?.lat),Number(p?.lng ?? p?.lon)]
    ).filter(p => p.every(Number.isFinite) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180);
  }
  function series(input,month) {
    const data = compare(input,month);
    return [
      {key:'current',month:data.current.month,runCount:data.current.runCount,distanceKm:data.current.distanceKm,routes:data.current.withGps.map(toRoute).filter(a=>a.length>=2)},
      {key:'previous',month:data.previous.month,runCount:data.previous.runCount,distanceKm:data.previous.distanceKm,routes:data.previous.withGps.map(toRoute).filter(a=>a.length>=2)},
      {key:'priorYear',month:data.priorYear.month,runCount:data.priorYear.runCount,distanceKm:data.priorYear.distanceKm,routes:data.priorYear.withGps.map(toRoute).filter(a=>a.length>=2)}
    ];
  }
  return Object.freeze({parseMonth,shiftMonth,monthSummary,compare,toRoute,series});
});
