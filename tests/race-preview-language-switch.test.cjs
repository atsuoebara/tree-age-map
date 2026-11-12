'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
for(const path of ['previews/race-training-suggestions-20261112.html','previews/race-training-integrated-synthetic-20261112.html']){
 const html=fs.readFileSync(path,'utf8');
 assert.match(html,/<button class="languageButton isActive" data-language="ja" aria-pressed="true" type="button">日本語<\/button>/);
 assert.match(html,/<button class="languageButton" data-language="en" aria-pressed="false" type="button">EN<\/button>/);
 assert.match(html,/\.languageButton\.isActive\{background:#ff2bd6;color:#fff\}/);
 assert.match(html,/min-height:44px/);
 assert.match(html,/button\.dataset\.language===lang/);
 assert.match(html,/setAttribute\('aria-pressed',String\(active\)\)/);
 assert.match(html,/if\(lang!==button\.dataset\.language\)/);
 assert.doesNotMatch(html,/getElementById\('lang'\)/);
 assert.match(html,/document\.documentElement\.lang=lang/);
 assert.match(html,/document\.getElementById\('scenario'\)\.value/);
 assert.match(html,/noindex,nofollow/);
 assert.doesNotMatch(html,/(fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|navigator\.sendBeacon|<iframe)/i);
}
console.log('language switch consistency checks passed');
