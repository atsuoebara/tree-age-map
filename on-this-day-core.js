/* Runner's Rings A-3 — On This Day (one year ago)
 * Local calendar dates, not UTC instants. Pure functions; no network or storage.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.RunnerOnThisDay=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  function pad(n){return String(n).padStart(2,'0')}
  function parseDay(value){
    if(typeof value!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value))return null;
    const [year,month,day]=value.split('-').map(Number);
    const d=new Date(year,month-1,day);
    if(d.getFullYear()!==year||d.getMonth()!==month-1||d.getDate()!==day)return null;
    return {year,month,day};
  }
  function formatDay(d){return d.year+'-'+pad(d.month)+'-'+pad(d.day)}
  function lastYearDay(today){
    const d=parseDay(today);
    if(!d)return null;
    // 29 February has no anniversary in a non-leap year: use 28 February.
    const day=d.month===2&&d.day===29?28:d.day;
    return formatDay({year:d.year-1,month:d.month,day});
  }
  function dateOf(run){
    const raw=run?.activity_date??run?.date;
    if(typeof raw==='string'&&parseDay(raw.slice(0,10)))return raw.slice(0,10);
    if(raw instanceof Date&&!isNaN(raw.getTime()))return formatDay({year:raw.getFullYear(),month:raw.getMonth()+1,day:raw.getDate()});
    return null;
  }
  function summarize(input,targetDay){
    if(!parseDay(targetDay))throw new TypeError('Expected YYYY-MM-DD');
    const runs=(Array.isArray(input)?input:[]).filter(r=>dateOf(r)===targetDay);
    const distanceKm=runs.reduce((sum,r)=>{
      const raw=r?.distance_km??r?.distance;
      const n=Number(raw);
      return sum+(Number.isFinite(n)&&n>0?n:0);
    },0);
    return {date:targetDay,runs,count:runs.length,distanceKm};
  }
  function compare(input,today){
    const previous=lastYearDay(today);
    if(!previous)throw new TypeError('Expected YYYY-MM-DD');
    return {today:summarize(input,today),lastYear:summarize(input,previous)};
  }
  return Object.freeze({parseDay,lastYearDay,dateOf,summarize,compare});
});
