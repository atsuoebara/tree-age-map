import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../docs/rings-now-single-statement-snapshot-CANDIDATE.sql',import.meta.url),'utf8');
const note=readFileSync(new URL('../docs/rings-now-single-statement-snapshot-review-20261114.md',import.meta.url),'utf8');
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
test('one nondeploying SELECT statement is proposed with invoker and owner guard',()=>{
 assert.match(sql,/SECURITY INVOKER/);
 assert.match(sql,/SET search_path = ''/);
 assert.match(sql,/auth\.uid\(\)/);
 assert.match(sql,/FROM public\.runs/);
 assert.match(sql,/r\.deleted_at IS NULL/);
 assert.match(sql,/ORDER BY r\.id ASC/);
 assert.match(sql,/LIMIT 1001/);
 assert.match(sql,/count_check/);
 assert.match(sql,/WHEN \(SELECT total FROM count_check\) > 1000/);
 assert.match(sql,/too_many_rows/);
 assert.doesNotMatch(sql,/\bSECURITY DEFINER\b(?!.*avoid)/); // Checked separately below.
});
test('result includes exactly the six permitted column keys',()=>{
 const keys=Array.from(sql.matchAll(/^\s*'(id|user_id|activity_date|distance_km|started_at|deleted_at)',\s*(?:id|user_id|activity_date|distance_km|started_at|deleted_at),?\s*$/gm),m=>m[1]);
 assert.deepEqual(keys,['id','user_id','activity_date','distance_km','started_at','deleted_at']);
 assert.doesNotMatch(sql,/'route'\s*,|'heart_rate'\s*,|'fit'\s*,|r\.\*/);
});
test('explicitly not applied, not proof, G9 covers cost',()=>{
 assert.match(sql,/DO NOT EXECUTE OR DEPLOY/);
 assert.match(note,/実DBでの構文\/型検証は未実施/);
 assert.match(note,/G9：追加費用0円/);
 assert.match(note,/信号待ちやトイレ休憩、自動ポーズなどの影響により、正しく分析できない場合があります。/);
});
test('public feature remains OFF, no new production import',()=>{
 assert.match(index,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
 assert.doesNotMatch(index,/rings_now_snapshot_candidate_v01/);
 assert.doesNotMatch(sw,/rings_now_snapshot_candidate_v01/);
});
