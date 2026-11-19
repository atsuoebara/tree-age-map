#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const count=id=>(html.match(new RegExp('id="'+id+'"','g'))||[]).length;
for(const id of ['rrHeaderTopRow','rrHeaderBrand','rrHeaderLogo','rrHeaderAccount',
  'accountProfileArea','accountSettingsButton','rrMapRecordSummary'])assert.equal(count(id),1,'unique '+id);
const header=html.slice(html.indexOf('<header>'),html.indexOf('</header>')+9);
assert.match(header,/<div id="rrHeaderBrand">[\s\S]*?<img id="rrHeaderLogo" src="\.\/icon\.PNG"[^>]*>[\s\S]*?<h1>/);
assert.match(header,/<span class="rrBrandEnglish">Runner's Rings<\/span><span class="brandReading">（ランナーズリングス）<\/span>/);
assert(header.indexOf('id="rrHeaderLogo"')<header.indexOf('class="rrBrandEnglish"'));
assert(header.indexOf('class="brandReading"')<header.indexOf('id="rrHeaderAccount"'));
assert.match(html,/header #rrHeaderBrand h1 a\s*\{[^}]*flex-direction:column/);
assert.match(html,/header #rrHeaderBrand \.rrBrandEnglish\s*\{[^}]*white-space:nowrap/);
assert.match(html,/header #rrHeaderBrand \.brandReading\s*\{[^}]*white-space:nowrap/);
assert.doesNotMatch(html,/header\.rrHasAccount h1 \.brandReading \{ display:none; \}/);
assert.match(html,/header\.rrHasAccount #rrHeaderBrand h1 \.brandReading \{ display:block; \}/);
assert.match(html,/#rrHeaderAccount #accountProfileArea\s*\{[^}]*flex-direction:column/);
assert(html.indexOf('id="rrMapRecordSummary"')<html.indexOf('id="map"'));
console.log('PASS: existing logo + stacked English/Japanese title + right-side account; map record preserved');
