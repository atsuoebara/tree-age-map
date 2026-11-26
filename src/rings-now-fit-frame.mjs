// Opaque sandbox frame. No network APIs, provider clients, storage, or FIT egress.
import {createRingsNowSelectedFitHandoff} from './rings-now-selected-fit-handoff.mjs';
const REAL_FIT_SCREEN_ENABLED=false; // Separate explicit approval required.
const PARENT_ORIGIN='https://runnersrings.com';
const state=document.getElementById('state'),screen=document.getElementById('screen');
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys;
let port=null,context=null,handoff=null,initialized=false,closed=false,pending=null,seq=0;
const listeners=new Set();
const connection={
 readContext:()=>context,
 subscribeInvalidation(fn){listeners.add(fn);return ()=>listeners.delete(fn)}
};
function revoke(){
 if(closed)return;
 closed=true;context=null;
 for(const fn of [...listeners])fn();
 handoff?.destroy();screen.replaceChildren();
 if(pending){clearTimeout(pending.timer);pending.resolve(null);pending=null}
 port?.close();
 state.textContent='選択を解除しました。 / Selection cleared.';
}
function requestControl(){
 if(closed||!port||pending)return Promise.resolve(null);
 return new Promise(resolve=>{
  const id=++seq;
  pending={id,resolve,timer:setTimeout(()=>{pending=null;resolve(null)},4500)};
  port.postMessage({type:'control',seq:id});
 });
}
function render(msg){
 const en=msg.english===true,t=(ja,english)=>en?english:ja;
 document.documentElement.lang=en?'en':'ja';
 if(REAL_FIT_SCREEN_ENABLED!==true||msg.realFitReadEnabled!==true){
  state.textContent=t('現在は利用できません。','Not available yet.');return;
 }
 context=msg.context;
 if(!context?.row||!Number.isSafeInteger(msg.featureStartedAtMs)||msg.featureStartedAtMs<0){
  revoke();return;
 }
 const el=(tag,content)=>{const node=document.createElement(tag);if(content)node.textContent=content;return node};
 const panel=el('section');panel.className='panel';
 const date=el('p',t('選択したラン：','Selected run: ')+context.row.activity_date+' · '+Number(context.row.distance_km).toFixed(2)+' km');
 const fileInput=el('input');fileInput.type='file';fileInput.accept='.fit,application/octet-stream';
 const fileLabel=el('label',t('このランのFITファイルを選択','Choose the FIT file for this run'));
 fileLabel.append(fileInput);
 const checkbox=(ja,english)=>{
  const label=el('label'),input=el('input');input.type='checkbox';
  label.append(input,document.createTextNode(' '+t(ja,english)));panel.append(label);return input;
 };
 panel.append(date,fileLabel);
 const ownerCheckbox=checkbox('自分のFITであることを確認','This is my own FIT file');
 const gachiCheckbox=checkbox('ガチランとして確認','I confirm this is a hard run');
 const sameActivityCheckbox=checkbox('選んだランと同じ活動のFITです','This FIT is from the selected activity');
 const reviewButton=el('button',t('端末内で1km解析','Review 1km splits on this device'));reviewButton.type='button';
 const cancelButton=el('button',t('選択と結果を消す','Clear selection and results'));cancelButton.type='button';
 const statusNode=el('p');statusNode.setAttribute('role','status');
 const lapsNode=el('div');lapsNode.className='laps';
 const warning=el('p',t('信号待ちやトイレ休憩、自動ポーズなどの影響により、正しく分析できない場合があります。',
  'Traffic lights, restroom breaks, and auto-pause may affect the accuracy of this analysis.'));
 warning.className='warning';
 panel.append(reviewButton,cancelButton,statusNode,lapsNode,warning);
 screen.replaceChildren(panel);
 state.textContent=t('FITはアップロードせず、端末内で確認します。結果は保存しません。',
  'FIT is not uploaded. Review takes place on this device; results are not saved.');
 handoff=createRingsNowSelectedFitHandoff({connection,
  elements:{fileInput,ownerCheckbox,gachiCheckbox,sameActivityCheckbox,reviewButton,cancelButton,statusNode,lapsNode},
  document,pageEvents:window,visibilityEvents:document,nowMs:Date.now,
  featureStartedAtMs:msg.featureStartedAtMs,realFitReadEnabled:REAL_FIT_SCREEN_ENABLED,requestControl});
}
window.addEventListener('message',event=>{
 if(port||closed||window.parent===window||window.origin!=='null'||
    event.source!==window.parent||event.origin!==PARENT_ORIGIN||
    !exact(event.data,'type')||event.data.type!=='rings-now-connect-v1'||event.ports.length!==1)return;
 port=event.ports[0];
 port.onmessage=e=>{
  const msg=e.data;
  if(!initialized&&exact(msg,'context,english,featureStartedAtMs,realFitReadEnabled,type')&&msg.type==='init'){
   initialized=true;
   try{render(msg)}catch{revoke()}
   return;
  }
  if(exact(msg,'seq,signal,type')&&msg.type==='control-result'&&pending?.id===msg.seq){
   const p=pending;pending=null;clearTimeout(p.timer);p.resolve(msg.signal);
  }
 };
 port.postMessage({type:'ready'});
});
window.addEventListener('pagehide',revoke);
window.addEventListener('pageshow',e=>{if(e.persisted)revoke()});
document.addEventListener('visibilitychange',()=>{if(document.hidden)revoke()});
