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
assert.equal(nonzero.status,'candidate_unverified');
assert.equal(nonzero.initialIntervalOmitted,true);
assert.ok(nonzero.flags.includes('unknown_initial_distance_interval_omitted'));
assert.equal(nonzero.qualityCertified,false);
assert.equal(nonzero.writeAllowed,false);
assert.deepEqual(nonzero.segments.filter(s=>!s.partial).map(s=>s.index),[2]);
assert.equal(nonzero.segments.at(-1).distanceM,12);

// Preserve FIT SDK diagnostics on synthetic data, while the former public
// trial UI is intentionally inert. The modern UI has independent tests.
const oldHtml=readFileSync(new URL('../previews/ima-wo-shirou-fit-local-file-draft-20261113.html',import.meta.url),'utf8');
const ui=readFileSync(new URL('../src/rings-now-private-fit-ui-controller.mjs',import.meta.url),'utf8');
assert.match(oldHtml,/script-src 'none'/);
assert.doesNotMatch(oldHtml,/<input\b|<script\b|reviewSingleUserFitBuffer|\.arrayBuffer\(/);
assert.ok(ui.includes('信号待ちやトイレ休憩、自動ポーズなどの影響により、正しく分析できない場合があります。'));
console.log('Local FIT SDK diagnostics PASS; former public FIT reader disabled.');
