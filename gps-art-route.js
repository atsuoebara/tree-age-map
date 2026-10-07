/* Default-shape road candidates. Inputs and results stay in memory. */
(()=>{
'use strict';
const $=id=>document.getElementById(id),button=$('generateRoute');
if(!button)return;
let preferences=null,result=null,busy=false,requestId=0,controller=null,message='',errorCode='';
const errors={
 AI_NOT_CONFIGURED:['Geminiの設定が必要です。デフォルト素材は使えます。','Gemini needs configuration. Default shapes are available.'],
 AI_UNAVAILABLE:['Geminiから下絵を取得できませんでした。時間を置いてお試しください。','Could not obtain an outline from Gemini. Try again later.'],
 AI_LIMIT:['Geminiの利用上限に達しました。時間を置いてお試しください。','Gemini reached its usage limit. Try again later.'],
 AI_SHAPE_INVALID:['一筆でたどれる下絵にできませんでした。シンプルな輪郭になる説明でお試しください。','Could not make a usable single contour. Try describing a simpler silhouette.'],
 AUTH_REQUIRED:['ログインしてから、もう一度お試しください。','Sign in and try again.'],
 SAFETY_REQUIRED:['安全確認をチェックし、制作条件を確認してください。','Acknowledge safety and review your preferences.'],
 TEMPLATE_ONLY:['許可済み素材は準備中です。デフォルト素材か自由入力を選んでください。','Licensed materials are not ready. Choose a default shape or your own idea.'],
 SERVICE_NOT_CONFIGURED:['生成サービスの設定がまだ完了していません。','The generation service has not been configured yet.'],
 RATE_LIMITED:['連続生成は30秒以上間隔を空けてください。','Wait at least 30 seconds before generating again.'],
 PROVIDER_LIMIT:['経路サービスの利用上限に達しました。時間を置いてお試しください。','The routing service reached its limit. Try again later.'],
 NO_ROUTE:['指定した範囲で経路を作れませんでした。道路データや海・地形などが影響する場合があります。出発点・方角・距離を変えてお試しください。','No route could be made in the requested area. Road data, water or terrain may affect it. Try another start, direction or distance.'],
 START_TOO_FAR:['出発点の近くに候補の開始位置を置けませんでした。道路に近い場所へピンを動かしてください。','The route could not start near your pin. Move the pin closer to a road.'],
 DISTANCE_MISMATCH:['候補の距離が目安から大きく外れるため表示しませんでした。距離や出発点を変えてお試しください。','The candidate was too far from your target distance. Try another distance or start.'],
 SHAPE_MISMATCH:['道路に合わせると形が大きく崩れるため候補を表示しませんでした。別の形・距離・出発点をお試しください。','Roads distorted the shape too much. Try another shape, distance or start.'],
 DIRECTION_MISMATCH:['候補が指定した方角から大きく外れるため表示しませんでした。方角は変更していません。別の出発点や距離をお試しください。','The candidate strayed from your preferred direction. Your direction was not changed. Try another start or distance.'],
 INVALID_START:['この出発点では生成できません。対応範囲は緯度80度以内です。','This start is unsupported. Generation is limited to latitudes within 80 degrees.'],
 INVALID_INPUT:['条件を選び直し、制作条件を確認してください。','Choose your settings again and review preferences.'],
 failed:['候補を生成できませんでした。通信状況を確認し、時間を置いてお試しください。','Could not generate a candidate. Check your connection and try again later.']
};
const en=()=>document.documentElement.lang==='en',state=()=>window.runnerRingsArtAuth?.getState()||'unavailable';
function render(){
 button.classList.toggle('is-pressed',busy||Boolean(result)||Boolean(errorCode));
 button.disabled=busy||state()!=='signedIn'||!preferences||!['template','free'].includes(preferences.material);
 let text='';
 if(errorCode)text=(errors[errorCode]||errors.failed)[en()?1:0];
 else if(message==='loading')text=preferences?.material==='free'?(en()?'Creating an outline with Gemini and calculating a road candidate…':'Geminiで下絵を作り、道路に沿った候補を計算しています…'):(en()?'Calculating a road-based candidate…':'道路に沿った候補を計算しています…');
 else if(result)text=en()?'Candidate shown on the map. Check the shape, actual distance and access before running.':'地図に候補を表示しました。形・実際の距離・通行可否を走る前に確認してください。';
 else if(state()!=='signedIn')text=en()?'Sign in to generate a candidate.':'候補生成にはログインが必要です。';
 else if(!preferences)text=en()?'Confirm your start, acknowledge safety and review preferences first.':'出発点を確定し、安全確認をチェックして「制作条件を確認」を押してください。';
 else if(!['template','free'].includes(preferences.material))text=errors.TEMPLATE_ONLY[en()?1:0];
 else text=preferences.material==='free'?(en()?'Ready to create a candidate from your idea.':'自由入力から候補生成を試せます。'):(en()?'Ready to try a default-shape candidate.':'デフォルト素材の候補生成を試せます。');
 $('routeStatus').textContent=text;
 $('routeDetails').hidden=!result;
 if(result){
  const directions={north:['北','North'],east:['東','East'],south:['南','South'],west:['西','West']};
  $('routeStats').textContent=(en()?'Actual distance: ':'候補の距離：')+result.distanceKm.toFixed(2)+' km · '+(en()?'Target: ':'目安：')+result.requestedDistanceKm+' km · '+directions[result.direction][en()?1:0]+(en()?' · Start offset: ':' · ピンから開始位置まで：')+result.startOffsetM+' m';
 }
}
function clear(){
 requestId++;controller?.abort();controller=null;busy=false;result=null;message='';errorCode='';
 $('startMap').dispatchEvent(new CustomEvent('gps-art-clear-route'));render();
}
function geometryValid(g){return g?.type==='LineString'&&Array.isArray(g.coordinates)&&g.coordinates.length>=2&&g.coordinates.length<=25000&&g.coordinates.every(p=>Array.isArray(p)&&p.length>=2&&typeof p[0]==='number'&&typeof p[1]==='number'&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90);}
function valid(data){return geometryValid(data?.route)&&geometryValid(data?.template)&&typeof data.distanceKm==='number'&&Number.isFinite(data.distanceKm)&&data.distanceKm>0&&[3,5,10,15,20].includes(data.requestedDistanceKm)&&['north','east','south','west'].includes(data.direction)&&typeof data.startOffsetM==='number'&&Number.isFinite(data.startOffsetM)&&data.startOffsetM>=0&&data.startOffsetM<=160;}
window.addEventListener('gps-art-preferences',event=>{preferences=event.detail;clear();});
window.addEventListener('gps-art-auth',event=>{if(event.detail.state==='signedOut'||event.detail.state==='unavailable'){clear();}else render();});
new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
button.addEventListener('click',async()=>{
 if(busy||!preferences||!['template','free'].includes(preferences.material)||state()!=='signedIn')return;
 const input=JSON.parse(JSON.stringify(preferences)),ticket=++requestId;
 const client=window.runnerRingsArtAuth?.getClient();
 if(!client){errorCode='AUTH_REQUIRED';render();return;}
 result=null;busy=true;message='loading';errorCode='';$('startMap').dispatchEvent(new CustomEvent('gps-art-clear-route'));render();
 const requestController=new AbortController();controller=requestController;
 const timer=setTimeout(()=>requestController.abort(),70000);
 try{
  const {data,error}=await client.auth.getSession();if(ticket!==requestId)return;
  if(error||!data?.session?.access_token){errorCode='AUTH_REQUIRED';return;}
  const response=await fetch('https://fhwvntpzwyenendhcgbw.supabase.co/functions/v1/gps-art-generate',{method:'POST',credentials:'omit',signal:requestController.signal,headers:{'Content-Type':'application/json',apikey:'sb_publishable_8ZhwV5lVHGbud8v6AS3YBQ_C78JbXyM',Authorization:'Bearer '+data.session.access_token},body:JSON.stringify(input)});
  const payload=await response.json();if(ticket!==requestId)return;
  if(!response.ok){errorCode=payload?.error|| (response.status===401?'AUTH_REQUIRED':'failed');return;}
  if(!valid(payload))throw new Error('Invalid candidate');
  result=payload;message='';$('startMap').dispatchEvent(new CustomEvent('gps-art-route',{detail:result}));
 }catch{if(ticket===requestId)errorCode='failed';}
 finally{clearTimeout(timer);if(ticket===requestId){busy=false;controller=null;message='';render();}}
});
render();
})();

