'use strict';
// Synthetic source-contract tests. No DB calls, no production writes.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('ranking.html','utf8');
let total=0;
function check(label,fn){fn();total++;console.log('PASS',label)}
check('monthly toggle hard OFF and disabled',()=>{
  assert.match(html,/const RANKING_MONTH_PLACES_ENABLED=false;/);
  assert.match(html,/<button id="rankingModeMonth"[^>]* disabled\b/);
  assert.match(html,/monthModeButton\.disabled=!RANKING_MONTH_PLACES_ENABLED/);
  assert.match(html,/monthModeButton\.onclick=\(\)=>\{if\(!RANKING_MONTH_PLACES_ENABLED\)return;/);
});
check('annual DISTANCE EXPLORE NATIONS are preserved',()=>{
  for(const rpc of ['ranking_distance_monthly','ranking_explore_monthly','ranking_nations_monthly'])assert.ok(html.includes(rpc),rpc);
  assert.match(html,/mode==='year'\?sb\.rpc\('ranking_nations_monthly'/);
});
check('monthly mode only uses DISTANCE and EXPLORE RPC',()=>{
  assert.match(html,/ranking_distance_month_places/);
  assert.match(html,/ranking_explore_month_places/);
  assert.doesNotMatch(html,/sb\.rpc\('ranking_nations_month_places'/);
});
check('NATIONS month delta is not rendered in any mode',()=>{
  assert.match(html,/if\(kind==='nations'\|\|selectedRankingMode==='month'\)\{[^}]+return;\}/);
  assert.match(html,/const delta=kind==='nations'\?null:/);
});
check('old NATIONS localStorage records are purged',()=>{
  assert.match(html,/startsWith\(rankingCachePrefix\+'nations:'\)/);
  assert.match(html,/localStorage\.removeItem\(key\)/);
});
check('all NATIONS inputs sanitized before display and cache write',()=>{
  assert.match(html,/cachedNations\.map\(r=>\(\{\.\.\.r,month_km:null\}\)\)/);
  assert.match(html,/const safeNations=n\.data\.map\(r=>\(\{\.\.\.r,month_km:null\}\)\)/);
  assert.match(html,/rows\('nationsRanking',safeNations,'nations'\)/);
  assert.match(html,/rankingCachePut\('nations:'\+selectedRankingYear\+':'\+selectedRankingMonth,safeNations\)/);
});
check('annual/monthly cache key and response fencing retained',()=>{
  assert.match(html,/const key=mode\+':'\+selectedRankingYear/);
  assert.match(html,/const cacheKey='explore:'\+selectedRankingMode/);
  assert.match(html,/request!==boardsRequest\|\|mode!==selectedRankingMode/);
  assert.match(html,/request!==exploreRequest/);
});
check('bilingual nation privacy notice retained',()=>{
  assert.match(html,/NATIONS の月間増加分はプライバシー保護のため一時非表示/);
  assert.match(html,/NATIONS monthly additions are temporarily hidden for privacy/);
  assert.match(html,/NATIONS monthly ranking is withheld pending privacy review/);
});
check('no production ON or SQL API mutation',()=>{
  assert.doesNotMatch(html,/RANKING_MONTH_PLACES_ENABLED=true/);
  assert.doesNotMatch(html,/ranking_nations_month_places\s*\(/);
});
console.log('PASS '+total+'/'+total+' static integrated invariants; NOT a browser/SQL/HTTP test');
