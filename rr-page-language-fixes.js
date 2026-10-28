/* English UI corrections for public secondary pages. Only changes copy, not app data. */
(()=>{'use strict';
const path=location.pathname.split('/').pop()||'index.html';
if(!new Set(['journal.html','ranking.html','territory.html','today.html','contact.html','how-to.html','faq.html','partners.html']).has(path))return;
const dict={
'📷 Instagramへ共有':'📷 Share to Instagram',
'画像保存':'Save image',
'画像を保存':'Save image',
'今日の自分のランニングを共有':'Share today’s run',
'共有範囲':'Sharing scope',
'県・州':'Prefecture / state',
'市町村':'City / municipality',
'国':'Country',
'都道府県':'Prefecture',
'保存する':'Save',
'共有する':'Share',
'パートナー・協賛募集':'Partners and sponsorship',
'ご協力ください':'Get involved',
'お問い合わせ':'Contact',
'使い方':'How to use',
'開発者からのメッセージ':'Developer message',
'プライバシーポリシー':'Privacy policy',
'利用規約':'Terms of use',
'Runner\'s Ringsとは？':'About Runner\'s Rings',
'日本語':'日本語',
'TCX形式のファイルにも対応しています。':'TCX files are also supported.',
'TCXはRunningとして記録され、GPS座標が含まれているデータを取り込み対象とします。':'TCX imports must contain GPS coordinates and be recorded as Running.',
'今日のランニング':'Today’s running',
'すべて':'All'
};
const keys=Object.keys(dict).sort((a,b)=>b.length-a.length);
function active(){try{return document.documentElement.lang==='en'||localStorage.getItem('runners-rings-language')==='en'}catch(_){return document.documentElement.lang==='en'}}
function dynamicControls(){
if(!active())return;
const set=(sel,label)=>{const e=document.querySelector(sel);if(e&&e.textContent!==label)e.textContent=label};
if(path==='ranking.html'){
 const search=document.querySelector('#rankingSearch');if(search){search.placeholder='Public name or rank';search.setAttribute('aria-label','Search rankings');}
 set('#saveRanking','Save');set('#shareRanking','Share link');set('#rankingStoryShare','Share to Instagram');set('#rankingStorySave','Save image');
 const activeEn=document.documentElement.lang==='en';
 document.querySelectorAll('[data-setting]').forEach(input=>{const label=input.getAttribute('aria-label');if(label&&label.includes(' / ')){const split=label.split(' / ');input.setAttribute('aria-label',activeEn?split[0]:split[1]);}});
 const extra={en:{'#rankingSearch':'Search rankings','#rankingSearchButton':'Search rankings'},ja:{}};
 for(const el of document.querySelectorAll('button,label,summary,option')){if(el.childElementCount===0){const value=(el.textContent||'').trim();if(value==='ランキング検索 / Search rankings'||value==='ランキング検索')el.textContent='Search rankings';}}
const country=document.querySelector('#nationChoice');if(country){const placeholder=country.querySelector('option[value=""]');if(placeholder)placeholder.textContent='🌎 Choose your country';}
 if(country&&typeof Intl.DisplayNames==='function'){const dn=new Intl.DisplayNames(['en'],{type:'region'});for(const option of country.options){const c=option.value.toUpperCase();if(/^[A-Z]{2}$/.test(c)){const name=dn.of(c);if(name)option.textContent=name;}}}
}
if(path==='today.html'){
 const e=document.querySelector('#shareScope');if(e){e.setAttribute('aria-label','Sharing scope');const labels={all:'🌍 All',country:'By country',prefecture:'State / prefecture',city:'City / region'};for(const o of e.options)if(labels[o.value])o.textContent=labels[o.value];}
 const area=document.querySelector('#shareArea');if(area)area.setAttribute('aria-label','Area to share');
 set('#shareImageBtn','Share to Instagram');set('#saveImageBtn','Save image');
}
}
function run(){if(!active())return;dynamicControls(); const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;const nodes=[];while((n=walk.nextNode()))nodes.push(n);
for(const node of nodes){if(!/[\u3040-\u9fff]/.test(node.nodeValue||''))continue;const parent=node.parentElement;if(!parent||parent.closest('script,style,textarea,option,[data-lang="ja"],[lang="ja"]'))continue;let value=node.nodeValue;for(const key of keys)value=value.split(key).join(dict[key]);if(value!==node.nodeValue)node.nodeValue=value;}
// Visibility is controlled by each page's CSS; never persist hidden attributes.
}
run();document.addEventListener('click',e=>{if(e.target.closest('[data-language]'))setTimeout(run,40)});
let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;run()})}).observe(document.body,{childList:true,subtree:true});
})();