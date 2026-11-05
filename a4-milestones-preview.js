/* A-4 first 30 km: private, read-only FIT-only preview. No DB writes. */
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
    panel.style.cssText='box-sizing:border-box;width:100%;max-width:550px;margin:12px auto;padding:16px;border:1px solid #83e4ac;border-radius:14px;background:#102e2b;color:#f1fff6;overflow-wrap:anywhere';
    const title=document.createElement('h3');
    title.style.cssText='margin:0 0 10px;font-size:19px';
    const result=document.createElement('p');
    result.setAttribute('aria-live','polite');
    result.style.cssText='margin:0 0 10px;line-height:1.6';
    const note=document.createElement('p');
    note.style.cssText='font-size:12px;line-height:1.5;opacity:.9;margin:8px 0';
    const openList=document.createElement('button');
    openList.type='button';openList.hidden=true;
    openList.style.cssText='min-height:44px;padding:10px 12px;border-radius:10px;cursor:pointer';
    openList.addEventListener('click',function(){
      if(!panel.hidden && !document.getElementById('cloudRunsPanel')?.classList.contains('open')){
        document.getElementById('cloudRunsButton')?.click();
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
        ? 'Currently based only on saved runs imported through the verified FIT path. Other import sources are excluded. The result may change when older eligible activities are imported or records are deleted.'
        : '現在は種目を確認できたFIT経由の保存済みランだけを対象にしています。他の取り込み経路の記録は含みません。Runner\'s Ringsに取り込まれた対象記録の範囲で判定するため、過去のデータ追加や削除で結果が変わる場合があります。';
      openList.textContent=english?'🏃 Open running history':'🏃 ランニング記録を開く';
    }
    function clear(){
      epoch++;owner=null;lastState=null;panel.hidden=true;openList.hidden=true;result.textContent='';
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
        const verified=row=>row?.source==='fit';
        const first=root.RunnerMilestones.first30km(rows,verified);
        show(first?'found':'none',first);
      }catch(error){
        if(token===epoch&&owner===id&&currentUser?.id===id&&!panel.hidden)show('error');
      }
    });
    new MutationObserver(function(){
      labels();
      if(!panel.hidden&&lastState)show(lastState.kind,lastState.row);
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
