/* Runner's Rings: lightweight achievements and usage signals. No public personal data. */
(()=>{
const host=document.getElementById('myTodayShareLink');
if(!host||typeof supabaseClient==='undefined')return;
const card=document.createElement('section');
card.id='rrPersonalProgress';
card.setAttribute('aria-live','polite');
card.setAttribute('role','button');card.setAttribute('tabindex','0');card.setAttribute('aria-label','今月の走りを月間振り返り動画で見る');
card.style.cssText='margin:12px 0;padding:14px 16px;border:1px solid #78eaff;border-radius:15px;background:#122e42;color:#e9faff;line-height:1.6;width:100%;max-width:600px;box-sizing:border-box';
card.innerHTML='<strong style="color:#78eaff;font-size:16px">🌱 今月のあなたの年輪</strong><div id="rrProgressBody" style="font-size:14px;margin-top:5px">集計中…</div><div id="rrMonthlyVideoEntry" role="button" tabindex="0" style="font-size:12px;color:#aef1ff;margin-top:7px;font-weight:800">▶ 今月の走りを動画で振り返る</div><div id="rrShareNudge" hidden style="margin-top:9px"><a href="./my-today.html" style="color:#78eaff;font-weight:800">📷 今日のランニングを共有する</a> <button id="rrShareDismiss" type="button" style="margin-left:10px;padding:6px 10px;border:1px solid #6b90a1;border-radius:8px;background:transparent;color:#fff">閉じる</button></div>';
host.insertAdjacentElement('afterend',card);

/* A-3: private anniversary memory; does not publish activity or auto-create video. */
const anniversary=document.createElement('section');
anniversary.id='rrYearAgoToday';
anniversary.style.cssText='margin:12px 0;padding:14px 16px;border:1px solid #78eaff;border-radius:15px;background:#122e42;color:#e9faff;line-height:1.6;width:100%;max-width:600px;box-sizing:border-box';
anniversary.hidden=true;
anniversary.innerHTML='<strong id="rrYearAgoTitle" style="color:#78eaff;font-size:16px"></strong><div id="rrYearAgoBody" role="status" aria-live="polite" style="font-size:14px;margin-top:6px"></div><button id="rrYearAgoReview" type="button" style="display:block;max-width:100%;margin-top:7px;padding:0;border:0;background:transparent;color:#aef1ff;font-size:12px;font-weight:800;text-align:left;line-height:1.6;cursor:pointer"></button>';
card.insertAdjacentElement('afterend',anniversary);
let anniversaryState={loaded:false,items:[],date:'',error:false,loggedIn:false};
function anniversaryDate(today){
 const [y,m,d]=today.split('-').map(Number);
 // Feb 29 has no exact anniversary in a non-leap year: use Feb 28.
 const lastDay=new Date(y-1,m,0).getDate();
 return [y-1,String(m).padStart(2,'0'),String(Math.min(d,lastDay)).padStart(2,'0')].join('-');
}
function renderAnniversary(){
 const en=document.documentElement.lang==='en';
 const title=document.getElementById('rrYearAgoTitle');
 const body=document.getElementById('rrYearAgoBody');
 const button=document.getElementById('rrYearAgoReview');
 title.textContent=en?'📅 On this day last year':'📅 1年前の今日';
 if(!anniversaryState.loaded) body.textContent=en?'Loading your memories…':'思い出を確認中…';
 else if(anniversaryState.error) body.textContent=en?'Could not load past runs. Please try again later.':'過去のランを読み込めませんでした。後でもう一度お試しください。';
 else if(!anniversaryState.items.length) body.textContent=en?'No run found for '+anniversaryState.date+'. Imported records may be incomplete.':'前年の'+anniversaryState.date+'のランは見つかりませんでした（未取り込みの可能性もあります）。';
 else {
  const km=anniversaryState.items.reduce((sum,r)=>sum+(Number.isFinite(Number(r.distance_km))?Math.max(0,Number(r.distance_km)):0),0);
  body.textContent=(en?anniversaryState.date+' · '+anniversaryState.items.length+' runs · ':anniversaryState.date+' ・ '+anniversaryState.items.length+'回 ・ ')+km.toFixed(1)+' km';
 }
 const [year,month]=anniversaryState.date.split('-');
 button.textContent=en?'▶ Create a running recap for '+year+'-'+month:'▶ '+year+'年'+Number(month)+'月の走りを動画で振り返る';
 button.hidden=anniversaryState.error || !anniversaryState.items.length;
}
anniversary.querySelector('#rrYearAgoReview').addEventListener('click',()=>{
 const panel=document.getElementById('timelapsePanel');
 const monthInput=document.getElementById('timelapseReviewMonth');
 const review=document.querySelector('.timelapseMonthlyReview');
 if(!panel||!monthInput||!review)return;
 panel.classList.add('isOpen');
 panel.style.display='block';
 const mode=document.getElementById('timelapseMode');
 if(mode)mode.value='route';
 monthInput.value=anniversaryState.date.slice(0,7);
 monthInput.dispatchEvent(new Event('change',{bubbles:true}));
 requestAnimationFrame(()=>review.scrollIntoView({behavior:'smooth',block:'start'}));
});
async function refreshAnniversary(user,today){
 if(!user){anniversary.hidden=true;anniversaryState={loaded:false,items:[],date:'',error:false,loggedIn:false};return;}
 const target=anniversaryDate(today);
 anniversary.hidden=false;
 anniversaryState={loaded:false,items:[],date:target,error:false,loggedIn:true};
 renderAnniversary();
 try{
  const {data,error}=await supabaseClient.from('runs').select('id,activity_date,distance_km')
    .eq('user_id',user.id).is('deleted_at',null).eq('activity_date',target).limit(1000);
  if(error)throw error;
  if(anniversaryState.date!==target||!anniversaryState.loggedIn)return;
  anniversaryState={loaded:true,items:data||[],date:target,error:false,loggedIn:true};
 }catch(e){console.warn('Anniversary unavailable',e);anniversaryState={loaded:true,items:[],date:target,error:true,loggedIn:true};}
 renderAnniversary();
}
window.addEventListener('rr-language-changed',renderAnniversary);
new MutationObserver(renderAnniversary).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});

card.style.cursor='pointer';
function openMonthlyReview(){
 const panel=document.getElementById('timelapsePanel');
 const monthInput=document.getElementById('timelapseReviewMonth');
 const review=document.querySelector('.timelapseMonthlyReview');
 if(!panel||!monthInput||!review)return;
 // Navigate directly: the normal period-video launcher may refuse to open
 // when its default range is unavailable, even though monthly review exists.
 panel.classList.add('isOpen');
 panel.style.display='block';
 const mode=document.getElementById('timelapseMode');
 if(mode)mode.value='route';
 monthInput.value=day().slice(0,7);
 monthInput.dispatchEvent(new Event('change',{bubbles:true}));
 requestAnimationFrame(()=>review.scrollIntoView({behavior:'smooth',block:'start'}));
 log('runner_monthly_review_entry_click');
}
function openMonthlyRings(){
 const panel=document.getElementById('timelapsePanel');
 const monthInput=document.getElementById('timelapseReviewMonth');
 if(!panel||!monthInput)return;
 panel.classList.add('isOpen');
 panel.style.display='block';
 monthInput.value=day().slice(0,7);
 monthInput.dispatchEvent(new Event('change',{bubbles:true}));
 window.dispatchEvent(new Event('rr-open-monthly-rings'));
}
card.addEventListener('click',e=>{
 if(e.target.closest('a,button'))return;
 if(e.target.closest('#rrMonthlyVideoEntry'))openMonthlyReview();
 else openMonthlyRings();
});
card.addEventListener('keydown',e=>{
 if((e.key==='Enter'||e.key===' ')&&e.target===card){e.preventDefault();openMonthlyRings();}
});
document.getElementById('rrMonthlyVideoEntry').addEventListener('keydown',e=>{
 if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();openMonthlyReview();}
});
const english=()=>document.documentElement.lang==='en';
let progress={count:0,distance:0,regions:null,error:false};
function renderLanguage(){
 const en=english();
 card.querySelector('strong').textContent=en?'🌱 Your growth rings this month':'🌱 今月のあなたの年輪';
 card.querySelector('[style*="font-weight:800"]').textContent=en?'▶ Review this month’s runs in a video':'▶ 今月の走りを動画で振り返る';
 card.setAttribute('aria-label',en?'Open this month’s running recap':'今月の走りを月間振り返り動画で見る');
 const body=document.getElementById('rrProgressBody');
 if(progress.error){body.textContent=en?'Monthly running data is temporarily unavailable.':'今月の記録は現在確認できません。';}
 else if(progress.loaded){
   body.textContent=en
     ? 'This month: '+progress.count+' runs · '+progress.distance.toFixed(1)+' km'+(progress.regions===null?'':' · Today: '+progress.regions+' regions')
     : '今月 '+progress.count+'本・'+progress.distance.toFixed(1)+'km'+(progress.regions===null?'':'・今日 '+progress.regions+'地域');
 }else body.textContent=en?'Calculating…':'集計中…';
 const share=card.querySelector('#rrShareNudge a'),dismiss=card.querySelector('#rrShareDismiss');
 if(share)share.textContent=en?'📷 Share today’s run':'📷 今日のランニングを共有する';
 if(dismiss)dismiss.textContent=en?'Close':'閉じる';
}
window.addEventListener('rr-language-changed',renderLanguage);
new MutationObserver(renderLanguage).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
renderLanguage();
const day=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)};
const log=(event,params={})=>{if(typeof gtag==='function')gtag('event',event,{feature:'runner_engagement',...params})};
const localKey='RREngagement:v1:';
let previousTodayCount=null;let userId=null;
async function refresh(){
 try{
  const {data:{user}}=await supabaseClient.auth.getUser();
  if(!user){card.hidden=true;await refreshAnniversary(null,'');return;}card.hidden=false;userId=user.id;
  const today=day(),month=today.slice(0,7),start=month+'-01';
  await refreshAnniversary(user,today);
  const {data:runs,error}=await supabaseClient.from('runs').select('id,activity_date,distance_km').eq('user_id',user.id).is('deleted_at',null).gte('activity_date',start).lte('activity_date',today).limit(1000);
  if(error)throw error;
  const distance=(runs||[]).reduce((a,r)=>a+Number(r.distance_km||0),0);
  const count=(runs||[]).length;
  const todayCount=(runs||[]).filter(r=>r.activity_date===today).length;
  let todayRegions='';
  const {data:regions,error:regionsError}=await supabaseClient.rpc('my_today_regions',{p_date:today});
  if(!regionsError&&Array.isArray(regions))todayRegions='・今日 '+regions.length+'地域';
  progress={count,distance,regions:!regionsError&&Array.isArray(regions)?regions.length:null,loaded:true,error:false};renderLanguage();
  const key=localKey+user.id,stored=localStorage.getItem(key);
  let state;try{state=stored?JSON.parse(stored):null}catch(e){state=null}
  if(!state||!state.first){state={first:today,last:today};log('runner_engagement_first_seen')}
  else if(state.last!==today){
   const days=Math.round((Date.parse(today+'T12:00:00')-Date.parse(state.first+'T12:00:00'))/86400000);
   log('runner_engagement_daily_return',{days_since_first:days});
   if(days===1)log('runner_engagement_d1_return');
   if(days>=7&&days<14&&!state.weekMarked){log('runner_engagement_week1_return');state.weekMarked=true}
   state.last=today;
  }
  localStorage.setItem(key,JSON.stringify(state));
  const prompt=document.getElementById('rrShareNudge');
  if(previousTodayCount!==null&&todayCount>previousTodayCount&&localStorage.getItem(key+':dismiss:'+today)!=='1'){
   prompt.hidden=false;log('runner_share_nudge_shown');
  }
  previousTodayCount=todayCount;
 }catch(e){console.warn('Progress unavailable:',e);progress={...progress,error:true};renderLanguage()}
}
document.getElementById('rrShareDismiss').onclick=()=>{
 document.getElementById('rrShareNudge').hidden=true;
 if(userId)localStorage.setItem(localKey+userId+':dismiss:'+day(),'1');
};
host.addEventListener('click',()=>log('runner_my_today_entry_click'));
document.querySelectorAll('a[href*="ranking.html"],a[href*="territory.html"],a[href*="today.html"]').forEach(a=>a.addEventListener('click',()=>{
 const path=new URL(a.href,location.href).pathname;log('runner_feature_navigation',{destination:path.endsWith('ranking.html')?'ranking':path.endsWith('territory.html')?'territory':'today'});
}));
refresh();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
setInterval(()=>{if(!document.hidden)refresh()},120000);
})();