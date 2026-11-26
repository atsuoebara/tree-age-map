// Top page owns auth and selection. The opaque frame never receives tokens, owner IDs,
// run IDs or FIT through this channel. Only reduced local context and fixed control messages.
import {normalizeRingsNowControl} from './rings-now-control-client.mjs';
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&
 Object.keys(value).sort().join(',')===keys;
export function mountRingsNowFitScreen({container,connection,isCurrent,document,window,
 featureStartedAtMs,realFitReadEnabled=false,requestControl,english=false}={}){
 const selected=connection.readContext();
 if(!selected||!isCurrent()||!Number.isSafeInteger(featureStartedAtMs)||featureStartedAtMs<0)
  throw new Error('no current selected run');
 const row={...selected.row};
 const token=selected.selectionToken;
 const current=()=>{
  try{
   const live=connection.readContext();
   return !document.hidden&&isCurrent()&&live?.selectionToken===token&&
    live.currentUserId===selected.currentUserId&&live.selectedAsGachiRun===true&&
    live.selectionDate===selected.selectionDate&&
    ['id','user_id','activity_date','distance_km','started_at','deleted_at'].every(k=>live.row[k]===row[k]);
  }catch{return false}
 };
 const iframe=document.createElement('iframe');
 iframe.setAttribute('sandbox','allow-scripts');
 iframe.referrerPolicy='no-referrer';
 iframe.title='Rings Now';
 iframe.style.cssText='display:block;width:100%;height:720px;border:0;border-radius:12px;background:#101926';
 const closeButton=document.createElement('button');
 closeButton.type='button';closeButton.textContent=english?'Close Rings Now':'リングスナウを閉じる';
 let closed=false,loaded=false,ready=false,channel=null,seq=0,busy=false,timer,unsubscribe;
 const destroy=()=>{
  if(closed)return;
  closed=true;clearInterval(timer);unsubscribe?.();
  window.removeEventListener('pagehide',destroy);
  window.removeEventListener('pageshow',onPageShow);
  document.removeEventListener('visibilitychange',onVisibility);
  iframe.removeEventListener('load',onLoad);
  closeButton.removeEventListener('click',onClose);
  channel?.port1.close();iframe.remove();closeButton.remove();
 };
 const onClose=()=>{destroy();connection.clear()};
 const onVisibility=()=>{if(document.hidden)onClose()};
 const onPageShow=e=>{if(e.persisted)onClose()};
 const onLoad=()=>{
  if(closed)return;
  if(loaded||!current()){onClose();return}
  loaded=true;
  channel=new MessageChannel();
  channel.port1.onmessage=async event=>{
   if(closed||!current()){onClose();return}
   const msg=event.data;
   if(exact(msg,'type')&&msg.type==='ready'&&!ready){
    ready=true;
    channel.port1.postMessage({type:'init',featureStartedAtMs,realFitReadEnabled,english,
     context:{currentUserId:'local-selection',selectionToken:'host-bound-selection',
      selectedAsGachiRun:true,selectionDate:row.activity_date,
      row:{id:'1',user_id:'local-selection',activity_date:row.activity_date,
       started_at:row.started_at,distance_km:row.distance_km,deleted_at:null}}});
    return;
   }
   if(exact(msg,'type')&&msg.type==='close'){onClose();return}
   if(!ready||!exact(msg,'seq,type')||msg.type!=='control'||!Number.isSafeInteger(msg.seq)||
      msg.seq<=seq||busy){onClose();return}
   seq=msg.seq;busy=true;
   let signal=null;
   try{
    if(realFitReadEnabled===true&&typeof requestControl==='function')
     signal=normalizeRingsNowControl(await requestControl());
   }catch{/* deny */}
   busy=false;
   if(closed||!current()){onClose();return}
   channel.port1.postMessage({type:'control-result',seq,signal});
  };
  // Opaque sandbox origin cannot be named as a target origin. Transfer only a
  // fresh port to this exact frame window; do not send any run context here.
  iframe.contentWindow.postMessage({type:'rings-now-connect-v1'},'*',[channel.port2]);
 };
 try{
  unsubscribe=connection.subscribeInvalidation(destroy);
  iframe.addEventListener('load',onLoad);
  closeButton.addEventListener('click',onClose);
  window.addEventListener('pagehide',destroy);
  window.addEventListener('pageshow',onPageShow);
  document.addEventListener('visibilitychange',onVisibility);
  timer=setInterval(()=>{if(!current())onClose()},500);
  iframe.src='/rings-now-fit-frame.html';
  container.replaceChildren(closeButton,iframe);
 }catch(error){destroy();throw error}
 return Object.freeze({destroy});
}
