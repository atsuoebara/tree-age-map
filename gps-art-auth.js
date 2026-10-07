/* Auth status for the studio; generation must also authenticate on the server. */
(()=>{
'use strict';
const status=document.getElementById('artAuthStatus');
const login=document.getElementById('artLoginLink');
const button=document.getElementById('artCheckAuth');
if(!status||!login||!button)return;
const messages={
 checking:['ログイン状態を確認しています…','Checking sign-in status…'],
 signedOut:['未ログインです。地図と制作条件はこのまま試せます。','You are signed out. You can still try the map and preferences.'],
 signedIn:['ログイン済みです。ルート生成機能は準備中です。','You are signed in. Route generation is still in preparation.'],
 failed:['ログイン状態を確認できませんでした。通信状況を確認し、もう一度お試しください。','Could not check sign-in status. Check your connection and try again.'],
 unavailable:['ログイン機能を読み込めませんでした。ページを再読み込みしてください。','Sign-in could not load. Please reload this page.']
};
let state='checking',sequence=0,client=null,scheduled=null;
function render(){
 status.textContent=messages[state][document.documentElement.lang==='en'?1:0];
 login.hidden=state==='signedIn';
 button.disabled=state==='checking'||state==='unavailable';
}
function setState(next){state=next;render();}
function scheduleCheck(){
 sequence++;
 setState('checking');
 clearTimeout(scheduled);
 scheduled=setTimeout(check,0);
}
async function check(){
 const ticket=++sequence;
 setState('checking');
 const timeout=setTimeout(()=>{if(ticket===sequence){sequence++;setState('failed');}},12000);
 try{
  const {data:sessionData,error:sessionError}=await client.auth.getSession();
  if(ticket!==sequence)return;
  if(sessionError)throw sessionError;
  if(!sessionData?.session){setState('signedOut');return;}
  const {data,error}=await client.auth.getUser();
  if(ticket!==sequence)return;
  if(error){
   if(error.status===401||error.status===403||error.name==='AuthSessionMissingError'){setState('signedOut');return;}
   throw error;
  }
  setState(data?.user&&!data.user.is_anonymous?'signedIn':'signedOut');
 }catch{if(ticket===sequence)setState('failed');}
 finally{clearTimeout(timeout);}
}
new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
render();
try{
 if(!window.supabase?.createClient)throw new Error('SDK unavailable');
 client=window.supabase.createClient('https://fhwvntpzwyenendhcgbw.supabase.co','sb_publishable_8ZhwV5lVHGbud8v6AS3YBQ_C78JbXyM',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 client.auth.onAuthStateChange((event)=>{
  // Keep this callback synchronous; defer Auth calls to avoid lock deadlocks.
  if(event==='SIGNED_OUT'){sequence++;clearTimeout(scheduled);setState('signedOut');}
  else if(['INITIAL_SESSION','SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event))scheduleCheck();
 });
 button.addEventListener('click',()=>scheduleCheck());
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')scheduleCheck();});
 window.addEventListener('pageshow',()=>scheduleCheck());
 scheduleCheck();
}catch{sequence++;clearTimeout(scheduled);setState('unavailable');}
})();

