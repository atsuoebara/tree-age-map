/* Runner's Rings shared site navigation — isolated from app/feature scripts. */
(()=>{'use strict';
if(document.getElementById('rrGlobalNavigation'))return;
// Persisted language is the sole authority for the shared navigation.
try{const selected=localStorage.getItem('runners-rings-language');if(selected==='en'||selected==='ja')document.documentElement.lang=selected;}catch(_){}

const links=[
['./index.html','ホーム','Home'],['./journal.html','Journal','Journal'],
['./ranking.html','Ranking','Ranking'],['./territory.html','Territory','Territory'],
['./today.html','Today','Today'],['./gps-art.html','GPS Art','GPS Art'],
['./ring-tools.html','Ring Tools','Ring Tools'],
['./about-runners-rings.html','About','About'],['./team.html','チーム','Team'],['./how-to.html','使い方','How to use'],
['./partners.html','パートナー','Partners'],['./contact.html','お問い合わせ','Contact']];
const css=document.createElement('style');css.textContent=`
#rrGlobalNavigation{position:sticky;top:0;z-index:2147483000;isolation:isolate;pointer-events:auto;padding:8px 12px;background:#0e1b2d;border-bottom:1px solid #44556c;color:#fff;font:600 13px/1.5 system-ui,sans-serif}
#rrGlobalNavigation *,#rrGlobalNavigation *:before{box-sizing:border-box}
#rrGlobalNavigation .rrNavRow{display:flex;align-items:center;justify-content:space-between;gap:10px;max-width:1120px;margin:0 auto}
#rrGlobalNavigation .rrNavBrand{color:#fff;font-weight:850;text-decoration:none;letter-spacing:.2px;white-space:nowrap}
#rrGlobalNavigation details{position:relative}
#rrGlobalNavigation summary{cursor:pointer;list-style:none;min-height:40px;min-width:100px;border:1px solid #71869d;border-radius:9px;padding:9px 12px;text-align:center;color:#fff}
#rrGlobalNavigation summary::-webkit-details-marker{display:none}
#rrGlobalNavigation .rrNavLinks{display:flex;gap:3px;align-items:center;flex-wrap:wrap}
#rrGlobalNavigation a{color:#dceeff;text-decoration:none;border-radius:7px;padding:7px 9px}
#rrGlobalNavigation a[aria-current="page"]{background:#19344a;color:#b8f1ff;outline:1px solid #45bfe0}
#rrGlobalNavigation a:focus-visible,#rrGlobalNavigation summary:focus-visible{outline:2px solid #eaff00;outline-offset:2px}
#rrGlobalNavigation .rrNavDropdown{position:absolute;right:0;top:calc(100% + 7px);width:min(310px,calc(100vw - 24px));max-height:70vh;overflow:auto;background:#102339;border:1px solid #65859f;box-shadow:0 12px 30px #0008;border-radius:12px;padding:9px;display:grid;grid-template-columns:1fr;gap:2px}
#rrGlobalNavigation .rrNavDropdown a{min-height:40px;display:flex;align-items:center}
#rrGlobalNavigation .rrNavDropdown a:hover{background:#263d59}
#rrGlobalNavigation .rrNavDesktop{display:flex;flex-wrap:wrap;gap:2px;align-items:center}
#rrGlobalNavigation .rrNavMobile{display:none}
/* Duplicate five-card navigation is replaced by the global site menu. */
body>.featureNav, nav.featureNav{display:none!important}
@media(max-width:960px){#rrGlobalNavigation .rrNavDesktop{display:none}#rrGlobalNavigation .rrNavMobile{display:block}}
`;document.head.append(css);
const nav=document.createElement('nav');nav.id='rrGlobalNavigation';nav.setAttribute('aria-label','Runner\'s Rings site navigation');
const row=document.createElement('div');row.className='rrNavRow';
const brand=document.createElement('a');brand.className='rrNavBrand';brand.href='./index.html';brand.textContent='Runner’s Rings';
const desktop=document.createElement('div');desktop.className='rrNavDesktop';
const details=document.createElement('details');details.className='rrNavMobile';
const summary=document.createElement('summary');const dropdown=document.createElement('div');dropdown.className='rrNavDropdown';
details.append(summary,dropdown);row.append(brand,desktop,details);nav.append(row);
const path=location.pathname.replace(/\/$/,'').split('/').pop()||'index.html';
function english(){try{const selected=localStorage.getItem('runners-rings-language');if(selected==='en'||selected==='ja')return selected==='en';}catch(_){}return document.documentElement.lang==='en';}
function makeLink(item,isEnglish){const a=document.createElement('a');a.href=item[0];a.textContent=isEnglish?item[2]:item[1];if(item[0].replace('./','')===path)a.setAttribute('aria-current','page');return a;}
function update(){const en=english();summary.textContent=en?'☰ Menu':'☰ メニュー';desktop.replaceChildren(...links.map(x=>makeLink(x,en)));dropdown.replaceChildren(...links.map(x=>makeLink(x,en)));if(typeof updateFooter==='function')updateFooter();}
const footer=document.createElement('footer');
footer.id='rrGlobalFooter';
footer.setAttribute('aria-label','Runner\'s Rings footer');
const footerCSS=document.createElement('style');
footerCSS.textContent=`
#rrGlobalFooter{margin-top:32px;padding:28px 16px;background:#0a1526;border-top:1px solid #486078;color:#dceeff;font:600 13px/1.6 system-ui,sans-serif}
#rrGlobalFooter .rrFooterInner{max-width:1120px;margin:auto}
#rrGlobalFooter .rrFooterLinks{display:flex;flex-wrap:wrap;gap:4px 13px;margin:12px 0}
#rrGlobalFooter a{color:#b8dffe;text-decoration:underline;text-underline-offset:3px;padding:4px}
#rrGlobalFooter a:focus-visible{outline:2px solid #eaff00}
/* The common footer replaces each page's legacy footer. */
body > footer:not(#rrGlobalFooter),main > footer:not(#rrGlobalFooter){display:none!important}
`;
document.head.append(footerCSS);
const footerInner=document.createElement('div');
footerInner.className='rrFooterInner';
const footerBrand=document.createElement('strong');footerBrand.textContent='Runner’s Rings';
const footerLinks=document.createElement('nav');footerLinks.className='rrFooterLinks';
footerLinks.setAttribute('aria-label','Footer navigation');
footerInner.append(footerBrand,footerLinks);footer.append(footerInner);
const footerItems=[...links,['./faq.html','よくある質問','FAQ'],['./privacy.html','プライバシー','Privacy'],['./terms.html','利用規約','Terms']];
function updateFooter(){const en=english();footerLinks.replaceChildren(...footerItems.map(x=>makeLink(x,en)));}
update();
document.body.append(footer);
/* The same visible language control on every page, including phones. */
const languageBox=document.createElement('div');
languageBox.id='rrNavLanguage';
languageBox.setAttribute('role','group');
languageBox.setAttribute('aria-label','Language / 言語');
for(const [code,label] of [['ja','日本語'],['en','EN']]){
 const button=document.createElement('button');button.type='button';button.dataset.rrLang=code;button.textContent=label;
 button.addEventListener('click',(event)=>{
  event.preventDefault();
  event.stopPropagation();
  try{localStorage.setItem('runners-rings-language',code)}catch(error){console.warn('Language preference:',error);}
  document.documentElement.lang=code;
  if(code==='en'){
    // Never force reload while a running session is active; Safari can show
    // the login gate after reinitialization. Record failure for debugging.
    try{
      const applied=window.rrApplyEnglishWithoutReload?.();
      if(applied!==true)console.warn('English live translation unavailable; reload intentionally suppressed');
    }catch(error){console.error('English live translation failed; reload suppressed',error);}
  } else {
    // Restore translated copy in reverse order; never reload the authenticated page.
    try{
      window.rrRestoreSupplementalJapanese?.();
      const restored=window.rrRestoreJapaneseWithoutReload?.();
      if(restored!==true)console.warn('Japanese live restore not available');
    }catch(error){console.error('Japanese live restore failed',error);}
    document.documentElement.lang='ja';
  }
  update();
  updateFooter();
  updateLanguageBox();
 });
 languageBox.append(button);
}
row.append(languageBox);
const langCss=document.createElement('style');
langCss.textContent=`
#rrNavLanguage{display:flex;gap:4px;flex-shrink:0;position:relative;z-index:2;pointer-events:auto;touch-action:manipulation}
#rrNavLanguage button{position:relative;z-index:3;pointer-events:auto;touch-action:manipulation;background:#172e45;color:#fff;border:1px solid #74869c;border-radius:8px;padding:9px 10px;min-height:40px;font:700 13px system-ui;cursor:pointer}
#rrNavLanguage button[aria-pressed="true"]{background:#31577a;border-color:#85dbf2}
#rrGlobalNavigation .rrNavRow{flex-wrap:wrap}
#rrGlobalNavigation #rrNavLanguage{margin-left:auto}
body>.languageSwitch,body header .languageSwitch,body header .languages,body .top>.lang,body main>.langs{display:none!important}
/* One canonical language switch in the shared navigation; remove the old homepage pair. */
body #languageSwitch{display:none!important}
@media(max-width:620px){#rrGlobalNavigation .rrNavRow{gap:8px}#rrGlobalNavigation #rrNavLanguage{order:2;margin-left:0}#rrGlobalNavigation .rrNavMobile{order:3;margin-left:auto}}
`;
document.head.append(langCss);
function updateLanguageBox(){
const en=english()||document.querySelector('#enBtn.active')!==null;
languageBox.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.rrLang===(en?'en':'ja'))));
}
updateLanguageBox();
document.addEventListener('click',event=>{if(event.target.closest('[data-language],#jaBtn,#enBtn'))setTimeout(updateLanguageBox,0)});
const firstHeader=document.querySelector('body > header');if(firstHeader)firstHeader.before(nav);else document.body.prepend(nav);
// Legacy navigation is superseded by the shared menu.
document.querySelectorAll('.rrAuditNav').forEach(el=>el.remove());
dropdown.addEventListener('click',e=>{if(e.target.closest('a'))details.open=false;});
document.addEventListener('click',e=>{if(details.open && !details.contains(e.target))details.open=false;});
document.addEventListener('click',e=>{if(e.target.closest('[data-language],#languageSwitch,.languageSwitch'))setTimeout(update,0);});
new MutationObserver(update).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
})();