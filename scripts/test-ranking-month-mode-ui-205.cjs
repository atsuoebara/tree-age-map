'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('ranking.html','utf8');
const check=(desc,fn)=>{fn();console.log('PASS '+desc)};
check('monthly switch is hard OFF in source',()=>{
 assert.match(html,/const RANKING_MONTH_PLACES_ENABLED=false;/);
 assert.match(html,/<button id="rankingModeMonth"[^>]*disabled/);
 assert.match(html,/monthModeButton\.disabled=!RANKING_MONTH_PLACES_ENABLED/);
 assert.match(html,/if\(!RANKING_MONTH_PLACES_ENABLED\)return/);
});
check('annual RPCs still present',()=>{
 assert.match(html,/ranking_distance_monthly/);
 assert.match(html,/ranking_explore_monthly/);
 assert.match(html,/ranking_nations_monthly/);
});
check('month mode references only two authorized candidate RPCs',()=>{
 assert.match(html,/ranking_distance_month_places/);
 assert.match(html,/ranking_explore_month_places/);
 assert.doesNotMatch(html,/sb\.rpc\('ranking_nations_month_places'/);
});
check('monthly NATIONS is not requested and carries privacy notice',()=>{
 assert.match(html,/mode==='year'\?sb\.rpc\('ranking_nations_monthly'/);
 assert.match(html,/NATIONS月間順位はプライバシー監査のため非公開/);
});
check('cache separates annual and monthly distance/explore results',()=>{
 assert.match(html,/const key=mode\+':'\+selectedRankingYear/);
 assert.match(html,/const cacheKey='explore:'\+selectedRankingMode/);
});
check('month mode suppresses annual plus monthly increment double count',()=>{
 assert.match(html,/if\(selectedRankingMode==='month'/);
});
check('annual rows and disclosure controls remain',()=>{
 assert.match(html,/function renderRanking\(/);
 assert.match(html,/join_distance/);
 assert.match(html,/join_explore/);
 assert.match(html,/function rankingRetry\(/);
});
console.log('PASS 7/7 static source gates (not a browser or API verification)');
