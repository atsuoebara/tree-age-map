// Standalone visual QA for the self-contained mock. Uses only synthetic data.
// CI screenshots are review artifacts, not real iPhone verification.
'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const url=require('node:url');
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const out='garmin-split-preview-screenshots';
  fs.mkdirSync(out,{recursive:true});
  const filename=path.resolve('previews/garmin-race-splits-20261109.html');
  const target=url.pathToFileURL(filename).href;
  const sizes=[
    {name:'iphone-narrow-ja-320x700',width:320,height:700,language:'ja'},
    {name:'iphone-portrait-ja-375x812',width:375,height:812,language:'ja'},
    {name:'iphone-portrait-en-375x812',width:375,height:812,language:'en'},
    {name:'iphone-landscape-en-812x375',width:812,height:375,language:'en'}
  ];
  try {
    for(const spec of sizes) {
      const page=await browser.newPage({viewport:{width:spec.width,height:spec.height},deviceScaleFactor:2,isMobile:true,hasTouch:true});
      const outside=[];
      page.on('request',request=>{
        if(!request.url().startsWith('file:')) outside.push(request.url());
      });
      await page.goto(target,{waitUntil:'load'});
      await page.locator('#segments article').first().waitFor();
      if(spec.language==='en') await page.locator('#lang').click();
      assert.equal(await page.locator('html').getAttribute('lang'),spec.language);
      assert.equal(await page.locator('#segments article').count(),4);
      assert.deepEqual(outside,[],'page made external requests');
      const bounds=await page.evaluate(()=>({
        viewport:document.documentElement.clientWidth,
        htmlScroll:document.documentElement.scrollWidth,
        bodyScroll:document.body.scrollWidth,
        cardCount:document.querySelectorAll('.seg').length
      }));
      assert.ok(bounds.htmlScroll <= bounds.viewport+1,'HTML has horizontal overflow '+JSON.stringify({spec,bounds}));
      assert.ok(bounds.bodyScroll <= bounds.viewport+1,'body has horizontal overflow '+JSON.stringify({spec,bounds}));
      await page.screenshot({path:path.join(out,spec.name+'.png'),fullPage:true});
      console.log('PASS '+spec.name+' (synthetic browser, no horizontal overflow)');
      await page.close();
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
