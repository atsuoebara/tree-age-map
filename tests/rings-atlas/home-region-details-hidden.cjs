#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const atlas=fs.readFileSync(path.resolve(__dirname,'../../rings-atlas.html'),'utf8');
const script=fs.readFileSync(path.resolve(__dirname,'../../rings-atlas-view.js'),'utf8');
const beginning=html.indexOf('html:not(.rrAtlasEmbedded) #dashboard > .rrAtlasEntry');
const end=html.indexOf('display:none !important;',beginning);
assert(beginning>0&&end>beginning,'regular-home-only CSS hide rule missing');
const rule=html.slice(beginning,end);
for(const id of ['countryHeading','countryList','countryDetailFlow','regionSection','admin2Section','prefectureSection','citySection']){
  assert(rule.includes('html:not(.rrAtlasEmbedded) #dashboard > #'+id),'missing '+id+' ordinary home hide');
}
assert(rule.includes('html:not(.rrAtlasEmbedded) #dashboard > .rrAtlasEntry'),'legacy open button must be hidden');
assert(!rule.includes('rrFeatureTiles'),'feature grid must remain');
assert(!rule.includes('rrAtlasView'),'Atlas standalone view must remain');
for(const id of ['countryHeading','countryList','regionSection','admin2Section','prefectureSection','citySection','rrAtlasOpen','rrAtlasHomeEnd','rrAtlasView']){
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,'canonical DOM '+id+' must remain once');
}
assert(html.includes('href="./rings-atlas.html" class="rrAtlasFeatureTile"'),'Atlas entry retained');
assert(html.includes('あなたの国・地域別の年輪をたどる →'),'approved tile copy retained');
assert(atlas.includes('src="./index.html?atlas=embedded"'),'Atlas still uses same app');
assert(script.includes('const ids = [\'countryHeading\',\'countryList\',\'regionSection\',\'admin2Section\',\'prefectureSection\',\'citySection\']'),'canonical relocation remains');
const sw=fs.readFileSync(path.resolve(__dirname,'../../sw.js'),'utf8');
const appBuild=html.match(/const APP_BUILD = '([^']+)'/)?.[1];
const swBuild=sw.match(/const RR_BUILD = '([^']+)'/)?.[1];
assert(appBuild && swBuild && appBuild===swBuild,'C-3 app/service-worker build must match');
console.log('PASS: home region details/legacy button hidden; Atlas feature, DOM, auth/data bridge and C-3 preserved');
