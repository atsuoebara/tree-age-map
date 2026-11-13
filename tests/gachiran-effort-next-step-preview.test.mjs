import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../previews/gachiran-effort-next-step-synthetic-20261113.html',import.meta.url),'utf8');
const must=[
 '努力はここで終わらない。次の一歩へ。',
 '立ち止まった時間やトイレなどの時間も含めた経過時間',
 '自動ポーズや手動停止を使用した記録は、正確に分析できない場合があります。',
 'ゆっくり3kmを走った日',
 'この記録では区間分析ができません。',
 '開発用・架空データ',
 'meta name="viewport"',
 'textContent',
 'laps.replaceChildren()'
];
for(const phrase of must)assert.ok(html.includes(phrase),'missing '+phrase);
for(const forbidden of [/fetch\s*\(/,/XMLHttpRequest/,/localStorage/,/sessionStorage/,/supabase/i,/strava\.com/i,/runnersrings\.com/i,/navigator\.sendBeacon/,/innerHTML\s*=/])
 assert.ok(!forbidden.test(html),'preview must be disconnected from network and storage: '+forbidden);
assert.ok(html.includes('laps:[315,318,320,324,343]'));
assert.equal([315,318,320,324,343].reduce((a,b)=>a+b,0),1620,'5km samples match 27:00');
assert.equal([450,445,455].reduce((a,b)=>a+b,0),1350,'3km samples match 22:30');
assert.ok(!html.includes('世界ランキング'));
console.log('Gachiran effort-first synthetic mobile preview PASS: accessible sample states, accurate sample sums, safety copy and no data connectivity');
