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
 "['fit','owner','race']",
 "addEventListener('change',resetOutput)",
 "input[type=file]::file-selector-button",
 "button:focus-visible",
 "元データからFIT形式で再出力してください",
 "ZIPはこの画面では読み取れません",
 "時刻を補完しません"
])assert.ok(html.includes(required),'missing iPhone read safety or actionable error: '+required);
assert.ok(!html.includes('result.heartRate')&&!html.includes('result.latitude'));

console.log('Browser-local user FIT SDK -> 1km candidate + diagnostics PASS; original bytes unpersisted; synthetic generated binary only.');
