#!/usr/bin/env node
'use strict';
// Synthetic-only method A sizing; NO real owner records, API, network, or storage.
const assert=require('node:assert/strict');
const zlib=require('node:zlib');
const DIST=['municipalityDistance','prefectureDistance','countryDistance','regionDistance','admin1Distance','admin2Distance'];
const COUNT=['municipalityRunCount','prefectureRunCount','countryRunCount','regionRunCount','admin1RunCount','admin2RunCount'];
const BAGS=[...DIST,...COUNT];
function period(type,year=null,month=null){
 assert(['all','year','month'].includes(type));
 if(type==='all'){assert(year===null&&month===null);return 'all';}
 assert(Number.isInteger(year)&&year>=2000&&year<=2100);
 if(type==='year'){assert(month===null);return 'y:'+year;}
 assert(Number.isInteger(month)&&month>=1&&month<=12);
 return 'm:'+year+'-'+String(month).padStart(2,'0');
}
function bag(input,label){
 assert(input&&typeof input==='object'&&!Array.isArray(input),label);
 const out=Object.create(null);
 for(const [key,v] of Object.entries(input)){
  assert(key.length>0&&key.length<=180&&!['__proto__','prototype','constructor'].includes(key),'invalid category key');
  assert(typeof v==='number'&&Number.isFinite(v)&&v>=0,'invalid category value');
  out[key]=v;
 }
 return out;
}
function project(stats,scope){
 assert(typeof stats.totalDistanceKm==='number'&&Number.isFinite(stats.totalDistanceKm)&&stats.totalDistanceKm>=0);
 assert(Array.isArray(stats.activities));
 const obj={schema:'atlas-a-SYNTHETIC-0',scope,totalDistanceKm:stats.totalDistanceKm,runCount:stats.activities.length};
 for(const key of BAGS)obj[key]=bag(stats[key]||{},key);
 const domestic=Object.values(obj.municipalityDistance).filter(n=>n>0.01).length;
 const overseas=Object.values(obj.admin2Distance).filter(n=>n>0.01).length;
 const unknown=!overseas&&Object.values(obj.countryDistance).some(n=>n>0.01)&&Object.keys(obj.admin1Distance).length>0;
 obj.regions=unknown&&!domestic?'—':domestic+overseas;
 assert.deepEqual(Object.keys(obj),['schema','scope','totalDistanceKm','runCount',...BAGS,'regions']);
 return obj;
}
function fixture(n){
 assert(Number.isInteger(n)&&n>=0&&n<=20000);
 const s={activities:Array.from({length:n},(_,i)=>({id:'SYNTHETIC:'+i,route:'NEVER_EXPORT',user_id:'NEVER_EXPORT'})),
 totalDistanceKm:5.25*n,ringCells:{gps:'NEVER_EXPORT'},activityCellIndex:new Map()};
 for(const k of BAGS)s[k]={};
 for(let i=0;i<n;i++){
  const city='仮県'+Math.floor(i/480)+'|仮市'+Math.floor(i/12);
  const pref='仮県'+Math.floor(i/480),country=i%9===0?'ZZZ':'JPN';
  const adm1='ZZZ|ADM1|'+Math.floor(i/150),adm2='ZZZ|ADM2|'+Math.floor(i/150);
  for(const [k,v] of [
   ['municipalityDistance',city],['prefectureDistance',pref],['countryDistance',country],
   ['regionDistance',adm1],['admin1Distance',adm1],['admin2Distance',adm2]])
    s[k][v]=(s[k][v]||0)+5.25;
  for(const [k,v] of [
   ['municipalityRunCount',city],['prefectureRunCount',pref],['countryRunCount',country],
   ['regionRunCount',adm1],['admin1RunCount',adm1],['admin2RunCount',adm2]])
    s[k][v]=(s[k][v]||0)+1;
 }
 return s;
}
function size(label,stats,scope){
 const body=JSON.stringify(project(stats,scope));
 assert(!/NEVER_EXPORT|SYNTHETIC:\d|user_id|latlngs|ringCells|activityCellIndex|auth_token/.test(body),'private raw data leaked');
 return {label,syntheticRuns:stats.activities.length,scope,jsonBytes:Buffer.byteLength(body,'utf8'),gzipBytes:zlib.gzipSync(Buffer.from(body)).byteLength,
  regionalEntries:BAGS.reduce((acc,k)=>acc+Object.keys(stats[k]).length,0)};
}
function run(){
 assert.equal(period('all'),'all');
 assert.equal(period('year',2026),'y:2026');
 assert.equal(period('month',2026,11),'m:2026-11');
 for(const v of [['all',2026,null],['year',2026,11],['month',2026,0],['month',2026,13],['month','2026',11]])
  assert.throws(()=>period(...v));
 const rows=[0,12,100,500,1843,5000,10000].map(n=>size('SYNTHETIC all',fixture(n),period('all')));
 for(const [type,y,m,n] of [['year',2025,null,500],['year',2026,null,600],['month',2026,10,60],['month',2026,11,50]])
  rows.push(size('SYNTHETIC '+type,fixture(n),period(type,y,m)));
 assert.equal(project(fixture(0),period('all')).regions,0);
 const unknown=fixture(1);
 for(const k of ['municipalityDistance','municipalityRunCount','admin2Distance','admin2RunCount'])unknown[k]={};
 assert.equal(project(unknown,period('all')).regions,'—');
 const invalid=fixture(1);invalid.countryDistance={ZZZ:Infinity};
 assert.throws(()=>project(invalid,period('all')));
 console.log(JSON.stringify({test:'PASS synthetic-only',rows,limitations:[
  '1843-run fixture is artificially generated, not any real runner data.',
  'Cardinality and byte sizes do not predict actual regional distribution.',
  'No owner/cache storage or live data read or browser validation.',
  'Actual all/year/month size still requires a separate authorized in-memory measurement.'
 ]},null,2));
}
run();
