#!/usr/bin/env node
'use strict';
// Synthetic-only route midpoint classifier checks against index.html.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const index=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
function extract(name){
 const at=index.indexOf('function '+name+'(');
 assert(at>=0,'missing source function '+name);
 const open=index.indexOf('{',at);let depth=0;
 for(let i=open;i<index.length;i++){
  if(index[i]==='{')depth++;
  if(index[i]==='}'&&--depth===0)return index.slice(at,i+1);
 }
 throw Error('unclosed '+name);
}
const functions=['distanceKm','pointInRing','pointInPolygon','pointInFeature',
 'getFeatureBBox','getPrefecture','getCity','getCityKey','getCountryCode',
 'getWorldAdminFeatureCode','getWorldAdminKey','findMunicipalityFeature',
 'findCountryFeature','findWorldAdminFeature','analyseRoute'];
const source=functions.map(extract).join('\n');
const sourceSha256=crypto.createHash('sha256').update(source).digest('hex');
assert(extract('analyseRoute').includes('midpointLon'));
assert(extract('analyseRoute').includes('findMunicipalityFeature'));
assert(extract('analyseRoute').includes('findWorldAdminFeature'));
function rectangle(west,east,name,properties={}){
 return {type:'Feature',properties:{N03_001:'Fake Prefecture',N03_004:name,...properties},
  geometry:{type:'Polygon',coordinates:[[
   [west,-1],[east,-1],[east,1],[west,1],[west,-1]
  ]]}};
}
const municipalities=[rectangle(-3,-1.5,'City A'),rectangle(-1.5,0,'City B')];
const countries=[rectangle(-3,0,'Japan',{iso3:'JPN'}),rectangle(0,3,'US',{iso3:'USA'})];
const adm1=[rectangle(0,3,'State',{region_code:'TEST-STATE'})];
const adm2=[rectangle(0,1.5,'District A',{code:'D1'}),rectangle(1.5,3,'District B',{code:'D2'})];
const scope={municipalityFeatures:[],countryFeatures:[],
 worldAdminFeatures:{USA:{ADM1:[],ADM2:[]}},Math,Number,Set,Object,Array};
vm.createContext(scope);
vm.runInContext(source,scope,{filename:'index.html extracted functions',timeout:5000});
const wrapped=arr=>arr.map(feature=>({feature,bbox:scope.getFeatureBBox(feature)}));
scope.municipalityFeatures=wrapped(municipalities);
scope.countryFeatures=wrapped(countries);
scope.worldAdminFeatures.USA.ADM1=wrapped(adm1);
scope.worldAdminFeatures.USA.ADM2=wrapped(adm2);
const coordinate=lon=>[0,lon];
const km=(from,to)=>scope.distanceKm(0,from,0,to);
function almost(actual,expected,label){
 assert(Math.abs(actual-expected)<1e-8,label+' actual '+actual+' expected '+expected);
}
function compare(actual,expected,label){
 const plain=JSON.parse(JSON.stringify(actual));
 assert.deepEqual(Object.keys(plain).sort(),Object.keys(expected).sort(),label+' keys');
 for(const [key,expectedValue] of Object.entries(expected))
  almost(plain[key],expectedValue,label+' '+key);
}
function verify(name,longitudes,groups,targetDistance=null,admin2Unavailable=false){
 const oldAdm2=scope.worldAdminFeatures.USA.ADM2;
 if(admin2Unavailable)scope.worldAdminFeatures.USA.ADM2=[];
 try{
  const result=scope.analyseRoute(longitudes.map(coordinate),targetDistance);
  const segments=longitudes.slice(1).map((v,i)=>km(longitudes[i],v));
  const total=segments.reduce((a,b)=>a+b,0);
  almost(result.calculatedKm,total,name+' calculatedKm');
  const selected=(indexes)=>indexes.reduce((v,i)=>v+segments[i],0);
  const countryExpected={};
  const ratio=targetDistance&&total>0?targetDistance/total:1;
  for(const [name,idxs] of Object.entries(groups.country||{}))
   countryExpected[name]=selected(idxs)*ratio;
  compare(result.countryDistances,countryExpected,name+' country');
  const cityExpected={};
  for(const [name,idxs] of Object.entries(groups.city||{}))
   cityExpected['Fake Prefecture|'+name]=selected(idxs)*ratio;
  compare(result.cityDistances,cityExpected,name+' municipality');
  const admin1Expected={},admin2Expected={};
  if(groups.country&&groups.country.USA)
   admin1Expected['USA|ADM1|TEST-STATE']=selected(groups.country.USA);
  for(const [name,idxs] of Object.entries(groups.adm2||{}))
   admin2Expected['USA|ADM2|'+name]=selected(idxs);
  compare(result.admin1Distances,admin1Expected,name+' ADM1');
  compare(result.admin2Distances,admin2Expected,name+' ADM2');
  compare(result.regionDistances,admin1Expected,name+' legacy region');
  return {case:name,pass:true,segments:segments.length,km:Number(total.toFixed(3))};
 }finally{scope.worldAdminFeatures.USA.ADM2=oldAdm2;}
}
const checks=[
 verify('CITY_BORDER',[-2.6,-1.8,-1.0,-0.2],{
  country:{JPN:[0,1,2]},city:{'City A':[0],'City B':[1,2]}}),
 verify('COUNTRY_AND_ADM2',[-0.9,-0.3,0.2,1.0,2.2,2.6],{
  country:{JPN:[0,1],USA:[2,3,4]},city:{'City B':[0,1]},
  adm2:{D1:[2],D2:[3,4]}}),
 verify('TARGET_SCALING',[-2.6,-1.8,-1.0,-0.2],{
  country:{JPN:[0,1,2]},city:{'City A':[0],'City B':[1,2]}},100),
 verify('ADM1_WITHOUT_ADM2',[0.2,0.5,0.8],{
  country:{USA:[0,1]},city:{},adm2:{}},null,true),
 verify('SINGLE_POINT',[0.2],{country:{},city:{},adm2:{}})
];
console.log(JSON.stringify({sourceSha256,synthetic:true,checks,
 limits:'Current function assigns each entire GPS segment by midpoint; it does NOT clip actual boundary crossings. No real geometry, no production data.'},null,2));
