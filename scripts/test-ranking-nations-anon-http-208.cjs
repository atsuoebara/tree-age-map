'use strict';
// READ-ONLY live HTTP probe of an existing publicly callable RPC.
// No secrets, user identifiers, or returned data are logged.
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const html=fs.readFileSync('ranking.html','utf8');
 const m=html.match(/createClient\('([^']+)',\s*'(sb_publishable_[^']+)'/);
 assert.ok(m,'Expected public Supabase client config not found');
 const [,base,key]=m;
 assert.equal(new URL(base).hostname,'fhwvntpzwyenendhcgbw.supabase.co');
 const periods=[{p_year:2025,p_month:1},{p_year:2026,p_month:11}];
 let tested=0;
 for(const args of periods){
   const res=await fetch(base+'/rest/v1/rpc/ranking_nations_monthly',{
     method:'POST',redirect:'error',
     headers:{'apikey':key,'Content-Type':'application/json','Accept':'application/json'},
     body:JSON.stringify(args),signal:AbortSignal.timeout(15000)
   });
   if(!res.ok)throw Error('Anon HTTP status failed: '+res.status);
   const ct=res.headers.get('content-type')||'';
   assert.match(ct,/application\/json/);
   const raw=await res.text();
   assert.ok(raw.length<=1048576,'Unexpected oversized RPC response');
   const rows=JSON.parse(raw);
   assert.ok(Array.isArray(rows),'Not an array RPC response');
   assert.ok(rows.length<=1000,'Unexpected row count');
   for(const row of rows){
     assert.ok(row&&typeof row==='object'&&!Array.isArray(row));
     for(const col of ['place','country','participants','km','month_km'])
       assert.ok(Object.hasOwn(row,col),'Missing expected field: '+col);
     assert.equal(row.month_km,null,'month_km leak');
   }
   assert.ok(rows.length>0,'Inconclusive: no rows returned');
   tested++;
   console.log('PASS anon live HTTP: '+args.p_year+'-'+String(args.p_month).padStart(2,'0')+
     ' / nonempty JSON / all month_km null / annual columns present');
 }
 assert.equal(tested,periods.length);
 console.log('PASS '+tested+' nonempty anon-only RPC probes; authenticated user token NOT tested');
})().catch(e=>{console.error('FAIL anonymous live HTTP probe:',e.message);process.exit(1)});
