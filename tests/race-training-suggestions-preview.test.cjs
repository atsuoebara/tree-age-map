'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../previews/race-training-suggestions-20261112.html'),'utf8');
for(const expected of ['DRAFT · SYNTHETIC','disclaimerJa','一般的な練習情報の紹介です。','General training information','insufficient','replaceChildren()','document.documentElement.lang=lang',"missing:[]",'addEventListener']) {
  if(expected==='disclaimerJa') continue; // Output UI uses bilingual disclaimer copy rather than field name.
  assert.ok(html.includes(expected),expected);
}
assert.ok(!/<script[^>]+src\s*=|<link[^>]+href\s*=|<iframe|fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|supabase\.createClient|navigator\.sendBeacon/i.test(html));
assert.equal((html.match(/<script>/g)||[]).length,1);
console.log('race training suggestions offline UI static safety checks passed');
