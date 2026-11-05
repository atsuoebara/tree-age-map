/* A-4 milestone calculation prototype. No network, DB writes or UI.
 * The caller MUST verify a record is a running activity; the runs table
 * currently has no activity-type column, so never infer it from distance.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.RunnerMilestones=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  function validRoute(route){
    if(!Array.isArray(route))return false;
    let count=0;
    for(const p of route){
      if(!Array.isArray(p)||p.length<2)continue;
      const lat=Number(p[0]),lng=Number(p[1]);
      if(Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180)count++;
      if(count>=2)return true;
    }
    return false;
  }
  function validTime(value){
    if(typeof value!=='string'||!/^\\d{4}-\\d{2}-\\d{2}T/.test(value))return null;
    const ms=Date.parse(value);
    return Number.isFinite(ms)?ms:null;
  }
  function first30km(rows,isVerifiedRunning){
    if(!Array.isArray(rows))throw new TypeError('Expected array');
    if(typeof isVerifiedRunning!=='function')throw new TypeError('Running eligibility verifier required');
    let winner=null;
    for(const row of rows){
      if(!row||row.deleted_at!=null||!isVerifiedRunning(row))continue;
      const km=Number(row.distance_km),time=validTime(row.started_at);
      const id=Number(row.id);
      if(!Number.isFinite(km)||km<30||time===null||!Number.isSafeInteger(id)||id<=0||!validRoute(row.route))continue;
      if(winner===null||time<winner.time||(time===winner.time&&id<winner.id))winner={id,time,record:row};
    }
    return winner?.record??null;
  }
  return Object.freeze({validRoute,first30km});
});
