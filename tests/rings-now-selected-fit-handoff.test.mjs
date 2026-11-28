import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeSyntheticRaceFit} from '../scripts/make-synthetic-race-fit.mjs';
import {createRingsNowCalendarConnection} from '../src/rings-now-calendar-connection.mjs';
import {createRingsNowSelectedFitHandoff} from '../src/rings-now-selected-fit-handoff.mjs';

class Events{
 constructor(){this.handlers=new Map();this.hidden=false}
 addEventListener(t,f){if(!this.handlers.has(t))this.handlers.set(t,new Set());this.handlers.get(t).add(f)}
 removeEventListener(t,f){this.handlers.get(t)?.delete(f)}
 dispatch(t,e){return [...(this.handlers.get(t)||[])].map(f=>f(e))}
}
class Element extends Events{
 constructor(){super();this.checked=false;this.disabled=false;this.files=[];this.children=[];this.value='';this.textContent=''}
 replaceChildren(...x){this.children=x}
 append(...x){this.children.push(...x)}
}
const owner='12345678-1234-1234-1234-123456789abc';
const start=Date.parse('2026-11-26T12:00:00Z'),rollout=start-1000;
const row={id:42,user_id:owner,activity_date:'2026-11-26',distance_km:5,started_at:'2026-11-26T12:00:00Z',deleted_at:null};
const binary=makeSyntheticRaceFit();
const allow={protocol:'rings-now-review-v1',build:'v1',enabled:true};
async function fixture({enabled=true,signal=allow,control,confirmed=true}={}){
 let auth,reads=0,calls=0;
 const connection=createRingsNowCalendarConnection({
  client:{rpc:async()=>({data:{status:'candidate_snapshot',rows:[row]},error:null})},
  readSession:()=>({user:{id:owner}}),subscribeAuthChanges:f=>{auth=f;return ()=>{}},
  nowMs:()=>start+60000,featureStartedAtMs:rollout});
 await connection.choose(row.id,owner,row.activity_date);
 if(confirmed)connection.confirmGachi(true);
 const elements=Object.fromEntries(['fileInput','ownerCheckbox','gachiCheckbox','sameActivityCheckbox','reviewButton','cancelButton','statusNode','lapsNode'].map(k=>[k,new Element()]));
 const pageEvents=new Events(),visibilityEvents=new Events();
 const handoff=createRingsNowSelectedFitHandoff({connection,elements,document:{createElement:()=>new Element()},
  pageEvents,visibilityEvents,nowMs:()=>start+60000,featureStartedAtMs:rollout,realFitReadEnabled:enabled,
  requestControl:async(...args)=>{assert.equal(args.length,0);calls++;return control?control():signal}});
 const select=(same=true)=>{
  elements.fileInput.files=[{name:'generated-synthetic.fit',size:binary.byteLength,arrayBuffer:async()=>{reads++;return binary.slice(0)}}];
  elements.fileInput.dispatch('change');
  for(const k of ['ownerCheckbox','gachiCheckbox','sameActivityCheckbox']){
   elements[k].checked=k==='sameActivityCheckbox'?same:true;elements[k].dispatch('change');
  }
 };
 return {connection,elements,handoff,pageEvents,visibilityEvents,auth:()=>auth(),reads:()=>reads,calls:()=>calls,
  select,review:()=>elements.reviewButton.dispatch('click')[0],
  close(){handoff.destroy();connection.destroy()}};
}
test('confirmed v03 calendar selection plus same-activity and fresh control reaches existing decoder',async()=>{
 const f=await fixture();f.select();await f.review();
 assert.equal(f.reads(),1);assert.equal(f.calls(),1);
 assert.match(f.elements.statusNode.textContent,/参考候補・未認証/);
 assert.deepEqual(f.elements.lapsNode.children[0].children.map(r=>r.children[1].textContent),['5:15','5:18','5:20','5:24','5:43']);
 f.auth();assert.equal(f.elements.lapsNode.children.length,0);assert.equal(f.elements.sameActivityCheckbox.checked,false);
 f.close();
});
test('disabled real read, missing confirmation or wrong control never reads bytes',async()=>{
 for(const [opts,same,calls] of [[{enabled:false},true,0],[{},false,0],[{confirmed:false},true,0],
  [{signal:{...allow,enabled:false}},true,1],[{signal:{...allow,extra:true}},true,1],
  [{signal:{...allow,build:'v2'}},true,1],[{control:()=>{throw Error('offline')}},true,1]]){
  const f=await fixture(opts);f.select(same);await f.review();
  assert.equal(f.reads(),0);assert.equal(f.calls(),calls);assert.equal(f.elements.lapsNode.children.length,0);f.close();
 }
});
test('auth event during permission check cannot start FIT read',async()=>{
 let release;const f=await fixture({control:()=>new Promise(r=>release=r)});
 f.select();const pending=f.review();f.auth();release(allow);await pending;
 assert.equal(f.reads(),0);assert.equal(f.elements.lapsNode.children.length,0);f.close();
});
test('new selection, cancel and pagehide erase same-activity and visible result',async()=>{
 for(const event of ['new','cancel','hide','file','uncheck']){
  const f=await fixture();f.select();await f.review();
  assert.equal(f.elements.lapsNode.children.length,2);
  assert.match(f.elements.lapsNode.children[1].textContent,/FIT記録範囲/);
  if(event==='new')await f.connection.choose(row.id,owner,row.activity_date);
  if(event==='cancel')f.elements.cancelButton.dispatch('click');
  if(event==='hide')f.pageEvents.dispatch('pagehide');
  if(event==='file')f.elements.fileInput.dispatch('change');
  if(event==='uncheck'){f.elements.sameActivityCheckbox.checked=false;f.elements.sameActivityCheckbox.dispatch('change')}
  assert.equal(f.elements.sameActivityCheckbox.checked,false);
  assert.equal(f.elements.lapsNode.children.length,0);f.close();
 }
});
