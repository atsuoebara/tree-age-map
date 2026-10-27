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
'今日のランニング':'Today’s running',
'すべて':'All'
};
const keys=Object.keys(dict).sort((a,b)=>b.length-a.length);
function active(){try{return document.documentElement.lang==='en'||localStorage.getItem('runners-rings-language')==='en'}catch(_){return document.documentElement.lang==='en'}}
function run(){if(!active())return; const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;const nodes=[];while((n=walk.nextNode()))nodes.push(n);
for(const node of nodes){if(!/[\u3040-\u9fff]/.test(node.nodeValue||''))continue;const parent=node.parentElement;if(!parent||parent.closest('script,style,textarea,option,[data-lang="ja"],[lang="ja"]'))continue;let value=node.nodeValue;for(const key of keys)value=value.split(key).join(dict[key]);if(value!==node.nodeValue)node.nodeValue=value;}
document.querySelectorAll('[data-lang="ja"]').forEach(el=>{el.hidden=true;});document.querySelectorAll('[data-lang="en"]').forEach(el=>{el.hidden=false;});
}
run();document.addEventListener('click',e=>{if(e.target.closest('[data-language]'))setTimeout(run,40)});
let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;run()})}).observe(document.body,{childList:true,subtree:true});
})();