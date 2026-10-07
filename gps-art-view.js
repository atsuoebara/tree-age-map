/* Route preview only. No location tracking or navigation instructions. */
(()=>{
'use strict';
const source=document.getElementById('startMap');
if(!source||!window.L)return;
const en=()=>document.documentElement.lang==='en';
const words={
 open:['全画面でルートを確認','View route full screen'],play:['再生','Play'],pause:['一時停止','Pause'],
 restart:['最初から','Restart'],overview:['全体図','Overview'],close:['閉じる','Close'],
 title:['ルートの事前確認 · 北が上','Route preview · North up'],
 note:['候補ルートの再生です。現在地の追跡・走行ナビではありません。','Candidate preview, not live tracking or navigation.'],
 complete:['ゴール · 全体図','Finish · Overview'],progress:['再生位置','Preview progress'],
 speed:['再生速度','Preview speed'],tiles:['背景地図を読み込めません。通信状況を確認してください。','Map tiles could not load. Check your connection.']
};
const text=k=>words[k][en()?1:0];
const css=document.createElement('style');
css.textContent=`
.artViewer{position:fixed;inset:0;z-index:10000;background:#0b1422;display:flex;flex-direction:column;height:100vh;height:100dvh;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
.artViewer[hidden]{display:none}
.artViewer header{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;gap:8px}
.artViewer h2{font-size:16px;margin:0;color:white}
.artViewer .button{padding:10px 14px;min-height:44px}
.artViewerMap{flex:1;min-height:160px;width:100%;background:#182538}
.artViewerControls{padding:8px 12px;display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.artViewerControls input{flex:1;min-width:140px;accent-color:#ff6a00}
.artViewerControls select{width:auto;padding:8px;min-height:44px}
.artViewer p{margin:0;padding:0 12px 8px;font-size:12px;color:#b4c6d9}
.artViewerProgress{font-size:14px;color:#fff;min-width:105px}
.artViewerDot{border:3px solid #fff;border-radius:50%;background:#ff6a00;box-shadow:0 0 0 4px #14223380}
.artViewerTag{background:#142233;color:white;border:1px solid #fff}
.artViewerOpen{margin-top:10px}
`;
document.head.appendChild(css);
const open=document.createElement('button');open.type='button';open.className='button primary artViewerOpen';open.hidden=true;
source.insertAdjacentElement('afterend',open);
const panel=document.createElement('div');panel.className='artViewer';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
panel.innerHTML='<header><h2 id="artViewerTitle"></h2><button type="button" class="button" data-control="close"></button></header><div class="artViewerMap"></div><div class="artViewerControls"><button type="button" class="button primary" data-control="play"></button><button type="button" class="button" data-control="restart"></button><button type="button" class="button" data-control="overview"></button><select data-control="speed"><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select><input data-control="seek" type="range" min="0" max="1000" value="0"><span class="artViewerProgress" role="status" aria-live="off"></span></div><p data-control="note"></p><p data-control="error" role="status"></p>';
panel.setAttribute('aria-labelledby','artViewerTitle');document.body.appendChild(panel);
const q=k=>panel.querySelector('[data-control="'+k+'"]'),display=panel.querySelector('.artViewerProgress');
let candidate=null,map=null,outline=null,trail=null,dot=null,startTag=null,finishTag=null;
let points=[],lengths=[],total=0,distance=0,playing=false,frame=0,lastTime=0,overview=false,previousFocus=null,oldOverflow='',lastFollow=0;
function labels(){
 open.textContent=text('open');panel.querySelector('h2').textContent=text('title');
 for(const k of ['restart','overview','close','note'])q(k).textContent=text(k);
 q('play').textContent=text(playing?'pause':'play');q('play').setAttribute('aria-pressed',String(playing));
 q('seek').setAttribute('aria-label',text('progress'));q('speed').setAttribute('aria-label',text('speed'));
 display.textContent=overview&&distance>=total?text('complete'):((total?distance/total:0)*100).toFixed(0)+'% · '+(distance/1000).toFixed(2)+' km';
}
function pause(){playing=false;cancelAnimationFrame(frame);frame=0;lastTime=0;labels();}
function prepare(){
 points=candidate.route.coordinates.map(p=>L.latLng(p[1],p[0]));lengths=[0];total=0;
 for(let i=1;i<points.length;i++){total+=points[i-1].distanceTo(points[i]);lengths.push(total);}
 distance=0;overview=false;
}
function position(at){
 let lo=1,hi=lengths.length-1;
 while(lo<hi){const mid=(lo+hi)>>1;if(lengths[mid]<at)lo=mid+1;else hi=mid;}
 const i=lo,a=points[i-1],b=points[i],span=lengths[i]-lengths[i-1],f=span?Math.max(0,Math.min(1,(at-lengths[i-1])/span)):0;
 return {i,p:L.latLng(a.lat+(b.lat-a.lat)*f,a.lng+(b.lng-a.lng)*f)};
}
function draw(follow=true){
 if(!map||!points.length)return;
 const {i,p}=position(distance);trail.setLatLngs(points.slice(0,i).concat([p]));dot.setLatLng(p);
 q('seek').value=String(Math.round(total?distance/total*1000:0));
 if(follow)map.panTo(p,{animate:false});labels();
}
function whole(){
 pause();overview=true;trail.setLatLngs(points);map.fitBounds(outline.getBounds(),{padding:[30,30],maxZoom:17,animate:!window.matchMedia('(prefers-reduced-motion: reduce)').matches});labels();
}
function tick(now){
 if(!playing)return;
 if(lastTime)distance=Math.min(total,distance+Math.min(now-lastTime,250)/1000*45*Number(q('speed').value));
 lastTime=now;
 // Follow about five times a second; do not create overlapping pan animations.
 draw(now-lastFollow>=200);if(now-lastFollow>=200)lastFollow=now;
 if(distance>=total){whole();return;}frame=requestAnimationFrame(tick);
}
function play(){
 if(!map||!total)return;
 if(distance>=total)distance=0;
 overview=false;map.setView(position(distance).p,Math.max(17,map.getZoom()),{animate:false});draw();
 playing=true;lastTime=0;lastFollow=0;labels();frame=requestAnimationFrame(tick);
}
function close(){
 pause();if(panel.hidden)return;panel.hidden=true;document.body.style.overflow=oldOverflow;
 previousFocus?.focus();
}
function show(){
 if(!candidate||!panel.hidden)return;
 previousFocus=document.activeElement;oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';panel.hidden=false;
 try{
  if(!map){
   map=L.map(panel.querySelector('.artViewerMap'),{zoomControl:true,scrollWheelZoom:true});
   L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileerror',()=>{q('error').textContent=text('tiles');}).addTo(map);
   map.on('dragstart',()=>{pause();overview=false;});
  }
  for(const layer of [outline,trail,dot,startTag,finishTag])if(layer)map.removeLayer(layer);
  prepare();
  outline=L.polyline(points,{color:'#ff6a00',weight:5,opacity:0.28,interactive:false}).addTo(map);
  trail=L.polyline([points[0]],{color:'#ff6a00',weight:7,opacity:1,className:'gpsArtRoute',interactive:false}).addTo(map);
  dot=L.marker(points[0],{icon:L.divIcon({className:'artViewerDot',iconSize:[20,20],iconAnchor:[10,10]}),interactive:false}).addTo(map);
  startTag=L.circleMarker(points[0],{radius:5,color:'#163025',fillColor:'#4aff9b',fillOpacity:1}).addTo(map).bindTooltip(en()?'Start':'スタート',{permanent:true,direction:'left',className:'artViewerTag'});
  finishTag=L.circleMarker(points[points.length-1],{radius:5,color:'#163025',fillColor:'#4aff9b',fillOpacity:1}).addTo(map).bindTooltip(en()?'Finish':'ゴール',{permanent:true,direction:'right',className:'artViewerTag'});
  map.invalidateSize();map.setView(points[0],17,{animate:false});draw();q('close').focus();play();
 }catch{close();}
}
open.addEventListener('click',show);
q('close').addEventListener('click',close);
q('play').addEventListener('click',()=>playing?pause():play());
q('restart').addEventListener('click',()=>{pause();distance=0;play();});
q('overview').addEventListener('click',whole);
q('seek').addEventListener('input',()=>{pause();overview=false;distance=total*Number(q('seek').value)/1000;map.setView(position(distance).p,17,{animate:false});draw();if(distance>=total)whole();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
document.addEventListener('keydown',e=>{
 if(panel.hidden)return;
 if(e.key==='Escape'){e.preventDefault();close();}
 if(e.key==='Tab'){
  const controls=Array.from(panel.querySelectorAll('button,select,input,a[href],.leaflet-container')).filter(el=>!el.disabled&&el.tabIndex>=0);
  const first=controls[0],last=controls[controls.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 }
});
window.addEventListener('resize',()=>{if(!panel.hidden&&map){map.invalidateSize();if(overview)whole();}});
source.addEventListener('gps-art-route',e=>{close();candidate=e.detail;open.hidden=false;});
source.addEventListener('gps-art-clear-route',()=>{close();candidate=null;open.hidden=true;});
new MutationObserver(labels).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
labels();
})();
