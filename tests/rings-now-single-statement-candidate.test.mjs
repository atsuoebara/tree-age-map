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
test('reviewed SQL narrows default PUBLIC function EXECUTE in one transaction',()=>{
 const tokens=[
  'BEGIN;',
  'CREATE OR REPLACE FUNCTION public.rings_now_snapshot_candidate_v01()',
  'REVOKE ALL ON FUNCTION public.rings_now_snapshot_candidate_v01() FROM PUBLIC;',
  'REVOKE ALL ON FUNCTION public.rings_now_snapshot_candidate_v01() FROM anon;',
  'REVOKE ALL ON FUNCTION public.rings_now_snapshot_candidate_v01() FROM service_role;',
  'GRANT EXECUTE ON FUNCTION public.rings_now_snapshot_candidate_v01() TO authenticated;',
  'COMMIT;'
 ];
 let last=-1;
 for(const token of tokens){
  const at=sql.indexOf(token,last+1);
  assert.ok(at>last,'missing or wrong order: '+token);
  last=at;
 }
 assert.match(note,/PostgreSQL の新規関数は原則/);
 assert.match(note,/実際の権限の証明ではない/);
});
test('required NULL values block the entire candidate snapshot before JSON rows are returned',()=>{
 const count=sql.indexOf('required_null_check AS MATERIALIZED');
 const nulls=sql.indexOf('activity_date IS NULL',count);
 const nullDistance=sql.indexOf('distance_km IS NULL',count);
 const nullStarted=sql.indexOf('started_at IS NULL',count);
 const guardedRows=sql.indexOf('AND (SELECT invalid_total FROM required_null_check) = 0');
 const tooMany=sql.indexOf("THEN jsonb_build_object('status','blocked','reason','too_many_rows')");
 const nullBlocked=sql.indexOf("THEN jsonb_build_object('status','blocked','reason','missing_required_fields')");
 const success=sql.indexOf("ELSE jsonb_build_object('status','candidate_snapshot','rows'");
 assert.ok(count>=0 && count<nulls && nulls<nullDistance && nullDistance<nullStarted);
 assert.ok(nullStarted<guardedRows && guardedRows<tooMany && tooMany<nullBlocked && nullBlocked<success);
 assert.match(note,/started_at.*NULL 1件/);
 assert.match(note,/個別行・所有者は確認していない/);
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
