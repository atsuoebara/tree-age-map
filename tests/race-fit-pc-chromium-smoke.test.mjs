// Chromium PC smoke test: ACTUAL localhost HTML + FIT SDK + synthetic file picker.
// Never contacts the Internet, uploads FIT data or modifies production files.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {existsSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import http from 'node:http';
import {Encoder} from '../fit-sdk/src/index.js';
const root=mkdtempSync(join(tmpdir(),'rr-fit-browser-'));
const path=u=>fileURLToPath(new URL(u,import.meta.url));
const chrome=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(existsSync);
assert.ok(chrome,'Chromium/Chrome executable required for PC browser test');
const fixture=join(root,'synthetic-5km.fit');
const py=spawnSync('python3',[path('../scripts/make-synthetic-race-fit-portable.py'),fixture],{encoding:'utf8',timeout:5000});
assert.equal(py.status,0,py.stderr||py.stdout);
const server=spawn('python3',['-u',path('../scripts/serve-private-fit-preview.py'),'--host','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});
let url='';
const serverStarted=new Promise((resolve,reject)=>{
 let output='';
 server.stdout.on('data',chunk=>{
  output+=chunk.toString();
  const match=output.match(/http:\/\/127\.0\.0\.1:\d+\/open\/[A-Za-z0-9_-]+/);
  if(match){url=match[0];resolve();}
 });
 server.on('exit',code=>reject(new Error('private server quit before URL: '+code)));
});
const browser=spawn(chrome,[
 '--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--no-default-browser-check',
 '--disable-background-networking','--disable-extensions','--no-proxy-server',
 '--remote-allow-origins=*','--remote-debugging-port=0','--user-data-dir='+join(root,'chrome'),
 'about:blank'
],{stdio:'ignore'});
async function waitFor(check,label,timeout=20000){
 const end=Date.now()+timeout;
 while(Date.now()<end){
  try {const x=await check();if(x)return x;}catch{}
  await new Promise(ok=>setTimeout(ok,100));
 }
 throw new Error('Timed out: '+label);
}
function getJSON(target){
 return new Promise((resolve,reject)=>{
  http.get(target,res=>{let b='';res.on('data',c=>b+=c);res.on('end',()=>{try{resolve(JSON.parse(b));}catch(e){reject(e);}});}).on('error',reject);
 });
}
let ws=null;
try{
 await waitFor(()=>url,'localhost server start');
 const dev=await waitFor(()=>{
  const f=join(root,'chrome','DevToolsActivePort');
  return existsSync(f)&&readFileSync(f,'utf8').trim();
 },'Chrome DevTools port');
 const port=dev.split('\n')[0];
 const pages=await waitFor(async()=>{const a=await getJSON('http://127.0.0.1:'+port+'/json/list');return a.find(x=>x.type==='page')?.webSocketDebuggerUrl;},'Chrome page WebSocket');
 ws=new WebSocket(pages);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 let id=0;const pending=new Map();
 ws.addEventListener('message',ev=>{
  const m=JSON.parse(ev.data);if(!m.id)return;
  const cb=pending.get(m.id);if(!cb)return;pending.delete(m.id);
  if(m.error)cb.reject(new Error(m.error.message));else cb.resolve(m.result);
 });
 const call=(method,params={})=>new Promise((resolve,reject)=>{
  const next=++id;pending.set(next,{resolve,reject});
  ws.send(JSON.stringify({id:next,method,params}));
 });
 const expr=async expression=>{
  const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(r.exceptionDetails)throw Error('Browser JS exception: '+r.exceptionDetails.text);
  return r.result.value;
 };
 await call('Page.enable');
 await call('DOM.enable');
 await call('Page.navigate',{url});
 await waitFor(()=>expr("document.querySelector('#review') && document.readyState==='complete'"),'preview document');
 await waitFor(()=>expr("document.querySelector('#status')?.textContent==='未選択です' && document.querySelector('#review')?.onclick===null"),'initial state');
 const dom=await call('DOM.getDocument',{depth:2});
 const input=await call('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'#fit'});
 assert.ok(input.nodeId,'real file picker must be present');
 await call('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[fixture]});
 await expr("document.querySelector('#owner').click(); document.querySelector('#race').click(); document.querySelector('#review').click();");
 const summary=await waitFor(async()=>{
  const state=await expr("document.querySelector('#status').textContent");
  return state.includes('参考候補・未認証')?state:null;
 },'real 1km candidate');
 assert.match(summary,/参考候補・未認証/);
 const values=await expr("[...document.querySelectorAll('#laps tbody tr')].map(tr=>tr.innerText.trim().replace(/\\s+/g,' '))");
 assert.equal(values.length,5);
 assert.deepEqual(values.map(s=>s.split(' ').at(-1)),['5:15','5:18','5:20','5:24','5:43']);
 assert.match(await expr("document.querySelector('#distance').textContent"),/5\.00 km／経過時間 27:00/);
 assert.match(await expr("document.querySelector('#flags').textContent"),/停止イベント情報がない/);
 assert.equal(await expr("document.querySelectorAll('button[disabled]').length"),2);

 // Garmin-like first record: absolute FIT distance starts at 12m, not 0m.
 // A known 1km must be bounded by two observed absolute 1km crossings.
 const nonzeroFile=join(root,'synthetic-nonzero-origin.fit');
 const start=new Date('2020-01-01T00:00:00Z');
 const atSec=s=>new Date(start.getTime()+s*1000);
 const enc=new Encoder();
 enc.writeMesg({mesgNum:18,sport:'running',startTime:start,timestamp:atSec(600),totalDistance:2012});
 for(let i=0;i<=10;i++)enc.writeMesg({mesgNum:20,timestamp:atSec(i*60),distance:12+i*200});
 writeFileSync(nonzeroFile,enc.close());
 await call('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[nonzeroFile]});
 await expr("document.querySelector('#review').click()");
 await waitFor(async()=> (await expr("document.querySelector('#distance').textContent")).includes('記録点間の距離増分'),'nonzero origin candidate display');
 const nonzeroTitle=await expr("document.querySelector('#status').textContent");
 assert.match(nonzeroTitle,/参考候補・未認証/);
 const nonzeroDetails=await expr("document.querySelector('#distance').textContent");
 assert.match(nonzeroDetails,/FIT最終累積距離 [0-9]+\\.[0-9]{2} km／記録点間の距離増分 [0-9]+\\.[0-9]{2} km／計測経過時間 10:00/);
 // FIT SDK quantizes record distances, so labels must not assume exact decimal
 // roundtrips of the synthetic source's 12m first reading and 2012m last.
 const values=nonzeroDetails.match(/FIT最終累積距離 ([0-9]+\\.[0-9]{2}) km／記録点間の距離増分 ([0-9]+\\.[0-9]{2}) km/);
 assert.ok(values);
 assert.ok(Number(values[1])>Number(values[2]),'last absolute distance must exceed observed increment');
 assert.ok(Number(values[1])-Number(values[2])<0.03,'first unknown distance cannot exceed synthetic 20m');
 assert.match(nonzeroDetails,/先頭区間不明・未認証/);
 const nonzeroRows=await expr("[...document.querySelectorAll('#laps tbody tr')].map(tr=>tr.innerText.trim())");
 assert.equal(nonzeroRows.length,2,'only 2nd fully observed kilometre plus terminal 12m is allowed');
 assert.match(nonzeroRows[0],/2 km/);
 assert.match(nonzeroRows[0],/5:00/);
 assert.match(nonzeroRows[1],/端数 12 m/);
 assert.match(await expr("document.querySelector('#flags').textContent"),/最初の区間は表示していません/);
 assert.equal(await expr("document.querySelectorAll('button[disabled]').length"),2);

 // Now exercise real browser rejection: a CRC-broken FIT must clear old rows.
 const corrupt=join(root,'invalid.fit');
 const broken=Buffer.from(readFileSync(fixture));broken[60]^=0x01;writeFileSync(corrupt,broken);
 await call('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[corrupt]});
 await expr("document.querySelector('#review').click()");
 await waitFor(async()=> (await expr("document.querySelector('#status').textContent")).includes('候補を表示できません'),'broken FIT rejected');
 assert.equal(await expr("document.querySelectorAll('#laps tbody tr').length"),0,'bad FIT must not retain previous lap rows');
 assert.equal(await expr("document.querySelector('#distance').textContent"),'','bad FIT must not retain distance');
 assert.equal(await expr("document.querySelectorAll('#flags li').length"),0,'blocked FIT must not show false no-warning label');
 // Valid FIT without consent must also be denied; previous rows remain cleared.
 await call('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[fixture]});
 await expr("document.querySelector('#owner').click(); document.querySelector('#review').click()");
 await waitFor(async()=> (await expr("document.querySelector('#status').textContent")).includes('本人確認とレース確認'),'missing consent denied');
 assert.equal(await expr("document.querySelectorAll('#laps tbody tr').length"),0);
 assert.equal(await expr("document.querySelectorAll('#flags li').length"),0);

 console.log('REAL PC CHROMIUM FIT SMOKE PASS: 5x1km, nonzero Garmin-like start (2nd km only), corrupt FIT and missing consent blocked, save/share disabled');
}finally{
 if(ws){try{ws.close();}catch{}}
 const chromeExit=browser.exitCode===null?once(browser,'exit'):Promise.resolve();
 const serverExit=server.exitCode===null?once(server,'exit'):Promise.resolve();
 browser.kill('SIGTERM');
 server.kill('SIGTERM');
 // Chrome may still be writing its profile after the test has passed.
 await Promise.race([Promise.all([chromeExit,serverExit]),new Promise(ok=>setTimeout(ok,5000))]);
 try{
  rmSync(root,{recursive:true,force:true,maxRetries:12,retryDelay:200});
 }catch(error){
  // A running browser child must not turn a successful analysis into a failure.
  if(!['ENOTEMPTY','EBUSY','EPERM'].includes(error.code))throw error;
  console.warn('Temporary synthetic Chrome profile cleanup incomplete:',error.code);
 }
}
