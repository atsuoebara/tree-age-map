/* Numeric cartoon reference only; AI HTML/SVG is never executed. */
(()=>{
'use strict';
const palette={cream:'#fff1cc',orange:'#ffad52',red:'#ff777f',brown:'#b78362',dark:'#313541',white:'#fffaf0'};
let visible=true;
const en=()=>document.documentElement.lang==='en';
function valid(o){
 if(!Array.isArray(o?.points)||o.points.length<8||o.points.length>28||!o.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<=1.000001&&Math.abs(p.y)<=1.000001))return false;
 return Array.isArray(o.illustration)&&o.illustration.length<=12&&o.illustration.every(d=>['circle','line','polygon'].includes(d.type)&&Object.hasOwn(palette,d.color)&&Array.isArray(d.points)&&d.points.length>=(d.type==='circle'?1:d.type==='polygon'?3:2)&&d.points.length<=(d.type==='circle'?1:8)&&d.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<=1.000001&&Math.abs(p.y)<=1.000001)&&Number.isFinite(d.radius)&&d.radius>=0&&d.radius<=.3);
}
function labels(){document.querySelectorAll('[data-art-reference]').forEach(b=>{b.textContent=en()?(visible?'Reference: on':'Reference: off'):(visible?'元絵：あり':'元絵：なし');b.setAttribute('aria-pressed',String(visible));});document.querySelectorAll('[data-art-reference-layer]').forEach(g=>{g.style.display=visible?'':'none';});}
function toggle(){visible=!visible;labels();window.dispatchEvent(new CustomEvent('gps-art-reference',{detail:{visible}}));}
function control(button){button.setAttribute('data-art-reference','');button.addEventListener('click',toggle);labels();}
function decorate(svg,o){
 if(!valid(o))return;
 const ns='http://www.w3.org/2000/svg',g=document.createElementNS(ns,'g');g.setAttribute('data-art-reference-layer','');g.setAttribute('opacity','.38');g.setAttribute('pointer-events','none');
 const append=(tag,attrs)=>{const e=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));g.appendChild(e);};
 const pts=rows=>rows.map(p=>p.x+','+(-p.y)).join(' ');
 append('polygon',{points:pts(o.points),fill:palette.cream,stroke:palette.brown,'stroke-width':.025,'stroke-linejoin':'round'});
 for(const d of o.illustration){
 const common={fill:palette[d.color],stroke:palette[d.color],'stroke-width':.028,'stroke-linecap':'round','stroke-linejoin':'round'};
 if(d.type==='circle')append('circle',{...common,cx:d.points[0].x,cy:-d.points[0].y,r:d.radius});
 else append(d.type==='line'?'polyline':'polygon',{...common,points:pts(d.points),...(d.type==='line'?{fill:'none'}:{})});
 }
 svg.insertBefore(g,svg.firstChild);labels();
}
function mapLayer(result){
 const o=result?.artwork,geo=result?.template?.coordinates;
 if(!window.L||!valid(o)||!Array.isArray(geo)||geo.length<3||!geo.every(p=>p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])))return null;
 const xs=o.points.map(p=>p.x),ys=o.points.map(p=>p.y),lng=geo.map(p=>p[0]),lat=geo.map(p=>p[1]);
 const ax=Math.min(...xs),ay=Math.min(...ys),w=Math.max(...xs)-ax,h=Math.max(...ys)-ay,west=Math.min(...lng),south=Math.min(...lat),gw=Math.max(...lng)-west,gh=Math.max(...lat)-south;
 if(!w||!h)return null;
 const point=p=>[south+(p.y-ay)/h*gh,west+(p.x-ax)/w*gw];
 const layers=[L.polygon(o.points.map(point),{color:palette.brown,weight:1,opacity:.25,fillColor:palette.cream,fillOpacity:.18,interactive:false})];
 for(const d of o.illustration){
 const style={color:palette[d.color],weight:2,opacity:.55,fillColor:palette[d.color],fillOpacity:.38,interactive:false};
 if(d.type==='circle'){const c=d.points[0];layers.push(L.polygon(Array.from({length:20},(_,i)=>point({x:c.x+d.radius*Math.cos(i*Math.PI/10),y:c.y+d.radius*Math.sin(i*Math.PI/10)})),style));}
 else layers.push((d.type==='line'?L.polyline:L.polygon)(d.points.map(point),style));
 }
 return L.layerGroup(layers);
}
window.runnerRingsArtIllustration={valid,decorate,mapLayer,control,isVisible:()=>visible};
document.querySelectorAll('[data-art-reference]').forEach(control);
new MutationObserver(labels).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
labels();
})();
