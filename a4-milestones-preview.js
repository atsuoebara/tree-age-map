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
    // A-4 stage 3: read-only hundredth run, sharing the same complete fetch.
    const hundredWrap=document.createElement('div');
    hundredWrap.style.cssText='margin-top:14px;padding-top:12px;border-top:1px solid rgba(131,228,172,.42);min-width:0';
    const hundredTitle=document.createElement('h4');
    hundredTitle.style.cssText='margin:0 0 7px;font-size:17px;color:#bbf8cd';
    const hundredResult=document.createElement('p');
    hundredResult.setAttribute('role','status');
    hundredResult.style.cssText='margin:0 0 7px;line-height:1.55;font-size:15px';
    const hundredNote=document.createElement('p');
    hundredNote.style.cssText='margin:0;font-size:12px;line-height:1.5;opacity:.9';
    hundredWrap.append(hundredTitle,hundredResult,hundredNote);
    const futureWrap=document.createElement('div');
    futureWrap.style.cssText='margin-top:12px;padding-top:12px;border-top:1px solid rgba(131,228,172,.42);min-width:0';
    const futureTitle=document.createElement('h4');
    futureTitle.style.cssText='margin:0 0 7px;font-size:17px;color:#bbf8cd';
    const futureResult=document.createElement('div');
    futureResult.setAttribute('role','status');
    futureResult.style.cssText='font-size:14px;line-height:1.6;overflow-wrap:anywhere';
    const futureNote=document.createElement('p');
    futureNote.style.cssText='font-size:12px;line-height:1.5;opacity:.9;margin:7px 0 0';
    futureWrap.append(futureTitle,futureResult,futureNote);
    panel.append(title,result,note,openList,hundredWrap,futureWrap);
    anchor.insertAdjacentElement('afterend',button);
    document.getElementById('importArea')?.insertAdjacentElement('afterend',panel);
    let epoch=0;
    let owner=null;
    let lastState=null;
    let lastHundred=null;
    let lastFuture=null;
    function en(){return document.documentElement.lang==='en';}
    function labels(){
      const english=en();
      button.textContent=english?'🌳 Growth milestone (eligible records)':'🌳 年輪の節（対象記録内）';
      title.textContent=english?'First 30 km run (eligible records)':'初めての30km走（対象記録内）';
      note.textContent=english
        ? 'Based on eligible saved FIT and Strava running records only; GPX, TCX, Garmin and other unverified sources are excluded. Strava-linked records may retain distance and GPS route from the original import. Results may change when older eligible runs are imported or records are deleted.'
        : '現在はFIT経由とStravaでラン種目を確認できた保存済み記録だけを対象にしています。GPX・TCX・Garminなど未検証の経路は対象外です。Stravaと紐付いた既存記録は元の距離・GPSルートを使う場合があります。過去の対象記録の追加・削除で結果が変わる場合があります。';
      openList.textContent=english?'🗺 View this run on the map':'🗺 このランを地図で表示';
      hundredTitle.textContent=english?'100th run (eligible records)':'100回目のラン（対象記録内）';
      futureTitle.textContent=english?'More running milestones':'これまでと次の節目';
      futureNote.textContent=english
        ? 'Based only on eligible saved FIT and Strava running records, not the total number of saved runs. Duplicate saved activities count separately. Past imports/deletions can change these dates and remaining counts.'
        : 'FIT・Stravaの対象記録だけで計算します（保存済みラン総数とは異なります）。同じ活動の二重保存はそれぞれ数えます。過去データの追加・削除で日付や残り本数が変わる場合があります。';
      hundredNote.textContent=english
        ? 'Counted oldest first from saved FIT and Strava running records with valid start times (including runs without GPS). Other sources are excluded. If the same activity is saved more than once, each saved record counts separately. Later imports or deletions may change the 100th run. Only the first 30 km milestone currently links to a map.'
        : '開始日時のあるFIT・Stravaの対象ランを古い順に数えます（GPSなしも含む）。他の取り込み経路は対象外です。同じ活動が複数回保存されている場合は、それぞれ1本として数えます。過去のデータ追加・削除で100回目が変わる場合があります。地図への移動は現在「初30km」のみ対応しています。';
    }
    function clear(){
      epoch++;owner=null;lastState=null;lastHundred=null;lastFuture=null;panel.hidden=true;openList.hidden=true;result.textContent='';hundredResult.textContent='';futureResult.textContent='';
      mapContext.hidden=true;mapContext.textContent='';
    }
    function updateMapContext(row){
      if(!row)return;
      const date=new Intl.DateTimeFormat(en()?'en-US':'ja-JP',{year:'numeric',month:'short',day:'numeric'}).format(new Date(row.started_at));
      const distance=Number(row.distance_km).toFixed(2);
      mapContext.textContent=(en()?'🌳 First 30 km run — ':'🌳 初めての30km走 — ')+date+' / '+distance+' km';
    }
    function showHundred(kind,data){
      lastHundred={kind,data:data||null};
      if(kind==='loading'){
        hundredResult.textContent=en()?'Checking eligible saved runs…':'対象ランの回数を確認中…';
      }else if(kind==='error'){
        hundredResult.textContent=en()?'Unable to verify the 100th run. Please try again.':'100回目のランを確認できませんでした。再度お試しください。';
      }else if(kind==='result'){
        const count=data?.eligibleCount||0;
        if(!data?.record){
          hundredResult.textContent=en()
            ? count+' eligible runs recorded / 100 needed'
            : '対象記録 '+count+'本 / 100本';
        }else{
          const row=data.record;
          const date=new Intl.DateTimeFormat(en()?'en-US':'ja-JP',{year:'numeric',month:'short',day:'numeric'}).format(new Date(row.started_at));
          const km=Number(row.distance_km);
          hundredResult.textContent=(en()?'100th run: ':'100回目: ')+date
            +(Number.isFinite(km)?' / '+km.toFixed(2)+' km':'')
            +(en()?' (eligible count: '+count+')':'（対象 '+count+'本）');
        }
      }
    }
    function showFuture(kind,data){
      lastFuture={kind,data:data||null};
      futureResult.replaceChildren();
      const english=en();
      if(kind==='loading'||kind==='error'){
        futureResult.textContent=kind==='loading'
          ? (english?'Checking milestones…':'節目を確認中…')
          : (english?'Unable to check more milestones.':'他の節目を確認できませんでした。');
        return;
      }
      if(kind!=='result'||!data)return;
      const count=data.eligibleCount;
      const thresholds=Object.keys(data.records).map(Number).sort((a,b)=>a-b).filter(n=>n>=500);
      const reached=thresholds.filter(n=>Boolean(data.records[n]));
      // Keep the display compact even if an athlete has thousands of runs.
      const recent=reached.slice(-3);
      for(const n of recent){
        const row=data.records[n];
        const date=new Intl.DateTimeFormat(english?'en-US':'ja-JP',{year:'numeric',month:'short',day:'numeric'}).format(new Date(row.started_at));
        const line=document.createElement('div');
        line.textContent=english
          ? '✓ '+n.toLocaleString('en-US')+'th saved run: '+date
          : '✓ '+n.toLocaleString('ja-JP')+'本目：'+date;
        futureResult.appendChild(line);
      }
      const next=thresholds.find(n=>!data.records[n]);
      if(next){
        const remaining=next-count;
        const line=document.createElement('div');
        line.style.cssText='margin-top:7px;padding:8px 10px;background:#153c33;border-radius:9px;font-weight:800;color:#bbf8cd';
        line.textContent=english
          ? 'Next: '+next.toLocaleString('en-US')+' runs · '+remaining.toLocaleString('en-US')+' to go'
          : '次は'+next.toLocaleString('ja-JP')+'本目 · あと'+remaining.toLocaleString('ja-JP')+'本';
        futureResult.appendChild(line);
        const meter=document.createElement('progress');
        meter.max=next;
        meter.value=count;
        meter.setAttribute('aria-label',english?'Progress toward next running milestone':'次の走行回数の節目まで');
        meter.style.cssText='display:block;width:100%;height:10px;margin-top:8px;accent-color:#83e4ac';
        futureResult.appendChild(meter);
      }
      if(!recent.length&&!next)futureResult.textContent=english?'No further milestones found.':'まだ次の節目はありません。';
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
      showHundred('loading');
      showFuture('loading');
      let rows;
      try{
        // Only this preview opts into stable secondary-ID ordering across pages.
        // Other callers keep their existing fetchCloudRuns behavior.
        rows=await fetchCloudRuns({stableOrder:true});
      }catch(error){
        console.warn('A-4 complete saved-runs fetch failed:',error);
        if(token===epoch&&owner===id&&currentUser?.id===id&&!panel.hidden){
          show('error');
          showHundred('error');
          showFuture('error');
        }
        return;
      }
      if(token!==epoch||owner!==id||currentUser?.id!==id||panel.hidden)return;
      // Count milestones cannot invalidate the previously approved first-30km
      // milestone if a count-specific validation rejects the saved-run input.
      try{
        const first=root.RunnerMilestones.first30km(rows,root.RunnerMilestones.verifiedImportedRun);
        show(first?'found':'none',first);
      }catch(error){
        console.warn('A-4 first 30km calculation failed:',error);
        show('error');
      }
      try{
        const hundred=root.RunnerMilestones.hundredthRun(rows,root.RunnerMilestones.verifiedImportedRun);
        showHundred('result',hundred);
        // Compute other achievements independently: no extra network request.
        try{
          const other=root.RunnerMilestones.numberedRunMilestones(rows,root.RunnerMilestones.verifiedImportedRun);
          showFuture('result',other);
        }catch(otherError){
          console.warn('A-4 extra numbered milestones failed:',otherError);
          showFuture('error');
        }
      }catch(error){
        console.warn('A-4 hundredth-run calculation failed:',error);
        showHundred('error');
      }
    });
    new MutationObserver(function(){
      labels();
      if(!panel.hidden&&lastState)show(lastState.kind,lastState.row);
      if(!panel.hidden&&lastHundred)showHundred(lastHundred.kind,lastHundred.data);
      if(!panel.hidden&&lastFuture)showFuture(lastFuture.kind,lastFuture.data);
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
