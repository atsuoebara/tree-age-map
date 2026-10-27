/* Independent cycling model. No Runner's Rings storage or API access. */
(function(root){
  'use strict';
  const KEY='cyclists-rings:rides:v1';
  const bikes={road:'ロードバイク',city:'ママチャリ',other:'その他の自転車'};
  function distance(a,b){const rad=Math.PI/180;const x=Math.sin((b[0]-a[0])*rad/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin((b[1]-a[1])*rad/2)**2;return 6371*2*Math.asin(Math.sqrt(Math.min(1,x)));}
  function stats(segments){let km=0;for(const segment of segments)for(let i=1;i<segment.length;i++)km+=distance(segment[i-1],segment[i]);return km;}
  function validPoint(p){return Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=90&&Math.abs(p[1])<=180;}
  function validate(r){return r&&typeof r.id==='string'&&r.id.length<=100&&typeof r.name==='string'&&r.name.length<=300&&Object.hasOwn(bikes,r.bike)&& (r.date===null||(/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&!isNaN(Date.parse(r.date))))&&Array.isArray(r.segments)&&r.segments.length>0&&r.segments.length<=10000&&r.segments.every(s=>Array.isArray(s)&&s.length>0&&s.every(validPoint))&&r.segments.reduce((n,s)=>n+s.length,0)>=2&&r.segments.reduce((n,s)=>n+s.length,0)<=100000&&(r.seconds===null||(Number.isFinite(r.seconds)&&r.seconds>=0));}
  function parseGPX(xml,bike,filename){
    if(!Object.hasOwn(bikes,bike))throw Error('自転車の種類を選択してください。');
    if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('DOCTYPEを含むGPXは取り込めません。');
    const doc=new DOMParser().parseFromString(xml,'application/xml');
    if(doc.getElementsByTagName('parsererror').length||doc.documentElement.localName!=='gpx')throw Error('正しいGPXファイルではありません。');
    const nodes=(el,tag)=>Array.from(el.getElementsByTagNameNS('*',tag));
    const text=(el,tag)=>nodes(el,tag)[0]?.textContent?.trim()||'';
    let groups=nodes(doc,'trkseg').map(s=>nodes(s,'trkpt'));
    if(!groups.length)groups=nodes(doc,'rte').map(s=>nodes(s,'rtept'));
    let total=0;const times=[];
    const segments=groups.filter(g=>g.length).map(g=>g.map(p=>{
      const la=p.getAttribute('lat'),lo=p.getAttribute('lon');
      const point=[Number(la),Number(lo)];
      if(la===null||lo===null||!la.trim()||!lo.trim()||!validPoint(point))throw Error('GPXに無効な緯度・経度があります。');
      if(++total>100000)throw Error('1記録は10万点までです。GPXを分割してください。');
      const t=text(p,'time');times.push(t&&!isNaN(Date.parse(t))?t:null);return point;
    }));
    if(total<2)throw Error('地図に表示できるGPS記録がありません。');
    const start=times[0],end=times.at(-1);
    const seconds=start&&end&&Date.parse(end)>=Date.parse(start)?(Date.parse(end)-Date.parse(start))/1000:null;
    const name=text(nodes(doc,'trk')[0]||nodes(doc,'rte')[0]||doc,'name')||filename.replace(/\.gpx$/i,'');
    return {id:crypto.randomUUID(),name:name.slice(0,300),date:start?start.slice(0,10):null,bike,segments,seconds};
  }
  function signature(r){return JSON.stringify([r.date,r.segments]);}
  function merge(existing,incoming){const seen=new Set(existing.map(signature));const result=[...existing];let duplicates=0;for(const ride of incoming){if(!validate(ride))throw Error('バックアップの記録形式が正しくありません。');const sig=signature(ride);if(seen.has(sig)){duplicates++;continue;}seen.add(sig);result.push({...ride,id:crypto.randomUUID()});}return {rides:result,duplicates};}
  root.CycleCore={KEY,bikes,distance,stats,validate,parseGPX,signature,merge};
})(globalThis);
