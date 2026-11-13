import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../previews/ima-wo-shirou-fit-review-mobile-synthetic-20261113.html',import.meta.url),'utf8');
for(const needed of [
 'name="viewport"','noindex,nofollow','開発用・架空データ','正式な分析結果ではありません',
 '本人のFITファイルを読み込む機能は、まだありません',
 '1kmラップ候補','データ確認','経過時間（停止を含む）',
 'セッション総距離と最終記録の距離が一致しません',
 'この記録では1kmラップを計算できません',
 'timer_event_present_verify_pause','session_vs_last_record_distance_mismatch',
 'timestamp_or_cumulative_distance_missing','検出した警告なし（品質認証ではありません）',
 'type="button" disabled','分析を保存（未実装）','画像を共有（未実装）',
 'region.replaceChildren()','document.createElement', 'textContent',
 'role="status"','aria-live="polite"'
])assert.ok(html.includes(needed),'missing user-visible or security requirement: '+needed);
for(const forbidden of [
 /fetch\s*\(/,/XMLHttpRequest/,/localStorage/,/sessionStorage/,/indexedDB/,
 /navigator\.sendBeacon/,/serviceWorker/,/WebSocket/,/innerHTML\s*=/,
 /type="file"/,/<input\s+type=/i,/supabase\.co/i,/runnersrings\.com/i
])assert.ok(!forbidden.test(html),'synthetic preview must have no real file/network/storage operation: '+forbidden);
const scenarios={
 consistent:{laps:[315,318,320,324,343],elapsed:1620},
 paused:{laps:[315,318,380,324,343],elapsed:1680},
};
for(const [name,s] of Object.entries(scenarios)){
 const marker=name+':{';
 assert.ok(html.includes(marker),'missing '+name);
 assert.ok(html.includes('laps:['+s.laps.join(',')+']'));
 assert.equal(s.laps.reduce((a,b)=>a+b,0),s.elapsed);
}
assert.equal((html.match(/<button[^>]*disabled/g)||[]).length,2,'no enabled save/share actions');
assert.ok(!html.includes('<script src='));
console.log('FIT mobile diagnostic synthetic preview PASS: four states, plausible elapsed sums, warning labels, accessibility, no network/storage/file import.');
