'use strict';
// Live anonymous HTTP smoke of PR #206's two READ-ONLY monthly ranking RPCs.
// Only aggregated PASS/FAIL facts are logged; no names, countries, distances,
// region names, credentials, request bodies or JSON response data in CI logs.
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const html=fs.readFileSync('ranking.html','utf8');
 const m=html.match(/createClient\('([^']+)',\s*'(sb_publishable_[^']+)'/);
 assert.ok(m,'Missing public client config');
 const [,base,key]=m;
 assert.equal(new URL(base).hostname,'fhwvntpzwyenendhcgbw.supabase.co');
 const samples=[
  ['ranking_distance_month_places',{p_year:2025,p_month:1},'distance_2025_01'],
  ['ranking_distance_month_places',{p_year:2026,p_month:11},'distance_2026_11'],
  ['ranking_explore_month_places',{p_year:2025,p_country:'JP',p_month:1},'explore_2025_01'],
  ['ranking_explore_month_places',{p_year:2026,p_country:'JP',p_month:11},'explore_2026_11']
 ];
 for(const [rpc,args,label] of samples){
  const resp=await fetch(base+'/rest/v1/rpc/'+rpc,{
   method:'POST',redirect:'error',
   headers:{apikey:key,'Content-Type':'application/json',Accept:'application/json'},
   body:JSON.stringify(args),signal:AbortSignal.timeout(20000)
  });
  assert.equal(resp.status,200,label+': HTTP non-200: '+resp.status);
  assert.match(resp.headers.get('content-type')||'',/application\/json/);
  const raw=await resp.text();
  assert.ok(raw.length<1048576,label+': oversized response');
  const data=JSON.parse(raw);
  assert.ok(Array.isArray(data),label+': non-array');
  assert.ok(data.length>0&&data.length<=100,label+': expected nonempty <=100');
  data.forEach((r,i)=>{
   assert.equal(Number(r.place),i+1,label+': place ordering');
   assert.ok(Array.isArray(r.badge_codes),label+': badge_codes type');
   if(!r.show_flag)assert.equal(r.country,null,label+': private flag country');
   if(rpc==='ranking_distance_month_places'){
    assert.ok(Object.hasOwn(r,'km')&&Object.hasOwn(r,'month_km'),label+': missing fields');
    assert.equal(r.km,r.month_km,label+': distance total/current mismatch');
    assert.ok(r.km===null||typeof r.km==='number',label+': km type');
   }else{
    assert.equal(r.regions,r.month_regions,label+': region total/current mismatch');
    assert.ok(Array.isArray(r.region_names),label+': region_names type');
    if(!r.show_regions||r.regions===null)assert.equal(r.region_names.length,0,label+': private region names');
   }
  });
  console.log('PASS anonymous HTTP '+label+': nonempty response, ranking and disclosure contracts');
 }
 console.log('PASS 4/4 anonymous live HTTP probes. Authenticated HTTP not tested. NATIONS monthly RPC not contacted.');
})().catch(e=>{console.error('FAIL live anonymous HTTP contract: '+e.message);process.exit(1);});
