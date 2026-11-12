'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('previews/race-training-integrated-synthetic-20261112.html','utf8');
const actual=fs.readFileSync('src/race-training-suggestions.cjs','utf8');
const start=actual.indexOf('// Pure, offline, deterministic');
const end=actual.indexOf("if(typeof module!=='undefined'");
assert.ok(start>=0 && end>start);
assert.ok(html.includes(actual.slice(start,end).trimEnd()),'audited logic must be embedded verbatim');
assert.ok(!/(fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|navigator\.sendBeacon|supabase\.createClient|<iframe)/i.test(html));
assert.ok(html.includes('noindex,nofollow'));
const script=html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(script);
const app=script[1];
const head=app.slice(0,app.indexOf("let lang='ja';"));
const cases=vm.runInNewContext(head+';({slow:syntheticResult("slow"),even:syntheticResult("even"),fast:syntheticResult("fast"),missing:syntheticResult("missing")})');
// Regression: rendered JA footer must describe the actual synthetic PR #86 integration.
const footers=vm.runInNewContext(head+';({ja:copy.ja.footer,en:copy.en.footer})');
assert.match(footers.ja,/PR #86の判定ロジックを架空の1km区間データで実行/);
assert.doesNotMatch(footers.ja,/判定ロジックとは未接続/);
assert.match(footers.en,/Uses PR #86 logic on synthetic 1 km splits only/);
assert.equal(cases.slow.reason,'later_splits_slower');
assert.equal(cases.even.reason,'relatively_even');
assert.equal(cases.fast.reason,'later_splits_faster');
assert.equal(cases.missing.status,'insufficient_data');
assert.deepEqual(Array.from(cases.missing.recommendations),[]);
for(const key of ['slow','even','fast','missing']){
 assert.ok(cases[key].disclaimerJa && cases[key].disclaimerEn);
}
console.log('synthetic integrated decision preview checks passed');
