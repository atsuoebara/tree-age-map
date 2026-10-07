/* Optional search: button-triggered only, no automatic geolocation or autocomplete. */
(()=>{
'use strict';
const $=id=>document.getElementById(id),form=$('placeSearchForm');
if(!form)return;
const endpoint='https://photon.komoot.io/api/';
const cache=new Map();
let busy=false,lastRequest=0,statusKey='',results=[],selected=-1,revision=0;
const messages={empty:['地名・駅名・施設名を入力してください。','Enter a town, station or landmark.'],loading:['検索しています…','Searching…'],found:['候補を選ぶと近くまでズームします。ピンを調整して「ここから出発」を押してください。','Select a result to zoom nearby. Adjust the pin and confirm your start.'],none:['見つかりませんでした。市区町村を加えるか、近くの駅・施設名で試してください。','No results. Add a city or try a nearby station or landmark.'],failed:['検索できませんでした。少し待って再検索するか、現在地・地図から選んでください。','Search is unavailable. Try again later or select using your location or the map.'],wait:['連続検索は少し間隔を空けてください。','Please wait briefly before searching again.'],selected:['候補に移動しました。ピンを調整して出発点を確定してください。','Moved to the result. Adjust the pin and confirm your start.'],map:['地図が読み込まれていません。ページを再読み込みしてください。','The map has not loaded. Reload the page.']};
const en=()=>document.documentElement.lang==='en';
function render(){
 $('placeQuery').placeholder=en()?'e.g. Takasaki Station, Maebashi Otemachi':'例：高崎駅、前橋市大手町';
 $('searchStatus').textContent=statusKey?messages[statusKey][en()?1:0]:'';
 $('placeSearchButton').disabled=busy;
 const nodes=results.map((row,index)=>{const button=document.createElement('button');button.type='button';button.className='button searchResult';button.textContent=row.label;button.disabled=busy;button.setAttribute('aria-pressed',String(index===selected));button.addEventListener('click',()=>{
  if(!window.L||!$('startMap').classList.contains('leaflet-container')){statusKey='map';render();return;}
  selected=index;statusKey='selected';$('startMap').dispatchEvent(new CustomEvent('gps-art-place',{detail:{lat:row.lat,lng:row.lng}}));render();
 });return button;});
 $('searchResults').replaceChildren(...nodes);
}
function parse(data){const rows=[],seen=new Set();for(const feature of Array.isArray(data?.features)?data.features:[]){const c=feature?.geometry?.coordinates,p=feature?.properties??{};if(feature?.geometry?.type!=='Point'||!Array.isArray(c))continue;const lng=Number(c[0]),lat=Number(c[1]);if(c[0]==null||c[1]==null||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)continue;const label=[p.name,p.housenumber,p.street,p.district,p.city,p.county,p.state,p.country].filter(v=>typeof v==='string'&&v.trim()).filter((v,i,a)=>a.indexOf(v)===i).join(' · ');if(!label)continue;const key=`${lat.toFixed(5)},${lng.toFixed(5)}:${label}`;if(seen.has(key))continue;seen.add(key);rows.push({lat,lng,label});if(rows.length===5)break;}return rows;}
form.addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;
 const query=$('placeQuery').value.trim();if(!query){statusKey='empty';render();return;}
 const key=`${en()?'en':'local'}:${query}`;
 selected=-1;results=[];const requestRevision=revision;
 if(cache.has(key)){results=cache.get(key);statusKey=results.length?'found':'none';render();return;}
 if(Date.now()-lastRequest<2000){statusKey='wait';render();return;}
 lastRequest=Date.now();busy=true;statusKey='loading';render();
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  const url=new URL(endpoint);url.searchParams.set('q',query);url.searchParams.set('limit','5');if(en())url.searchParams.set('lang','en');
  const response=await fetch(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'strict-origin-when-cross-origin',headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error(`Search HTTP ${response.status}`);
  const data=await response.json();if(!Array.isArray(data?.features))throw new Error('Invalid search response');
  const rows=parse(data);cache.set(key,rows);if(cache.size>20)cache.delete(cache.keys().next().value);
  if(revision===requestRevision){results=rows;statusKey=rows.length?'found':'none';}
 }catch{if(revision===requestRevision)statusKey='failed';}
 finally{clearTimeout(timer);busy=false;render();}
});
$('placeQuery').addEventListener('input',()=>{revision++;results=[];selected=-1;statusKey='';render();});
new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
render();
})();

