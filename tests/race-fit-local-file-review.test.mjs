import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Encoder} from '../fit-sdk/src/index.js';
import {reviewSingleUserFitBuffer as review} from '../src/race-fit-local-file-review.mjs';
const opts={confirmedOwner:true,confirmedRace:true},start=new Date('2026-11-03T00:00:00Z');
const at=s=>new Date(start.getTime()+1000*s);
function makeFit({total=2000,recordEnd=2000,stop=false}={}){
 const encoder=new Encoder();encoder.writeMesg({mesgNum:18,sport:'running',startTime:start,timestamp:at(600),totalDistance:total});
 for(let i=0;i<=10;i++)encoder.writeMesg({mesgNum:20,timestamp:at(i*60),distance:i*recordEnd/10});
 if(stop){encoder.writeMesg({mesgNum:21,event:'timer',eventType:'stop',timestamp:at(240)});encoder.writeMesg({mesgNum:21,event:'timer',eventType:'start',timestamp:at(300)});}
 const bytes=encoder.close();return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
}
const good=review(makeFit(),opts);
assert.equal(good.status,'candidate_unverified',JSON.stringify(good));
assert.equal(good.qualityCertified,false);assert.equal(good.analysisAllowed,false);assert.equal(good.writeAllowed,false);
assert.equal(good.providerDataCombined,false);
assert.equal(good.segments.length,2);
assert.deepEqual(good.segments.map(x=>Math.round(x.clockElapsedS)),[300,300]);
assert.equal(good.distanceM,2000);
assert.equal(good.sessionTotalDistanceM,2000);
assert.equal(good.clockElapsedS,600);
assert.ok(!('messages' in good)&&!('records' in good)&&!JSON.stringify(good).includes('latitude'));
const mismatch=review(makeFit({total:2200}),opts);
assert.ok(mismatch.flags.includes('session_vs_last_record_distance_mismatch'));
assert.equal(mismatch.writeAllowed,false);
const paused=review(makeFit({stop:true}),opts);
assert.ok(paused.flags.some(x=>x.includes('timer')),'pause diagnostics must propagate');
assert.deepEqual(paused.segments.map(x=>Math.round(x.clockElapsedS)),[300,300],'stops never subtracted');
assert.equal(review(makeFit(),{confirmedOwner:false,confirmedRace:true}).status,'blocked');
assert.equal(review(makeFit(),{confirmedOwner:true,confirmedRace:false}).status,'blocked');
assert.equal(review(new ArrayBuffer(0),opts).status,'blocked');
assert.equal(review(new ArrayBuffer(20),opts).status,'blocked');
// Keep strict fail-closed behavior for realistic non-zero first FIT record time/distance.
function makeNonZeroOriginFit({delayS=0,firstDistanceM=0}={}){
 const encoder=new Encoder();
 encoder.writeMesg({mesgNum:18,sport:'running',startTime:start,timestamp:at(600),totalDistance:2000});
 for(let i=0;i<=10;i++)encoder.writeMesg({mesgNum:20,timestamp:at(delayS+i*60),distance:firstDistanceM+i*200});
 const bytes=encoder.close();
 return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
}
const delayed=review(makeNonZeroOriginFit({delayS:3}),opts);
assert.equal(delayed.status,'blocked');
assert.equal(delayed.reason,'record_and_session_start_must_match');
assert.equal(delayed.segments.length,0);
const nonzero=review(makeNonZeroOriginFit({firstDistanceM:12}),opts);
assert.equal(nonzero.status,'blocked');
assert.equal(nonzero.reason,'cumulative_distance_origin_not_zero');
assert.equal(nonzero.segments.length,0);
const html=readFileSync(new URL('../previews/ima-wo-shirou-fit-local-file-draft-20261113.html',import.meta.url),'utf8');
for(const x of ['name="viewport"','noindex,nofollow','type="file"','id="owner"','id="race"','file.arrayBuffer()',
 "import {reviewSingleUserFitBuffer} from '../src/race-fit-local-file-review.mjs'",
 '参考候補・未認証','type="button" disabled','停止時間を含む時計の経過時間','正式な分析結果ではありません'])
 assert.ok(html.includes(x),'missing '+x);
for(const pat of [/fetch\s*\(/,/XMLHttpRequest/,/WebSocket/,/localStorage/,/sessionStorage/,/indexedDB/,/navigator\.sendBeacon/,/innerHTML\s*=/])
 assert.ok(!pat.test(html),'isolated UI cannot transmit or persist data: '+pat);
assert.equal((html.match(/type="button" disabled/g)||[]).length,2);
for(const required of [
 "let selectionVersion=0,reviewing=false",
 "if(reviewing)return",
 "reviewing=true;reviewButton.disabled=true",
 "version!==selectionVersion",
 "$('fit').files?.[0]!==file",
 "if(version===selectionVersion)show(result)",
 "reviewing=false;reviewButton.disabled=false",
 "if(version===selectionVersion){reviewing=false;reviewButton.disabled=false;}",
 "['fit','owner','race']",
 "addEventListener('change',resetOutput)",
 "input[type=file]::file-selector-button",
 "button:focus-visible",
 "元データからFIT形式で再出力してください",
 "ZIPはこの画面では読み取れません",
 "時刻を補完しません"
])assert.ok(html.includes(required),'missing iPhone read safety or actionable error: '+required);
assert.ok(!html.includes('result.heartRate')&&!html.includes('result.latitude'));
for(const diagnosticText of [
 '先頭の累積距離が0mではありません',
 '先頭の距離0m以前の区間が不明です',
 'セッション終了時刻より後の記録点があります',
 '対応する停止記録のない再開イベントがあります',
 '再開記録と対応しない停止イベントがあります'
])assert.ok(html.includes(diagnosticText),'missing actual real-FIT diagnostic explanation: '+diagnosticText);

for(const label of [
 '記録時刻の重複または逆行を検出しました',
 '累積距離が途中で減少しています',
 '記録点の数が足りないか、多すぎます',
 '時刻を補完せず解析を停止します',
 '距離を補正せず解析を停止します'
])assert.ok(html.includes(label),'missing comprehensible blocked-FIT reason '+label);


console.log('Browser-local user FIT SDK -> 1km candidate + diagnostics PASS; original bytes unpersisted; synthetic generated binary only.');
