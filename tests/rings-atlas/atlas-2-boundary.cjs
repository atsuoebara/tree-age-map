#!/usr/bin/env node
'use strict';
/**
 * Atlas-2 G2 synthetic route/boundary behavior test.
 * Runs REAL analyseRoute and its real geometry helpers from index.html.
 * NOTE: current algorithm allocates each ENTIRE segment to its midpoint.
 * This is not exact intersection clipping. The long-segment fixture makes
 * that limitation visible rather than claiming impossible equivalence.
 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const index=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const names=[
  'distanceKm','pointInRing','pointInPolygon','pointInFeature',
  'getFeatureBBox','getPrefecture','getCity','getCityKey',
  'getCountryCode','findCountryFeature','findMunicipalityFeature',
  'getWorldAdminFeatureCode','getWorldAdminKey','findWorldAdminFeature',
  'analyseRoute'
];
function extract(name){
  const marker='function '+name+'(';
  const a=index.indexOf(marker);
  assert(a>=0&&index.indexOf(marker,a+1)<0,'missing/duplicate source '+name);
  // This brace scanner works for the audited functions under test; reject a
  // changed source via syntax/behavior checks, do not substitute a reimplementation.
  const open=index.indexOf('{',a);let n=0,end=-1;
  for(let i=open;i<index.length;i++){if(index[i]==='{')n++;else if(index[i]==='}'&&!--n){end=i+1;break;}}
  assert(end>open,'unterminated '+name);
  return index.slice(a,end);
}
const source=names.map(extract).join('\n');
assert(extract('analyseRoute').includes('midpointLat')&&extract('analyseRoute').includes('midpointLon'),'midpoint classification contract changed');
assert(!source.includes('fetch(')&&!source.includes('document.'),'unexpected IO in source');
const bbox=(x0,x1,y0=0,y1=1)=>({minLon:x0,maxLon:x1,minLat:y0,maxLat:y1});
const rect=(x0,x1,properties={})=>({
 type:'Feature',properties,geometry:{type:'Polygon',coordinates:[[[x0,0],[x1,0],[x1,1],[x0,1],[x0,0]]]}
});
const wrap=(feature)=>({feature,bbox: {minLon:feature.geometry.coordinates[0][0][0],maxLon:feature.geometry.coordinates[0][1][0],minLat:0,maxLat:1}});
const municipalityFeatures=[
 wrap(rect(0,1,{N03_001:'P1',N03_004:'A'})),
 wrap(rect(1,2,{N03_001:'P1',N03_004:'B'})),
 wrap(rect(2,3,{N03_001:'P2',N03_004:'C'}))
];
const countryFeatures=[
 wrap(rect(4,6,{iso3:'USA'})),
 wrap(rect(6,8,{iso3:'CAN'}))
];
const worldAdminFeatures={
 USA:{ADM1:[wrap(rect(4,6,{shapeID:'US-ONE'}))],ADM2:[
  wrap(rect(4,5,{shapeID:'US-A'})),wrap(rect(5,6,{shapeID:'US-B'}))]},
 CAN:{ADM1:[wrap(rect(6,8,{shapeID:'CA-ONE'}))],ADM2:[]}
};
const sandbox={municipalityFeatures,countryFeatures,worldAdminFeatures,Math,Set,Object,Array,Number,String};vm.createContext(sandbox);
vm.runInContext(source,sandbox,{filename:'index.html extracted geometry',timeout:3000});
function checkApprox(actual,expected,label){assert(Math.abs(actual-expected)<1e-9,label+': '+actual+' vs '+expected);}
function route(lons,target=null){
 return vm.runInContext('analyseRoute('+JSON.stringify(lons.map(lon=>[0.5,lon]))+','+(target===null?'null':target)+')',sandbox,{timeout:3000});
}
function km(a,b){return vm.runInContext('distanceKm(0.5,'+a+',0.5,'+b+')',sandbox);}
const tests=[];
function run(name,check){check();tests.push({name,result:'PASS'});}
// Route sampled on each side; short transition is assigned WHOLE to its midpoint.
run('same-prefecture city boundary uses midpoint per segment',()=>{
 const res=route([0.25,0.75,1.4,1.75]);
 assert.deepEqual(Object.keys(res.cityDistances).sort(),['P1|A','P1|B']);
 checkApprox(res.cityDistances['P1|A'],km(.25,.75),'city A');
 checkApprox(res.cityDistances['P1|B'],km(.75,1.4)+km(1.4,1.75),'city B');
 checkApprox(res.countryDistances.JPN,res.calculatedKm,'Japan country');
 assert.deepEqual(Array.from(res.prefectures),['P1']);
});
run('prefecture boundary retains separate city/prefecture markers',()=>{
 const res=route([1.25,1.75,2.4,2.75]);
 assert.deepEqual(Object.keys(res.cityDistances).sort(),['P1|B','P2|C']);
 assert.deepEqual(Array.from(res.prefectures).sort(),['P1','P2']);
});
run('overseas country + ADM1/ADM2 crossing',()=>{
 const res=route([4.25,4.75,5.4,5.75]);
 assert.deepEqual(Object.keys(res.countryDistances),['USA']);
 assert.deepEqual(Object.keys(res.admin2Distances).sort(),['USA|ADM2|US-A','USA|ADM2|US-B']);
 checkApprox(res.admin1Distances['USA|ADM1|US-ONE'],res.calculatedKm,'overseas ADM1');
 checkApprox(res.regionDistances['USA|ADM1|US-ONE'],res.calculatedKm,'legacy region compatibility');
});
run('country border distributes segmented route to both countries',()=>{
 const res=route([5.25,5.75,6.4,6.75]);
 assert.deepEqual(Object.keys(res.countryDistances).sort(),['CAN','USA']);
 checkApprox(Object.values(res.countryDistances).reduce((a,b)=>a+b,0),res.calculatedKm,'countries total');
 assert.equal(res.admin2Distances['CAN|ADM2|CA-ONE'],undefined,'no fabricated ADM2');
});
run('unknown ADM2 stays absent, never manufactured',()=>{
 const res=route([6.25,6.75,7.25]);
 assert.deepEqual(Object.keys(res.admin1Distances),['CAN|ADM1|CA-ONE']);
 assert.equal(Object.keys(res.admin2Distances).length,0);
});
run('one long boundary-crossing segment is NOT exact clipped',()=>{
 const res=route([.25,1.75]);
 assert.equal(Object.keys(res.cityDistances).length,1,'current midpoint allocates whole long segment to one city');
 checkApprox(Object.values(res.cityDistances)[0],res.calculatedKm,'entire long segment attributed to midpoint');
 // Explicitly test the known limitation: do not treat as equal distance per area.
 assert.notEqual(Object.keys(res.cityDistances).length,2);
});
run('target distance scales city and country but NOT ADM1/ADM2',()=>{
 const baseline=route([4.25,4.75,5.4,5.75]);
 const res=route([4.25,4.75,5.4,5.75],10);
 checkApprox(res.countryDistances.USA,10,'country target scaled');
 checkApprox(res.admin1Distances['USA|ADM1|US-ONE'],baseline.calculatedKm,'ADM1 raw distance');
 checkApprox(res.admin2Distances['USA|ADM2|US-A']+res.admin2Distances['USA|ADM2|US-B'],baseline.calculatedKm,'ADM2 raw distance');
});
run('confirmed empty/one point no fabricated regions',()=>{
 const res=route([.25]);
 assert.equal(res.calculatedKm,0);
 assert.equal(Object.keys(res.countryDistances).length,0);
 assert.equal(Object.keys(res.cityDistances).length,0);
});
console.log(JSON.stringify({
 sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),
 source:'live index.html extracted analyseRoute and geometry helpers',fixture:'synthetic GeoJSON only',
 tests,pass:tests.length,scope:[
  'Current algorithm uses SEGMENT MIDPOINT assignment; NOT exact polygon intersection.',
  'Boundary-crossing synthetic geometry and country/ADM1/ADM2 paths verified.',
  'No real GPS, network, personal data, SQL, browser, production modification.',
  'No G0 Safari evidence; no candidate A real snapshot capacity measurement.'
 ]},null,2));
