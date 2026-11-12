'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('previews/garmin-splits-training-bridge-synthetic-20261112.html','utf8');
const moduleSrc=fs.readFileSync('src/race-training-suggestions.cjs','utf8');
const adapterSrc=fs.readFileSync('src/race-training-split-preview-adapter.cjs','utf8');
const logic=moduleSrc.replace(/^'use strict';\n/,'').replace(/\nif\(typeof module!=='undefined' && module\.exports\) module\.exports=\{suggestTraining,TRAINING\};\n?$/,'').trim();
const adapter=adapterSrc.replace(/^'use strict';\n/,'').replace(/\nif\(typeof module!=='undefined'&&module\.exports\)module\.exports=\{parseElapsed,adaptRaceSegments\};\n?$/,'').trim();
assert.ok(html.includes(logic),'#86 logic must be embedded without modification');
assert.ok(html.includes(adapter),'adapter must be embedded without modification');
assert.match(html,/noindex,nofollow/);
assert.match(html,/min-height:44px/);
assert.match(html,/data-language="ja"/);
assert.match(html,/data-language="en"/);
assert.doesNotMatch(html,/<script[^>]+src|<iframe|<form\b|fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|navigator\.sendBeacon|supabase\.createClient/i);
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);
const prefix=script.slice(0,script.indexOf("let lang='ja';"));
assert.ok(prefix.includes('function getSegments(kind)'));
const expression="Object.fromEntries(['short','even','slow','fast'].map(k=>{const segments=getSegments(k);const outcome=suggestTraining(adaptRaceSegments(segments));return [k,{status:outcome.status,reason:outcome.reason,ids:outcome.recommendations.map(r=>r.id),distance:segments.reduce((s,x)=>s+x.distanceKm,0),elapsed:segments.reduce((s,x)=>s+parseElapsed(x.elapsed),0),count:segments.length,tail:segments.at(-1).distanceKm,disclaimerJa:outcome.disclaimerJa,disclaimerEn:outcome.disclaimerEn}]}))";
const results=vm.runInNewContext(prefix+';('+expression+')');
const expected={
 short:{status:'insufficient_data',ids:[],count:4,elapsed:1105,distance:3.42},
 even:{status:'ok',reason:'relatively_even',ids:['easy_run'],count:8,elapsed:2305,distance:7.42},
 slow:{status:'ok',reason:'later_splits_slower',ids:['long_easy','even_pace'],count:8,elapsed:2585,distance:7.42},
 fast:{status:'ok',reason:'later_splits_faster',ids:['even_pace'],count:8,elapsed:2105,distance:7.42}
};
for(const [name,e] of Object.entries(expected)){
 const a=results[name];
 assert.equal(a.status,e.status,name+' status');
 if(e.reason)assert.equal(a.reason,e.reason,name+' reason');
 assert.deepEqual(Array.from(a.ids),e.ids,name+' recommendations');
 assert.equal(a.count,e.count,name+' split cards');
 assert.equal(a.elapsed,e.elapsed,name+' total seconds');
 assert.ok(Math.abs(a.distance-e.distance)<1e-9,name+' total km');
 assert.equal(a.tail,.42,name+' partial segment');
 assert.ok(a.disclaimerJa && a.disclaimerEn,name+' bilingual disclaimers');
}
const more=vm.runInNewContext(prefix+";({nil:suggestTraining(adaptRaceSegments([null])).status,noQuality:suggestTraining(adaptRaceSegments(Array.from({length:6},()=>({distanceKm:1,elapsed:'05:00'})))).status,malformedTime:suggestTraining(adaptRaceSegments([{distanceKm:1,elapsed:'x',elapsedQualityOk:true}])).status,sensorMissing:suggestTraining(adaptRaceSegments(Array.from({length:6},()=>({distanceKm:1,elapsed:'05:00',elapsedQualityOk:true,hr:null})))).status})");
assert.equal(more.nil,'insufficient_data');
assert.equal(more.noQuality,'insufficient_data');
assert.equal(more.malformedTime,'insufficient_data');
assert.equal(more.sensorMissing,'ok','missing HR is not missing elapsed quality');
console.log('PR69 split -> PR86 training bridge synthetic checks passed');
