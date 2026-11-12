'use strict';
const assert=require('node:assert/strict');
const {suggestTraining}=require('../src/race-training-suggestions.cjs');
const mk=(v)=>v.map(elapsedSeconds=>({distanceKm:1,elapsedSeconds,qualityOk:true}));
let r=suggestTraining({splits:mk([300,300,300,340,340,340])});
assert.equal(r.status,'ok');
assert.equal(r.reason,'later_splits_slower');
assert.deepEqual(r.recommendations.map(x=>x.id),['long_easy','even_pace']);
r=suggestTraining({splits:mk([330,330,330,290,290,290])});
assert.equal(r.reason,'later_splits_faster');
r=suggestTraining({splits:mk([300,300,300,301,299,300])});
assert.equal(r.reason,'relatively_even');
assert.equal(suggestTraining({splits:mk([300,300,300])}).status,'insufficient_data');
assert.equal(suggestTraining({splits:mk([300,300,300,340,340,340]).map((x,i)=>i===2?{...x,qualityOk:false}:x)}).status,'insufficient_data');
assert.equal(suggestTraining({splits:[...mk([300,300,300,340,340,340]),{distanceKm:0.42,elapsedSeconds:120,qualityOk:true}]}).reason,'later_splits_slower');
assert.equal(suggestTraining({splits:mk([300,300,0,340,340,340])}).status,'insufficient_data');
// Audit condition 1: Japanese and English disclaimers exist in all outcomes.
for (const result of [suggestTraining(null),suggestTraining({splits:mk([300,300,300,340,340,340])})]) {
  assert.match(result.disclaimerJa,/一般的な練習情報/);
  assert.match(result.disclaimerEn,/General training information/);
  assert.equal(result.disclaimer,result.disclaimerEn); // Backward-compatible English field.
}
// Audit condition 2: malformed elements fail closed even when six valid splits exist.
for (const bad of [null,undefined,17,'bad',false,[]]) {
  assert.equal(suggestTraining({splits:[...mk([300,300,300,340,340,340]),bad]}).status,'insufficient_data');
}
console.log('race-training-suggestions isolated tests passed');
