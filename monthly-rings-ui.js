/* A-1 Monthly Rings: read-only UI, no uploads and no automatic sharing. */
(() => {
  'use strict';
  const input = document.getElementById('timelapseReviewMonth');
  const host = document.querySelector('.timelapseMonthlyReview');
  const Core = window.RunnerMonthlyRings;
  if (!input || !host || !Core || typeof L === 'undefined') return;
  const container = document.createElement('section');
  container.id = 'monthlyRingsCard';
  container.setAttribute('aria-live','polite');
  container.style.cssText='margin:12px 0;padding:14px;background:#122538;color:#f2f8fc;border:1px solid #78eaff;border-radius:14px;min-width:0';
  host.insertAdjacentElement('afterend',container);
  let previewMap = null;
  let routeGroup = null;
  let lastData = null;
  const english = () => {
    try { return localStorage.getItem('runners-rings-language') === 'en'; }
    catch { return document.documentElement.lang === 'en'; }
  };
  const tr = (ja,en) => english() ? en : ja;
  const km = x => (Math.round((Number(x)||0)*10)/10).toFixed(1);
  const signed = x => (x > 0 ? '+' : '') + (Math.round(x*10)/10).toFixed(1);
  const safe = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const palette = {current:'#78eaff',previous:'#eaff00',priorYear:'#ff76bc'};
  function label(month) {
    if (!month) return '';
    const [year,part] = month.split('-');
    return english() ? month : year + '年' + Number(part) + '月';
  }
  function rows(data) {
    return [
      {key:'current',label:tr('対象月','Selected month'),value:data.current},
      {key:'previous',label:tr('前月','Previous month'),value:data.previous},
      {key:'priorYear',label:tr('前年同月','Same month last year'),value:data.priorYear}
    ];
  }
  let mapScope='focus';
  // Pick the densest local area by route (not by GPS point frequency).
  // Keep all runs and totals; only the viewport is focused.
  function routeViewport(data,scope='focus'){
    const routes=data.series.flatMap(item=>item.routes).filter(route=>route.length>=2);
    if(!routes.length)return null;
    const all=routes.flat();
    if(scope==='all')return boundsOf(all);
    const centers=routes.map(route=>{
      const p=route[Math.floor(route.length/2)];
      return {lat:p[0],lng:p[1]};
    });
    const bins=new Map(),size=.20;
    centers.forEach((c,i)=>{const key=Math.floor(c.lat/size)+','+Math.floor(c.lng/size);if(!bins.has(key))bins.set(key,[]);bins.get(key).push(i);});
    let best=[],bestKey='';
    for(const key of bins.keys()){
      const [a,b]=key.split(',').map(Number);
      const subset=[];
      centers.forEach((c,i)=>{
        if(Math.abs(Math.floor(c.lat/size)-a)<=1&&Math.abs(Math.floor(c.lng/size)-b)<=1)subset.push(i);
      });
      if(subset.length>best.length||(subset.length===best.length&&key<bestKey)){best=subset;bestKey=key;}
    }
    const focused=best.flatMap(i=>routes[i]);
    return boundsOf(focused.length?focused:all);
  }
  function boundsOf(points){
    if(!points.length)return null;
    const lat=points.map(p=>p[0]).sort((a,b)=>a-b);
    const lng=points.map(p=>p[1]).sort((a,b)=>a-b);
    // Use extrema so no selected route is cropped by percentile trimming.
    return {minLat:lat[0],maxLat:lat[lat.length-1],minLng:lng[0],maxLng:lng[lng.length-1]};
  }
  // The in-app map remains unchanged. The saved image deliberately uses
  // three copies of the SAME brand emblem, sized by distance (area scale).
  const logoImage = new Image();
  logoImage.src = './icon.PNG';
  function drawEmblemFallback(ctx,cx,cy,r){
    // Graceful fallback if the site's logo file is unavailable.
    const gradient=ctx.createLinearGradient(cx-r,cy,cx+r,cy);
    gradient.addColorStop(0,'#ff087d');gradient.addColorStop(.55,'#ff598e');gradient.addColorStop(1,'#ffe800');
    ctx.strokeStyle=gradient;ctx.lineWidth=Math.max(5,r*.085);ctx.lineCap='round';
    for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(cx,cy,r*(.95-i*.25),-.25,Math.PI*1.59);ctx.stroke();}
    ctx.font='bold '+Math.round(r*.82)+'px sans-serif';
    ctx.fillStyle=gradient;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('R',cx,cy+5);
  }
  function drawEmblem(ctx,cx,cy,r){
    if(logoImage.complete&&logoImage.naturalWidth>0){
      // The top emblem occupies the upper ~70% of the supplied square icon;
      // omit its Runner's Rings wordmark to keep three comparisons uncluttered.
      const w=logoImage.naturalWidth,h=logoImage.naturalHeight;
      const sx=w*.17,sy=h*.025,sw=w*.66,sh=h*.665;
      ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.clip();
      ctx.drawImage(logoImage,sx,sy,sw,sh,cx-r,cy-r,2*r,2*r);
      ctx.restore();
    }else drawEmblemFallback(ctx,cx,cy,r);
  }
  function routeImage(data) {
    const canvas=document.createElement('canvas');
    canvas.width=1080;canvas.height=1350;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#122438';ctx.fillRect(0,0,1080,1350);
    ctx.textAlign='left';ctx.textBaseline='alphabetic';
    ctx.fillStyle='#f2f8fc';ctx.font='bold 54px sans-serif';
    ctx.fillText(tr('月別の年輪比較','Monthly Rings Comparison'),64,92);
    ctx.font='28px sans-serif';ctx.fillStyle='#b5d2e1';
    ctx.fillText(tr('走った距離が、年輪の大きさになる。','Each ring grows with the distance you run.'),64,143);
    const periods=[
      {item:data.current,title:tr('対象月','Selected month')},
      {item:data.previous,title:tr('先月','Last month')},
      {item:data.priorYear,title:tr('前年同月','Same month last year')}
    ];
    const maxDistance=Math.max(1,...periods.map(p=>Number(p.item.distanceKm)||0));
    const centers=[192,540,888];
    const baseR=139;
    periods.forEach((period,i)=>{
      const item=period.item,amount=Math.max(0,Number(item.distanceKm)||0);
      // Area proportional: radius proportional to sqrt(distance / max).
      const radius=amount>0?Math.max(28,baseR*Math.sqrt(amount/maxDistance)):28;
      const x=centers[i],y=460;
      if(amount===0){
        // No running in this period: show an empty, neutral ring, not a branded
        // full-color achievement. This is a visual placeholder, not a distance scale.
        ctx.save();ctx.strokeStyle='#6b8294';ctx.lineWidth=5;ctx.setLineDash([9,9]);
        ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.stroke();
        ctx.restore();
      }else drawEmblem(ctx,x,y,radius);
      ctx.textAlign='center';ctx.fillStyle=['#78EAFF','#EAFF00','#FF76BC'][i];
      ctx.font='bold 31px sans-serif';ctx.fillText(period.title,x,674);
      ctx.fillStyle='#b5d2e1';ctx.font='26px sans-serif';ctx.fillText(label(item.month),x,716);
      ctx.fillStyle=['#78EAFF','#EAFF00','#FF76BC'][i];ctx.font='bold 38px sans-serif';ctx.fillText(km(amount)+' km',x,785);
      ctx.fillStyle='#b5d2e1';ctx.font='28px sans-serif';ctx.fillText(item.runCount+' '+tr('回','runs'),x,832);
    });
    ctx.strokeStyle='#39566a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(64,938);ctx.lineTo(1016,938);ctx.stroke();
    ctx.textAlign='center';ctx.fillStyle='#e8f8ff';ctx.font='bold 35px sans-serif';
    ctx.fillText(tr('3つの期間、走った努力を比較','Compare your running across three periods'),540,1026);
    ctx.fillStyle='#a9c5d5';ctx.font='25px sans-serif';
    ctx.fillText(tr('年輪の面積は走行距離に比例します','Ring area is proportional to running distance'),540,1086);
    ctx.textAlign='left';ctx.fillStyle='#a9c5d5';ctx.font='28px sans-serif';
    ctx.fillText('Runner’s Rings  |  runnersrings.com',64,1305);
    return canvas;
  }
  async function shareImage(){
    if(!lastData)return;
    if(!logoImage.complete){
      await new Promise(resolve=>{
        logoImage.addEventListener('load',resolve,{once:true});
        logoImage.addEventListener('error',resolve,{once:true});
        setTimeout(resolve,3000);
      });
    }
    const snapshot=lastData;
    const canvas=routeImage(snapshot);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob)return;
    const url=URL.createObjectURL(blob);
    const file=new File([blob],'runners-rings-monthly-'+snapshot.current.month+'.png',{type:'image/png'});
    const overlay=document.createElement('div');
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label',tr('年輪画像のプレビュー','Rings image preview'));
    overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;background:rgba(4,13,26,.94);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;box-sizing:border-box';
    const img=document.createElement('img');
    img.src=url;img.alt=tr('保存する年輪画像','Rings image to be saved');
    img.style.cssText='display:block;max-width:100%;max-height:calc(100dvh - 170px);object-fit:contain;border-radius:12px';
    const actions=document.createElement('div');
    actions.style.cssText='display:flex;flex-wrap:wrap;justify-content:center;gap:10px';
    function action(label,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='padding:11px 16px;border-radius:9px;border:1px solid #78eaff;background:#17374b;color:white;font-weight:700';b.onclick=fn;actions.append(b);return b}
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    let closed=false;
    function close(){if(closed)return;closed=true;overlay.remove();document.body.style.overflow=previousOverflow;document.removeEventListener('keydown',onKey);URL.revokeObjectURL(url)}
    function onKey(e){if(e.key==='Escape')close()}
    action(tr('画像を保存','Save image'),()=>{const a=document.createElement('a');a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove()});
    action(tr('共有する','Share'),async()=>{
      if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
        try{await navigator.share({files:[file],title:'Runner’s Rings — Monthly Rings'});}
        catch(e){if(e?.name!=='AbortError')console.warn('Monthly Rings share:',e)}
      }else{
        const a=document.createElement('a');a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();
      }
    });
    action(tr('閉じる','Close'),close);
    const note=document.createElement('p');note.textContent=tr('この画像にはGPS軌跡は含まれません。','GPS routes are not included in this image.');
    note.style.cssText='color:#bbd4e0;text-align:center;font-size:12px;margin:0';
    overlay.append(img,actions,note);
    overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
    document.addEventListener('keydown',onKey);
    document.body.append(overlay);
    actions.querySelector('button')?.focus();
  }
  function render(){
    if(!input.value){const today=new Date();input.value=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0');}
    let data;
    try {
      if(typeof activities==='undefined')return;
      data=Core.compare(activities,input.value);
      data.series=Core.series(activities,input.value);
    } catch(e) {console.warn('Monthly Rings:',e);return;}
    lastData=data;
    const totals=rows(data);
    container.innerHTML=
      '<h3 style="font-size:19px;margin:0 0 8px;color:#78eaff">🌱 '+tr('月別の年輪比較','Monthly Rings Comparison')+' — '+safe(label(input.value))+'</h3>'+
      '<p style="font-size:12px;margin:0 0 10px;color:#aac5d4">'+tr('選択した月の走行ルートを、前月・前年同月と比較します。動画は上の「月の振り返り動画を作る」から作成できます。','Compare the selected month with the previous month and the same month last year. Create a video using the monthly recap button above.')+'</p>'+
      '<div style="display:flex;gap:8px;margin:0 0 9px"><button type="button" id="monthlyRingsFocus" style="padding:7px 12px;border-radius:8px;border:1px solid #78eaff;background:'+(mapScope==='focus'?'#78eaff':'#18364a')+';color:'+(mapScope==='focus'?'#0e2537':'#e7f6ff')+'">'+tr('主要エリア','Main area')+'</button><button type="button" id="monthlyRingsAll" style="padding:7px 12px;border-radius:8px;border:1px solid #78eaff;background:'+(mapScope==='all'?'#78eaff':'#18364a')+';color:'+(mapScope==='all'?'#0e2537':'#e7f6ff')+'">'+tr('全エリア','All areas')+'</button></div>'+
      '<div id="monthlyRingsMap" role="img" aria-label="'+tr('月別GPS軌跡の重ね合わせ','Monthly GPS route overlay')+'" style="height:270px;border-radius:10px;background:#19364c;overflow:hidden"></div>'+
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:10px 0;font-size:11px">'+totals.map(r=>'<span style="border-left:4px solid '+palette[r.key]+';padding:4px 8px;background:#1b354a">'+r.label+' ('+safe(label(r.value.month))+')</span>').join('')+'</div>'+
      '<div style="display:grid;gap:7px;font-size:13px">'+totals.map(r=>'<div style="padding:7px 10px;border:1px solid #395870;border-radius:8px"><strong>'+r.label+'</strong>'+tr('：',': ')+r.value.runCount+' '+tr('回','runs')+' / '+km(r.value.distanceKm)+' km</div>').join('')+'</div>'+
      '<p style="font-size:12px;margin:10px 0">'+tr('前月との差','Vs. previous month')+tr('：',': ')+(data.previousDelta.runs>0?'+':'')+data.previousDelta.runs+' '+tr('回','runs')+' / '+signed(data.previousDelta.km)+' km<br>'+
      tr('前年同月との差','Vs. last year')+tr('：',': ')+(data.priorYearDelta.runs>0?'+':'')+data.priorYearDelta.runs+' '+tr('回','runs')+' / '+signed(data.priorYearDelta.km)+' km</p>'+
      (data.current.runCount===0?'<p>'+tr('選択した月のランニング記録はありません。','No runs recorded for the selected month.')+'</p>':'')+
      '<button id="monthlyRingsShare" type="button" style="background:#78eaff;color:#102332;border:0;border-radius:8px;padding:10px 15px;font-weight:800;cursor:pointer">'+tr('年輪画像を保存・共有','Save or share rings image')+'</button>'+
      '<p style="font-size:11px;color:#a6bfd0;margin:9px 0 0">'+tr('共有画像にはGPS軌跡は含まれません。期間・距離・回数が表示されます。','The shared image contains no GPS routes; it shows periods, distances and run counts.')+'</p>';
    container.querySelector('#monthlyRingsShare')?.addEventListener('click',shareImage);
    container.querySelector('#monthlyRingsFocus')?.addEventListener('click',()=>{mapScope='focus';render();});
    container.querySelector('#monthlyRingsAll')?.addEventListener('click',()=>{mapScope='all';render();});
    if(previewMap){previewMap.remove();previewMap=null;}
    const el=container.querySelector('#monthlyRingsMap');
    previewMap=L.map(el,{attributionControl:true,zoomControl:false,scrollWheelZoom:false,dragging:false,keyboard:false,touchZoom:false, doubleClickZoom:false});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors',crossOrigin:true}).addTo(previewMap);
    routeGroup=L.featureGroup().addTo(previewMap);
    data.series.slice().reverse().forEach(s=>s.routes.forEach(route=>{
      if(route.length>=2){
        L.polyline(route,{color:'#092236',weight:s.key==='current'?8:7,opacity:.9,interactive:false}).addTo(routeGroup);
        L.polyline(route,{color:palette[s.key],weight:s.key==='current'?4:3,opacity:s.key==='current'?1:.85,interactive:false}).addTo(routeGroup);
      }
    }));
    const view=routeViewport(data,mapScope);
    if(view){
      const bounds=L.latLngBounds([view.minLat,view.minLng],[view.maxLat,view.maxLng]);
      previewMap.fitBounds(bounds.pad(.20),{animate:false,maxZoom:13});
    } else previewMap.setView([36,139],4,{animate:false});
    requestAnimationFrame(()=>previewMap?.invalidateSize());
  }
  // Activity imports are asynchronous. Reconcile cards rendered before data arrived.
  // Do not treat a temporary empty activities array as a completed 0-run month.
  let lastActivityCount = -1;
  let lastMonthValue = '';
  function refreshWhenDataArrives() {
    if (typeof activities === 'undefined' || !Array.isArray(activities)) return;
    const count=activities.length;
    if (count!==lastActivityCount || input.value!==lastMonthValue) {
      lastActivityCount=count;
      lastMonthValue=input.value;
      render();
    }
  }
  // Stop after one minute; user interaction and month changes continue to refresh normally.
  const importWatch=setInterval(refreshWhenDataArrives,1200);
  setTimeout(()=>clearInterval(importWatch),60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshWhenDataArrives();});
  window.addEventListener('focus',refreshWhenDataArrives);
  input.addEventListener('change',render);
  // Data may be imported after page load; recompute on opening the parent panel.
  const open=document.getElementById('timelapseOpenButton');
  open?.addEventListener('click',()=>setTimeout(render,0));
  document.getElementById('rrPersonalProgress')?.addEventListener('click',()=>setTimeout(render,0));
  render();
})();
