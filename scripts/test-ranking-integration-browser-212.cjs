'use strict';
// Synthetic-only browser smoke. No real Supabase/project connection, no real user records.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const html=fs.readFileSync('ranking.html','utf8');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const errors=[];
 const context=await browser.newContext({viewport:{width:375,height:812},locale:'ja-JP'});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',async route=>{
   const u=route.request().url();
   if(u.includes('/@supabase/supabase-js@2')){
     return route.fulfill({contentType:'application/javascript',body:`
       window.__rpcRequests=[];
       window.supabase={createClient:()=>({
         rpc:async(name,args)=>{
           window.__rpcRequests.push({name,args});
           const data=name==='ranking_years'?[{year:2026},{year:2025}]:
             name==='ranking_distance_monthly'?[{place:1,ranking_display_name:'Runner A',km:1250.4,month_km:82.3,badge_codes:[],show_flag:false},{place:2,ranking_display_name:null,km:null,month_km:null,badge_codes:[],show_flag:false}]:
             name==='ranking_explore_monthly'?[{place:1,regions:5,month_regions:2,show_regions:false,region_names:[],badge_codes:[]}]:
             name==='ranking_nations_monthly'?[{place:1,country:'JP',participants:1,km:310.1,month_km:310.1}]:
             (()=>{throw new Error('unexpected RPC: '+name)})();
           return {data,error:null};
         },
         auth:{getUser:async()=>({data:{user:null}})},
         from:()=>{throw Error('unexpected DB table access')}
       })};
     `});
   }
   if(u.startsWith('file:'))return route.continue();
   return route.fulfill({status:200,contentType:'text/plain',body:''});
 });
 // file URL avoids any external HTTP use. The Supabase JS SDK itself is replaced by a fixture.
 // Seed a previous release's sensitive nation-month cache before page startup.
 await page.addInitScript(()=>{
   localStorage.setItem('rr-public-ranking-v1:nations:2024:04',JSON.stringify({savedAt:Date.now(),data:[{country:'JP',month_km:98765.4}]}));
 });
 await page.goto('file://'+path.resolve('ranking.html'),{waitUntil:'domcontentloaded'});
 assert.equal(await page.evaluate(()=>localStorage.getItem('rr-public-ranking-v1:nations:2024:04')),null,'Old nation cache should be purged on startup');
 await page.waitForSelector('#distanceRanking .row');
 assert.equal(await page.locator('#rankingModeMonth').isDisabled(),true);
 assert.equal(await page.locator('#rankingModeMonth').getAttribute('aria-pressed'),'false');
 assert.equal(await page.locator('#distanceRanking .row').count(),2);
 assert.equal((await page.locator('#distanceRanking .monthlyScore').first().innerText()).trim(),'+82.3km');
 await page.locator('[data-panel="nations"]').click();
 await page.waitForSelector('#nationsRanking .row');
 assert.equal(await page.locator('#nationsRanking .monthlyScore').count(),0);
 assert.equal(await page.locator('#nationsRanking .score').first().innerText().then(x=>x.includes('310.1')),true);
 const stored=await page.evaluate(()=>Object.keys(localStorage).filter(x=>x.includes('nations:')).map(x=>JSON.parse(localStorage.getItem(x)).data));
 assert.ok(stored.length>0,'NATIONS cached data missing');
 assert.ok(stored.every(a=>a.every(r=>r.month_km===null)),'NATIONS cache leaked month_km');
 // Search must not expose private totals and must filter the current visible tab.
 await page.locator('[data-panel="distance"]').click();
 await page.locator('#rankingSearch').fill('Runner A');
 assert.equal(await page.locator('#distanceRanking .row:visible').count(),1);
 await page.locator('#rankingSearch').fill('nobody-in-this-fixture');
 assert.equal(await page.locator('#distanceRanking .row:visible').count(),0);
 await page.locator('#rankingSearch').fill('');
 await page.locator('[data-panel="nations"]').click();
 assert.equal(await page.locator('#nationsRanking .monthlyScore').count(),0);
 await page.locator('[data-language="en"]').click();
 await page.waitForTimeout(100);
 assert.equal(await page.locator('#nationsRanking .monthlyScore').count(),0);
 await page.locator('[data-panel="explore"]').click();
 await page.waitForSelector('#exploreRanking .row');
 assert.equal(await page.locator('#exploreRanking .monthlyScore').first().innerText(),'+2 regions');
 await page.locator('#rankingMonth').selectOption('12');
 await page.getByRole('button',{name:'2025',exact:true}).click();
 await page.waitForTimeout(200);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const calls=await page.evaluate(()=>window.__rpcRequests);
 assert.ok(calls.some(x=>x.name==='ranking_distance_monthly'&&x.args.p_year===2025&&x.args.p_month===12));
 assert.ok(calls.some(x=>x.name==='ranking_explore_monthly'&&x.args.p_year===2025&&x.args.p_month===12));
 assert.ok(calls.some(x=>x.name==='ranking_nations_monthly'&&x.args.p_year===2025&&x.args.p_month===12));
 assert.ok(!calls.some(x=>x.name.includes('_month_places')),'OFF mode called a monthly ranking RPC');
 // Existing image-share entry points must stay wired. Test canvas creation without opening native share UI.
 assert.equal(await page.locator('#rankingStorySave').count(),1);
 assert.equal(await page.locator('#rankingStoryShare').count(),1);
 assert.equal(await page.locator('#shareRanking').count(),1);
 assert.equal(await page.evaluate(()=>typeof rankingStoryCanvas),'function');
 const canvas=await page.evaluate(()=>{const c=rankingStoryCanvas();return {width:c.width,height:c.height}});
 assert.ok(canvas.width>0&&canvas.height>0,'Story image canvas dimensions should be valid');
 assert.deepEqual(errors,[]);
 await browser.close();
 console.log('PASS synthetic browser: 375px/no overflow, annual RPC, month OFF, NATIONS no delta/cached null, language, year/month, EXPLORE');
})().catch(e=>{console.error(e);process.exit(1)});
