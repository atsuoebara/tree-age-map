import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createSyntheticOnlyInspector as make,SYNTHETIC_NAME,SYNTHETIC_SIZE,SYNTHETIC_SHA256} from '../src/rings-now-iphone-synthetic-inspector.mjs';

const html=readFileSync(new URL('../previews/rings-now-iphone-synthetic-handoff-20261114.html',import.meta.url),'utf8');
const old=readFileSync(new URL('../previews/rings-now-iphone-synthetic-only-20261114.html',import.meta.url),'utf8');
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const retired=readFileSync(new URL('../previews/ima-wo-shirou-fit-local-file-draft-20261113.html',import.meta.url),'utf8');
const extract=(s)=>Buffer.from(s.match(/const SYNTHETIC_B64='([^']+)'/)[1],'base64');
const bytes=extract(html);
const digest=async(_alg,buffer)=>{
 const hash=createHash('sha256').update(new Uint8Array(buffer)).digest();
 return hash.buffer.slice(hash.byteOffset,hash.byteOffset+hash.byteLength);
};
const file=(buf=bytes,name=SYNTHETIC_NAME)=>({name,size:buf.byteLength,arrayBuffer:async()=>buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength)});
const valid={confirmedOwner:true,confirmedGachi:true,isSelectionCurrent:()=>true};
test('new iPhone fixture bytes and SHA exactly match already-audited public synthetic fixture',()=>{
 assert.equal(bytes.length,294);
 assert.equal(bytes.equals(extract(old)),true);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),SYNTHETIC_SHA256);
 assert.equal(SYNTHETIC_SIZE,294);
});
test('the approved fixture is checked before calling the existing FIT inspector',async()=>{
 let calls=0;
 const inspect=async args=>{
  calls++;
  assert.equal(args.file.name,SYNTHETIC_NAME);
  assert.equal(args.file.size,294);
  const b=Buffer.from(await args.file.arrayBuffer());
  assert.equal(b.equals(bytes),true);
  return {status:'reference_only_unverified',analysisAllowed:false,writeAllowed:false,qualityCertified:false,providerDataCombined:false,segments:[]};
 };
 const result=await make({digest,inspect})({...valid,file:file()});
 assert.equal(result.status,'reference_only_unverified');
 assert.equal(calls,1);
});
test('same-name and same-size modified real-like FIT is never decoded',async()=>{
 let calls=0;
 const inspect=()=>{calls++;throw Error('must never decode')};
 const approved=make({digest,inspect});
 for(const x of [file(Buffer.from(bytes).fill(0,40,41)),file(bytes,'actual-garmin.fit'),file(bytes.subarray(0,293)),file(Buffer.alloc(294,0)),null]){
  const result=await approved({...valid,file:x});
  assert.equal(result.status,'blocked');
 }
 assert.equal(calls,0);
});
test('no confirmations or invalidated selection means file bytes never read or parsed',async()=>{
 let reads=0,decodes=0;
 const inspector=make({digest,inspect:()=>{decodes++}});
 const x={name:SYNTHETIC_NAME,size:294,arrayBuffer:async()=>{reads++;return file().arrayBuffer()}};
 for(const args of [{...valid,confirmedOwner:false},{...valid,confirmedGachi:false},{...valid,isSelectionCurrent:()=>false}]){
  assert.equal((await inspector({...args,file:x})).status,'blocked');
 }
 assert.equal(reads,0);assert.equal(decodes,0);
});
test('selection invalidated after asynchronous digest cannot decode',async()=>{
 let finish,decodes=0,live=true;
 const pending=new Promise(resolve=>{finish=resolve});
 const inspector=make({digest:async(...a)=>{await pending;return digest(...a)},inspect:()=>{decodes++}});
 const running=inspector({...valid,file:file(),isSelectionCurrent:()=>live});
 live=false;finish();const r=await running;
 assert.equal(r.status,'blocked');assert.equal(decodes,0);
});
test('public page wireup and privacy fence are explicit; real FIT never reaches inspector',()=>{
 for(const required of [
  'createRingsNowIphoneIsolatedHandoff',
  'createSyntheticOnlyInspector',
  'const handoff=createRingsNowIphoneIsolatedHandoff',
  'featureStartedAtMs:start.getTime()-1000',
  'pageEvents:window,visibilityEvents:document,inspect:inspector',
  "pageEvents:window",
  "handoff.invalidate()",
  '信号待ちやトイレ休憩、自動ポーズなどの影響により、正しく分析できない場合があります。'
 ])assert.ok(html.includes(required),required);
 assert.match(html,/connect-src 'none'/);
 assert.match(html,/form-action 'none'/);
 assert.match(html,/type="file"/);
 assert.match(retired,/script-src 'none'/);
 assert.match(index,/RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
 for(const p of [/\bfetch\s*\(/,/XMLHttpRequest/,/WebSocket/,/localStorage/,/sessionStorage/,/indexedDB/,/navigator\.sendBeacon/,/\bFormData\b/,/supabase/i,/strava\.com/,/garmin\.com/]){
  assert.doesNotMatch(html,p);
 }
});
