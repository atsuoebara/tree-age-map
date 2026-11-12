'use strict';
// Pure adapter for PR #69 split-card shape into audited PR #86 input.
// No inference from HR/cadence/power completeness: elapsed split quality must be explicit.
function parseElapsed(text){
 if(typeof text!=='string'||!/^\d{2}:\d{2}(?::\d{2})?$/.test(text))return null;
 const parts=text.split(':').map(Number);
 if(parts.slice(1).some(n=>n>=60))return null;
 const seconds=parts.reduce((sum,n)=>sum*60+n,0);
 return Number.isSafeInteger(seconds)&&seconds>0?seconds:null;
}
function adaptRaceSegments(segments){
 if(!Array.isArray(segments))return {splits:[null]};
 const splits=[];
 for(let i=0;i<segments.length;i++){
  const s=segments[i];
  if(!s||typeof s!=='object'||Array.isArray(s))return {splits:[null]};
  const distanceKm=s.partial===true?Number(s.distanceKm):Number(s.distanceKm);
  const seconds=parseElapsed(s.elapsed);
  if(!Number.isFinite(distanceKm)||distanceKm<=0||seconds===null)return {splits:[null]};
  if(s.partial===true){
   if(i!==segments.length-1||distanceKm>=1)return {splits:[null]};
   splits.push({distanceKm,elapsedSeconds:seconds,qualityOk:s.elapsedQualityOk===true});
  }else{
   if(distanceKm!==1)return {splits:[null]};
   // fail closed unless elapsed quality is explicitly confirmed
   splits.push({distanceKm:1,elapsedSeconds:seconds,qualityOk:s.elapsedQualityOk===true});
  }
 }
 return {splits};
}
if(typeof module!=='undefined'&&module.exports)module.exports={parseElapsed,adaptRaceSegments};
