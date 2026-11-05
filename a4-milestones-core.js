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
    let first=null;
    for(const p of route){
      if(!Array.isArray(p)||p.length<2)continue;
      const lat=Number(p[0]),lng=Number(p[1]);
      if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)continue;
      if(first===null){first=[lat,lng];continue;}
      // Two valid but identical positions are not evidence of a GPS route.
      if(lat!==first[0]||lng!==first[1])return true;
    }
    return false;
  }
  function validTime(value){
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(value))return null;
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
  // The production Strava sync v46 admits only Run, TrailRun, VirtualRun.
  // It may also link a filtered Strava activity to an existing row, keeping
  // that row's distance/route but setting source=strava and strava_id.
  // A linked row must therefore be disclosed as using saved distance/route.
  function verifiedImportedRun(row){
    if(!row)return false;
    if(row.source==='fit')return true;
    if(row.source!=='strava')return false;
    const id=row.strava_id;
    return (typeof id==='number'&&Number.isSafeInteger(id)&&id>0)
      ||(typeof id==='string'&&/^[1-9]\d*$/.test(id));
  }
  // Number milestones use the same verified saved-run population as A-4.
  // GPS is NOT required: indoor/route-less eligible running activities count.
  // A missing start time or invalid database ID cannot establish chronology.
  function numberedRunMilestones(rows,isVerifiedRunning,targets=null){
    if(!Array.isArray(rows))throw new TypeError('Expected array');
    if(typeof isVerifiedRunning!=='function')throw new TypeError('Running eligibility verifier required');
    if(targets!==null && (!Array.isArray(targets)||!targets.length||
       targets.some(n=>!Number.isSafeInteger(n)||n<1)||
       new Set(targets).size!==targets.length))throw new RangeError('Invalid milestone targets');
    const eligible=[];
    const ids=new Set();
    for(const row of rows){
      if(!row||row.deleted_at!=null||!isVerifiedRunning(row))continue;
      const id=Number(row.id),time=validTime(row.started_at);
      if(!Number.isSafeInteger(id)||id<=0||time===null)continue;
      // Fail closed for repeated IDs. Different saved IDs count separately.
      if(ids.has(id))throw new Error('Duplicate saved run ID in milestone input');
      ids.add(id);
      eligible.push({id,time,record:row});
    }
    eligible.sort((a,b)=>a.time-b.time||a.id-b.id);
    // Support veteran runners without a hard-coded last milestone.
    // Show 100, 500, 1000, then every 500 through the next future milestone.
    if(targets===null){
      targets=[100,500,1000];
      const next=Math.max(1500,Math.ceil((eligible.length+1)/500)*500);
      for(let n=1500;n<=next;n+=500)targets.push(n);
    }
    const records=Object.create(null);
    for(const target of targets)records[target]=eligible[target-1]?.record??null;
    return Object.freeze({eligibleCount:eligible.length,records:Object.freeze(records)});
  }
  // Preserve the approved 100th-run interface for all existing callers.
  function hundredthRun(rows,isVerifiedRunning){
    const data=numberedRunMilestones(rows,isVerifiedRunning,[100]);
    return Object.freeze({eligibleCount:data.eligibleCount,record:data.records[100]});
  }
  // P0: compare saved-row totals with milestone eligibility without changing
  // eligibility, persisting evidence or exposing individual run data.
  function eligibilityBreakdown(rows,isVerifiedRunning){
    if(!Array.isArray(rows))throw new TypeError('Expected array');
    if(typeof isVerifiedRunning!=='function')throw new TypeError('Running eligibility verifier required');
    const reasons=Object.create(null);
    let total=0,eligible=0;
    const ids=new Set();
    for(const row of rows){
      if(!row||row.deleted_at!=null)continue;
      // Match the existing A-4 count rules; never count or classify a row twice.
      const id=Number(row.id);
      if(!Number.isSafeInteger(id)||id<=0)throw new Error('Invalid saved run ID in breakdown');
      if(ids.has(id))throw new Error('Duplicate saved run ID in breakdown');
      ids.add(id);
      total++;
      const source=typeof row.source==='string'?row.source.trim().toLowerCase():'';
      let reason;
      if(!isVerifiedRunning(row)){
        if(source==='strava')reason='strava_unverified';
        else if(source==='tcx')reason='tcx';
        else if(source==='garmin')reason='garmin';
        else if(source==='intervals')reason='intervals';
        else if(!source)reason='unknown';
        else reason='other';
      }else if(validTime(row.started_at)===null)reason='invalid_start';
      else eligible++;
      if(reason)reasons[reason]=(reasons[reason]||0)+1;
    }
    return Object.freeze({total,eligible,excluded:total-eligible,reasons:Object.freeze(reasons)});
  }
  return Object.freeze({validRoute,first30km,verifiedImportedRun,hundredthRun,numberedRunMilestones,eligibilityBreakdown});
});
