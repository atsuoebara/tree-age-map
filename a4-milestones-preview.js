/* A-4 first 30 km: private, read-only eligible-runs preview. No DB writes. */
(function(root){
  'use strict';
  function init(){
    const anchor=document.getElementById('cloudRunsButton');
    const app=document.getElementById('appRoot');
    if(!anchor||!app||!root.RunnerMilestones)return;
    const button=document.createElement('button');
    button.type='button';
    button.id='a4MilestonePreviewButton';
    button.textContent='🌳 年輪の節（対象記録内）';
    button.style.cssText='min-height:44px;padding:10px 14px;margin:6px;border:2px solid #83e4ac;border-radius:12px;background:#153c33;color:#bbf8cd;font-weight:800;cursor:pointer;max-width:100%';
    const panel=document.createElement('section');
    panel.id='a4MilestonePreviewPanel';
    panel.hidden=true;
    panel.style.cssText='box-sizing:border-box;width:100%;max-width:550px;margin:12px auto;padding:16px;border:1px solid #83e4ac;border-radius:14px;background:#102e2b;color:#f1fff6;overflow-wrap:anywhere;scroll-margin-top:112px';
    const title=document.createElement('h3');
    title.style.cssText='margin:0 0 10px;font-size:19px';
    const result=document.createElement('p');
    result.setAttribute('aria-live','polite');
    result.style.cssText='margin:0 0 10px;line-height:1.6';
    const note=document.createElement('p');
    note.style.cssText='font-size:12px;line-height:1.5;opacity:.9;margin:8px 0';
    // Keep the milestone identity visible immediately above the selected map.
    const mapElement=document.getElementById('map');
    const mapContext=document.createElement('div');
    mapContext.id='a4MilestoneMapContext';
    mapContext.hidden=true;
    mapContext.setAttribute('role','status');
    mapContext.style.cssText='box-sizing:border-box;max-width:100%;padding:12px 14px;margin:8px 0;background:#153c33;border:2px solid #83e4ac;border-radius:12px;color:#eaffef;font-weight:700;line-height:1.5;scroll-margin-top:112px;overflow-wrap:anywhere';
    mapElement?.insertAdjacentElement('beforebegin',mapContext);
    const openList=document.createElement('button');
    openList.type='button';openList.hidden=true;
    openList.style.cssText='min-height:44px;padding:10px 12px;border-radius:10px;cursor:pointer';
    openList.addEventListener('click',function(){
      // Open the milestone activity itself, not the newest-first history list.
      // The existing map focus handler already selects its route and scrolls to it.
      if(panel.hidden || lastState?.kind!=='found' || !lastState.row)return;
      if(!owner || (typeof currentUser!=='undefined' && currentUser?.id!==owner))return;
      if(typeof focusCloudRun!=='function'){
        result.textContent=en()?'Unable to open this run.':'このランを開けませんでした。';
        return;
      }
      openList.disabled=true;
      openList.textContent=en()?'Opening the run on the map…':'地図に移動しています…';
      try{
        const target=lastState.row;
        focusCloudRun(target);
        if(mapContext.isConnected){
          mapContext.hidden=false;
          updateMapContext(target);
          // focusCloudRun itself scrolls to #map; move a little higher so the
          // date/distance banner directly above the map remains visible.
          setTimeout(function(){
            if(owner && currentUser?.id===owner && !mapContext.hidden){
              mapContext.scrollIntoView({behavior:'smooth',block:'start'});
            }
          },80);
        }
      }catch(error){
        console.warn('A-4 milestone map focus failed:',error);
        result.textContent=en()?'Unable to open this run. Please try again.':'このランを開けませんでした。もう一度お試しください。';
      }finally{
        // Keep a visible tap acknowledgment but allow another attempt.
        setTimeout(function(){
          openList.disabled=false;
          labels();
        },1200);
      }
    });
    // Clear milestone context when the user chooses a different saved run.
    document.getElementById('cloudRunsList')?.addEventListener('click',function(event){
      if(event.target?.closest?.('.cloudRunRow')){
        mapContext.hidden=true;
      }
    });
    panel.append(title,result,note,openList);
    anchor.insertAdjacentElement('afterend',button);
    document.getElementById('importArea')?.insertAdjacentElement('afterend',panel);
    let epoch=0;
    let owner=null;
    let lastState=null;
    function en(){return document.documentElement.lang==='en';}
    function labels(){
      const english=en();
      button.textContent=english?'🌳 Growth milestone (eligible records)':'🌳 年輪の節（対象記録内）';
      title.textContent=english?'First 30 km run (eligible records)':'初めての30km走（対象記録内）';
      note.textContent=english
        ? 'Based on eligible saved FIT and Strava running records only; GPX, TCX, Garmin and other unverified sources are excluded. Strava-linked records may retain distance and GPS route from the original import. Results may change when older eligible runs are imported or records are deleted.'
        : '現在はFIT経由とStravaでラン種目を確認できた保存済み記録だけを対象にしています。GPX・TCX・Garminなど未検証の経路は対象外です。Stravaと紐付いた既存記録は元の距離・GPSルートを使う場合があります。過去の対象記録の追加・削除で結果が変わる場合があります。';
      openList.textContent=english?'🗺 View this run on the map':'🗺 このランを地図で表示';
    }
    function clear(){
      epoch++;owner=null;lastState=null;panel.hidden=true;openList.hidden=true;result.textContent='';
      mapContext.hidden=true;mapContext.textContent='';
    }
    function updateMapContext(row){
      if(!row)return;
      const date=new Intl.DateTimeFormat(en()?'en-US':'ja-JP',{year:'numeric',month:'short',day:'numeric'}).format(new Date(row.started_at));
      const distance=Number(row.distance_km).toFixed(2);
      mapContext.textContent=(en()?'🌳 First 30 km run — ':'🌳 初めての30km走 — ')+date+' / '+distance+' km';
    }
    function show(kind,row){
      labels();
      lastState={kind,row:row||null};
      openList.hidden=kind!=='found';
      if(kind==='loading')result.textContent=en()?'Checking all saved runs…':'保存済みランの全件取得中…';
      else if(kind==='error')result.textContent=en()?'Unable to check the latest saved runs. Please try again.':'最新の保存済みランを確認できませんでした。再度お試しください。';
      else if(kind==='none')result.textContent=en()?'No run of 30 km or more was found among the eligible records.':'対象記録の中には、30km以上のランがまだ見つかっていません。';
      else if(kind==='found'){
        const d=new Date(row.started_at);
        const date=new Intl.DateTimeFormat(en()?'en-US':'ja-JP',{year:'numeric',month:'short',day:'numeric'}).format(d);
        result.textContent=(en()?'Recorded: ':'記録: ')+date+' / '+Number(row.distance_km).toFixed(2)+' km';
      }
    }
    button.addEventListener('click',async function(){
      labels();panel.hidden=!panel.hidden;
      if(panel.hidden){epoch++;return;}
      // The milestone panel is below the map: reveal it in the viewport.
      requestAnimationFrame(function(){
        if(!panel.hidden)panel.scrollIntoView({behavior:'smooth',block:'start'});
      });
      const user=typeof currentUser!=='undefined'?currentUser:null;
      const id=user?.id;
      if(!id || typeof fetchCloudRuns!=='function'){show('error');return;}
      const token=++epoch;
      owner=id;
      show('loading');
      try{
        // fetchCloudRuns returns only after every page completes or throws.
        const rows=await fetchCloudRuns();
        if(token!==epoch||owner!==id||currentUser?.id!==id||panel.hidden)return;
        const first=root.RunnerMilestones.first30km(rows,root.RunnerMilestones.verifiedImportedRun);
        show(first?'found':'none',first);
      }catch(error){
        if(token===epoch&&owner===id&&currentUser?.id===id&&!panel.hidden)show('error');
      }
    });
    new MutationObserver(function(){
      labels();
      if(!panel.hidden&&lastState)show(lastState.kind,lastState.row);
      if(!mapContext.hidden&&lastState?.kind==='found')updateMapContext(lastState.row);
    }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
    if(typeof supabaseClient!=='undefined'&&supabaseClient.auth?.onAuthStateChange){
      supabaseClient.auth.onAuthStateChange(function(event,session){
        if(owner && session?.user?.id!==owner)clear();
        if(event==='SIGNED_OUT')clear();
      });
    }
    labels();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})(typeof window!=='undefined'?window:globalThis);
