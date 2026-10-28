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
      {key:'previous',label:tr('先月','Previous month'),value:data.previous},
      {key:'priorYear',label:tr('前年同月','Same month last year'),value:data.priorYear}
    ];
  }
  function routeImage(data) {
    const canvas = document.createElement('canvas');
    canvas.width = 1080; canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#122538';ctx.fillRect(0,0,1080,1350);
    ctx.fillStyle = '#f2f8fc';ctx.font = 'bold 54px sans-serif';ctx.fillText(tr('今月の年輪','Monthly Rings'),64,92);
    ctx.font='34px sans-serif';ctx.fillText(label(data.current.month),64,148);
    ctx.fillStyle='#1b354a';ctx.fillRect(44,194,992,858);
    const all = data.series.flatMap(item => item.routes.flat()).filter(a=>a.length===2);
    if(all.length){
      let minLat=90,maxLat=-90,minLng=180,maxLng=-180;
      for(const p of all){if(p[0]<minLat)minLat=p[0];if(p[0]>maxLat)maxLat=p[0];if(p[1]<minLng)minLng=p[1];if(p[1]>maxLng)maxLng=p[1];}
      // Keep geographic aspect ratio and protect single-coordinate spans.
      const scaleLng=Math.max(.05,Math.cos((minLat+maxLat)*Math.PI/360));
      const dx=Math.max((maxLng-minLng)*scaleLng, .0002);
      const dy=Math.max(maxLat-minLat,.0002);
      const scale=Math.min(860/dx,720/dy);
      const cx=(minLng+maxLng)/2,cy=(minLat+maxLat)/2;
      const project=p=>[540+(p[1]-cx)*scaleLng*scale,620-(p[0]-cy)*scale];
      for (const series of data.series.slice().reverse()){
        ctx.strokeStyle=palette[series.key];ctx.lineWidth=series.key==='current'?5:3;ctx.globalAlpha=series.key==='current'?1:.65;
        for(const route of series.routes) {
          if(route.length<2)continue;
          ctx.beginPath();route.forEach((p,i)=>{const [x,y]=project(p);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();
        }
      }
      ctx.globalAlpha=1;
    } else {
      ctx.fillStyle='#d5e7f0';ctx.font='32px sans-serif';ctx.textAlign='center';
      ctx.fillText(tr('GPS軌跡はありません','No GPS routes'),540,650);ctx.textAlign='left';
    }
    ctx.font='bold 31px sans-serif';
    data.series.forEach((item,i)=>{
      const y=1105+i*55;ctx.fillStyle=palette[item.key];ctx.fillRect(64,y-25,24,24);
      ctx.fillStyle='#f2f8fc';
      ctx.fillText(label(item.month)+'   '+item.runCount+' '+tr('回','runs')+'   '+km(item.distanceKm)+' km',106,y);
    });
    ctx.font='28px sans-serif';ctx.fillStyle='#9fbbcb';ctx.fillText('Runner’s Rings  |  runnersrings.com',64,1310);
    return canvas;
  }
  async function shareImage(){
    if(!lastData)return;
    const canvas=routeImage(lastData);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob)return;
    const file=new File([blob], 'runners-rings-monthly-'+lastData.current.month+'.png',{type:'image/png'});
    if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
      try {await navigator.share({files:[file],title:'Runner’s Rings — Monthly Rings'});}
      catch(e){if(e?.name!=='AbortError')console.warn('Monthly Rings share:',e);}
      return;
    }
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=file.name;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
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
      '<h3 style="font-size:19px;margin:0 0 8px;color:#78eaff">🌱 '+tr('今月の年輪','Monthly Rings')+'</h3>'+
      '<p style="font-size:12px;margin:0 0 10px;color:#aac5d4">'+tr('自分が走った軌跡を、先月と前年同月に重ねて振り返ります。','Revisit your own routes alongside last month and the same month last year.')+'</p>'+
      '<div id="monthlyRingsMap" role="img" aria-label="'+tr('月別GPS軌跡の重ね合わせ','Monthly GPS route overlay')+'" style="height:270px;border-radius:10px;background:#19364c;overflow:hidden"></div>'+
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:10px 0;font-size:11px">'+totals.map(r=>'<span style="border-left:4px solid '+palette[r.key]+';padding:4px 8px;background:#1b354a">'+r.label+' ('+safe(label(r.value.month))+')</span>').join('')+'</div>'+
      '<div style="display:grid;gap:7px;font-size:13px">'+totals.map(r=>'<div style="padding:7px 10px;border:1px solid #395870;border-radius:8px"><strong>'+r.label+'</strong>'+tr('：',': ')+r.value.runCount+' '+tr('回','runs')+' / '+km(r.value.distanceKm)+' km</div>').join('')+'</div>'+
      '<p style="font-size:12px;margin:10px 0">'+tr('先月との差','Vs. last month')+''+tr('：',': ')+(data.previousDelta.runs>0?'+':'')+data.previousDelta.runs+' '+tr('回','runs')+' / '+signed(data.previousDelta.km)+' km<br>'+
      tr('前年同月との差','Vs. last year')+''+tr('：',': ')+(data.priorYearDelta.runs>0?'+':'')+data.priorYearDelta.runs+' '+tr('回','runs')+' / '+signed(data.priorYearDelta.km)+' km</p>'+
      (data.current.runCount===0?'<p>'+tr('この月はまだ走っていません。','No runs recorded for this month.')+'</p>':'')+
      '<button id="monthlyRingsShare" type="button" style="background:#78eaff;color:#102332;border:0;border-radius:8px;padding:10px 15px;font-weight:800;cursor:pointer">'+tr('年輪画像を保存・共有','Save or share rings image')+'</button>'+
      '<p style="font-size:11px;color:#a6bfd0;margin:9px 0 0">'+tr('画像にはGPS軌跡が含まれます。公開先を確認してから共有してください。','The image contains GPS routes. Review the destination before sharing.')+'</p>';
    container.querySelector('#monthlyRingsShare')?.addEventListener('click',shareImage);
    if(previewMap){previewMap.remove();previewMap=null;}
    const el=container.querySelector('#monthlyRingsMap');
    previewMap=L.map(el,{attributionControl:true,zoomControl:false,scrollWheelZoom:false,dragging:false,keyboard:false,touchZoom:false, doubleClickZoom:false});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors',crossOrigin:true}).addTo(previewMap);
    routeGroup=L.featureGroup().addTo(previewMap);
    data.series.slice().reverse().forEach(s=>s.routes.forEach(route=>{
      if(route.length>=2)L.polyline(route,{color:palette[s.key],weight:s.key==='current'?4:3,opacity:s.key==='current'?1:.62}).addTo(routeGroup);
    }));
    if(routeGroup.getLayers().length)previewMap.fitBounds(routeGroup.getBounds().pad(.15),{animate:false,maxZoom:13});
    else previewMap.setView([36,139],4,{animate:false});
    requestAnimationFrame(()=>previewMap?.invalidateSize());
  }
  input.addEventListener('change',render);
  // Data may be imported after page load; recompute on opening the parent panel.
  const open=document.getElementById('timelapseOpenButton');
  open?.addEventListener('click',()=>setTimeout(render,0));
  document.getElementById('rrPersonalProgress')?.addEventListener('click',()=>setTimeout(render,0));
  render();
})();
