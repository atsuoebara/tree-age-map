#!/usr/bin/env node
'use strict';
// Synthetic-only equivalence gate. Executes the current source function,
// NOT a copy of the production aggregation algorithm.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const repoRoot = path.resolve(__dirname, '../..');
const indexPath = path.join(repoRoot, 'index.html');
const index = fs.readFileSync(indexPath, 'utf8');
function extractFunction(name) {
  const begin = index.indexOf('function ' + name + '(');
  assert.notEqual(begin, -1, 'missing source function: ' + name);
  const open = index.indexOf('{', begin);
  assert(open >= 0, 'missing function body: ' + name);
  // Source functions under test have no unbalanced JS template/string braces.
  // Ensure the extracted function compiles, and fail closed on source changes.
  let level = 0, end = -1;
  for (let i = open; i < index.length; i++) {
    if (index[i] === '{') level++;
    if (index[i] === '}') {
      level--;
      if (level === 0) { end = i + 1; break; }
    }
  }
  assert(end > open, 'unclosed function: ' + name);
  const result = index.slice(begin, end);
  assert(!result.includes('document.') && !result.includes('fetch('),
    'unexpected browser/network side effect in ' + name);
  return result;
}
const funcs = [
  'splitCityKey','splitWorldAdminKey','getSelectedActivities',
  'getSelectedStatsCacheKey','buildSelectedStats'
];
const source = funcs.map(extractFunction).join('\n');
const fingerprint = crypto.createHash('sha256').update(source).digest('hex');
// Explicit contract: if the logic changes materially, review fixed expectations.
const aggregation = extractFunction('buildSelectedStats');
for (const fragment of [
  'const selected =','getSelectedActivities()',
  'activity.countryDistances','activity.regionDistances',
  'activity.admin1Distances','activity.admin2Distances',
  'activity.cityDistances','activity.cities','totalDistanceKm'
]) assert(aggregation.includes(fragment), 'source contract changed: ' + fragment);

// Every record below is entirely synthetic. The city distances in the first
// row model a preclassified route crossing a city boundary (3+2 = 5 km).
const activities = [
  {id:'syn-1',year:2026,date:'2026-11-01',distance:5,
   countryDistances:{JPN:5},regionDistances:{},admin1Distances:{},admin2Distances:{},
   cityDistances:{'P1|C1':3,'P1|C2':2},cities:['P1|C1','P1|C2']},
  {id:'syn-2',year:2026,date:'2026-11-01',distance:2,
   countryDistances:{JPN:2},regionDistances:{},admin1Distances:{},admin2Distances:{},
   cityDistances:{'P1|C1':2},cities:['P1|C1']},
  {id:'syn-3',year:2025,date:'2025-06-01',distance:4,
   countryDistances:{USA:4},regionDistances:{'USA|ADM1|CA':4},
   admin1Distances:{'USA|ADM1|CA':4},admin2Distances:{'USA|ADM2|SF':4},
   cityDistances:{},cities:[]},
  {id:'syn-4',year:2026,date:'2026-10-01',distance:1,
   countryDistances:{USA:1},regionDistances:{'USA|ADM1|WA':1},
   admin1Distances:{'USA|ADM1|WA':1},admin2Distances:{},
   cityDistances:{},cities:[]}
];
const fixtureCases = [
  {name:'ALL',year:'ALL',month:'ALL',expected:{
    km:12,runs:4,regions:3,
    countryDistance:{JPN:7,USA:5},countryRunCount:{JPN:2,USA:2},
    municipalityDistance:{'P1|C1':5,'P1|C2':2},
    municipalityRunCount:{'P1|C1':2,'P1|C2':1},
    prefectureDistance:{P1:7},prefectureRunCount:{P1:2},
    admin1Distance:{'USA|ADM1|CA':4,'USA|ADM1|WA':1},
    admin2Distance:{'USA|ADM2|SF':4}}},
  {name:'YEAR_2026',year:'2026',month:'ALL',expected:{
    km:8,runs:3,regions:2,
    countryDistance:{JPN:7,USA:1},countryRunCount:{JPN:2,USA:1},
    municipalityDistance:{'P1|C1':5,'P1|C2':2},
    municipalityRunCount:{'P1|C1':2,'P1|C2':1},
    prefectureDistance:{P1:7},prefectureRunCount:{P1:2},
    admin1Distance:{'USA|ADM1|WA':1},admin2Distance:{}}},
  {name:'MONTH_2026_11',year:'2026',month:'11',expected:{
    km:7,runs:2,regions:2,
    countryDistance:{JPN:7},countryRunCount:{JPN:2},
    municipalityDistance:{'P1|C1':5,'P1|C2':2},
    municipalityRunCount:{'P1|C1':2,'P1|C2':1},
    prefectureDistance:{P1:7},prefectureRunCount:{P1:2},
    admin1Distance:{},admin2Distance:{}}},
  {name:'UNKNOWN_ADM2_2026_10',year:'2026',month:'10',expected:{
    km:1,runs:1,regions:'—',
    countryDistance:{USA:1},countryRunCount:{USA:1},
    municipalityDistance:{},municipalityRunCount:{},
    prefectureDistance:{},prefectureRunCount:{},
    admin1Distance:{'USA|ADM1|WA':1},admin2Distance:{}}},
  {name:'ZERO_2024_12',year:'2024',month:'12',expected:{
    km:0,runs:0,regions:0,
    countryDistance:{},countryRunCount:{},
    municipalityDistance:{},municipalityRunCount:{},
    prefectureDistance:{},prefectureRunCount:{},
    admin1Distance:{},admin2Distance:{}}}
];
// This is the existing UI's defined regions rule, checked against the
// *source text* and evaluated only on stats yielded by buildSelectedStats.
assert(index.includes('const hasOverseasRunsWithoutAdmin2 ='), 'region unknown guard removed');
assert(index.includes("stats.admin2Distance ||"), 'ADM2 source rule missing');
function existingRegionCount(stats) {
  const domestic = Object.values(stats.municipalityDistance).filter(km => km > 0.01).length;
  const overseas = Object.values(stats.admin2Distance || {}).filter(km => km > 0.01).length;
  const unknown = !overseas &&
    Object.values(stats.countryDistance || {}).some(km => km > 0.01) &&
    Object.keys(stats.admin1Distance || {}).length > 0;
  return unknown && !domestic ? '—' : domestic + overseas;
}
function toPlain(value) {return JSON.parse(JSON.stringify(value));}
function snapshot(stats) {
  // Candidate A shape for synthetic SIZE ONLY, not a production schema.
  const names = [
    'countryDistance','countryRunCount','municipalityDistance',
    'municipalityRunCount','prefectureDistance','prefectureRunCount',
    'regionDistance','regionRunCount','admin1Distance','admin1RunCount',
    'admin2Distance','admin2RunCount'
  ];
  const output = {totalDistanceKm:stats.totalDistanceKm,runCount:stats.activities.length};
  for(const name of names) output[name]=toPlain(stats[name]);
  output.regionCount=existingRegionCount(stats);
  return output;
}
const results=[];
for (const test of fixtureCases) {
  const scope = {activities,selectedYear:test.year,selectedMonth:test.month,
    selectedStatsCache:new Map(),shouldPrepareRouteCells:()=>false,
    getOrBuildActivityCells:()=>{throw Error('unexpected route-cell side effect')},
    Map,Set,Date};
  vm.createContext(scope,{name:'atlas-synthetic-aggregate'});
  vm.runInContext(source,scope,{filename:'index.html (extracted aggregate)',timeout:3000});
  const stats=vm.runInContext('buildSelectedStats()',scope,{timeout:3000});
  assert.equal(stats.totalDistanceKm,test.expected.km,test.name+' distance');
  assert.equal(stats.activities.length,test.expected.runs,test.name+' run count');
  assert.equal(existingRegionCount(stats),test.expected.regions,test.name+' regions');
  for(const key of Object.keys(test.expected).filter(k=>typeof test.expected[k]==='object')) {
    assert.deepEqual(toPlain(stats[key]),test.expected[key],test.name+' '+key);
  }
  const snap=snapshot(stats);
  assert(!JSON.stringify(snap).includes('syn-'), 'row ID leaked into candidate snapshot');
  const bytes=Buffer.byteLength(JSON.stringify(snap),'utf8');
  results.push({case:test.name,passed:true,bytes,runCount:snap.runCount,
    regionCount:snap.regionCount});
}
console.log(JSON.stringify({sourceSha256:fingerprint,source:'index.html buildSelectedStats (live extraction)',
  fixture:'synthetic only',cases:results,notes:[
    'Source function is run directly from index.html; not copied or rewritten.',
    'Input city/admin distances are preclassified synthetic values; this does NOT test GPS boundary intersection.',
    'Snapshot sizes are synthetic only; real all-period byte measurement remains open.',
    'No live account, network, browser storage, DB, or production data used.'
  ]},null,2));
