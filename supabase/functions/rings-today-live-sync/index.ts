import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const RAW = "https://raw.githubusercontent.com/atsuoebara/tree-age-map/main/";
const CONFIG: any = {
  JPN:{countryCode:'JPN',adminLevel:'ADM2',boundaryFile:'runners-rings-japan-web.geojson',codeProps:['N03_007'],nameParts:['N03_003','N03_004'],parentProps:['N03_001']},
  THA:{countryCode:'THA',adminLevel:'ADM2',boundaryFile:'runners-rings-tha-adm2.geojson',codeProps:['shapeID','shapeISO','GID_2','code','id'],nameProps:['shapeName','NAME_2','name'],parentProps:['NAME_1','parentName']},
  MYS:{countryCode:'MYS',adminLevel:'ADM2',boundaryFile:'runners-rings-mys-adm2.geojson',codeProps:['shapeID','shapeISO','GID_2','code','id'],nameProps:['shapeName','NAME_2','name'],parentProps:['NAME_1','parentName']},
  SLB:{countryCode:'SLB',adminLevel:'ADM2',boundaryFile:'runners-rings-slb-adm2.geojson',codeProps:['shapeID','shapeISO','GID_2','code','id'],nameProps:['shapeName','NAME_2','name'],parentProps:['NAME_1','parentName']},
  RUS:{countryCode:'RUS',adminLevel:'ADM2',boundaryFile:'runners-rings-rus-adm2.geojson',codeProps:['shapeID','shapeISO','GID_2','code','id'],nameProps:['shapeName','NAME_2','name'],parentProps:['NAME_1','parentName']},
  KOR:{countryCode:'KOR',adminLevel:'ADM2',boundaryFile:'runners-rings-kor-adm2.geojson',codeProps:['shapeID','shapeISO','GID_2','code','id'],nameProps:['shapeName','NAME_2','name'],parentProps:['NAME_1','parentName']},
  USA:{countryCode:'USA',adminLevel:'ADM2',boundaryFile:'runners-rings-usa-adm2-simplified.geojson',codeProps:['shapeID','shapeISO','GID_2','code','id'],nameProps:['shapeName','NAME_2','name'],parentProps:['NAME_1','parentName']},
  GBR:{countryCode:'GBR',adminLevel:'ADM2',boundaryFile:'runners-rings-gbr-adm2-simplified.geojson',codeProps:['shapeID','shapeISO','GID_2','code','id'],nameProps:['shapeName','NAME_2','name'],parentProps:['NAME_1','parentName']},
  AUS:{countryCode:'AUS',adminLevel:'ADM2',boundaryFile:'runners-rings-aus-adm2-simplified.geojson',codeProps:['shapeID','shapeISO','GID_2','code','id'],nameProps:['shapeName','NAME_2','name'],parentProps:['NAME_1','parentName']},
  CAN:{countryCode:'CAN',adminLevel:'ADM2',boundaryFile:'runners-rings-can-adm2.geojson',codeProps:['shapeID','shapeISO','GID_2','code','id'],nameProps:['shapeName','NAME_2','name'],parentProps:['NAME_1','parentName']},
  FRA:{countryCode:'FRA',adminLevel:'ADM2',boundaryFile:'runners-rings-fra-adm2-simplified.geojson',codeProps:['shapeID','shapeISO','GID_2','code','id'],nameProps:['shapeName','NAME_2','name'],parentProps:['NAME_1','parentName']},
  DEU:{countryCode:'DEU',adminLevel:'ADM2',boundaryFile:'runners-rings-deu-adm2-simplified.geojson',codeProps:['shapeID','shapeISO','GID_2','code','id'],nameProps:['shapeName','NAME_2','name'],parentProps:['NAME_1','parentName']},
  NZL:{countryCode:'NZL',adminLevel:'ADM2',boundaryFile:'runners-rings-nzl-adm2-simplified.geojson',codeProps:['shapeID','shapeISO','GID_2','code','id'],nameProps:['shapeName','NAME_2','name'],parentProps:['NAME_1','parentName']},
};

// Fallback hints for supported countries. These are only used when the world ADM0
// lookup fails, then the actual ADM2 boundary is still used to confirm the region.
const COUNTRY_HINTS: any = {
  JPN:[[122,20,154,46]], THA:[[97,5,106,21]], MYS:[[99,-1,120,8]], SLB:[[155,-13,171,-5]],
  RUS:[[19,41,180,82]], KOR:[[124,33,132,39]],
  USA:[[-125,24,-66,50],[-170,50,-130,72],[-161,18,-154,23]],
  GBR:[[-9,49,3,61]], AUS:[[112,-44,154,-10]], CAN:[[-141,41,-52,84]],
  FRA:[[-6,41,10,52]], DEU:[[5,47,16,56]], NZL:[[165,-48,179,-33]],
};

let worldPromise: Promise<any[]> | null = null;
const regionPromises = new Map<string, Promise<any[]>>();

function first(p:any, keys:string[]=[]){ for(const k of keys){ const v=p?.[k]; if(v!=null&&String(v).trim()) return String(v).trim(); } return ''; }
function bboxGeom(g:any){ const b=[Infinity,Infinity,-Infinity,-Infinity]; const walk=(v:any)=>{ if(!Array.isArray(v))return; if(typeof v[0]==='number'&&typeof v[1]==='number'){b[0]=Math.min(b[0],v[0]);b[1]=Math.min(b[1],v[1]);b[2]=Math.max(b[2],v[0]);b[3]=Math.max(b[3],v[1]);return;} for(const w of v)walk(w);}; walk(g.coordinates); return b; }
function ringContains(x:number,y:number,ring:any[]){ let inside=false; for(let i=0,j=ring.length-1;i<ring.length;j=i++){ const a=ring[i],b=ring[j]; if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]) inside=!inside; } return inside; }
function polygonContains(x:number,y:number,p:any[]){ return p.length>0&&ringContains(x,y,p[0])&&!p.slice(1).some((h:any)=>ringContains(x,y,h)); }
function contains(x:number,y:number,g:any){ return g?.type==='Polygon'?polygonContains(x,y,g.coordinates):g?.type==='MultiPolygon'&&g.coordinates.some((p:any)=>polygonContains(x,y,p)); }
function distanceKm(aLat:number,aLon:number,bLat:number,bLon:number){ const R=6371.0088,toRad=(v:number)=>v*Math.PI/180,dLat=toRad(bLat-aLat),dLon=toRad(bLon-aLon),s1=Math.sin(dLat/2),s2=Math.sin(dLon/2),h=s1*s1+Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*s2*s2; return 2*R*Math.asin(Math.min(1,Math.sqrt(h))); }
async function fetchGeo(file:string){ const r=await fetch(RAW+file); if(!r.ok) throw new Error(`${file}: ${r.status}`); return await r.json(); }

async function loadWorld(){
  if(!worldPromise) worldPromise=(async()=>{
    const geo=await fetchGeo('runners-rings-world-adm0.geojson');
    return (geo.features||[]).map((f:any)=>{ const p=f.properties||{}; const iso3=p.iso3_standard||p.iso3; const bbox=bboxGeom(f.geometry); return {iso3,bbox,geom:f.geometry}; }).filter((x:any)=>x.iso3&&x.bbox.every(Number.isFinite));
  })();
  return worldPromise;
}

async function loadRegions(code:string){
  if(!regionPromises.has(code)) regionPromises.set(code,(async()=>{
    const cfg=CONFIG[code],geo=await fetchGeo(cfg.boundaryFile);
    return (geo.features||[]).map((f:any)=>{
      if(!f?.geometry)return null;
      const p=f.properties||{},regionCode=first(p,cfg.codeProps),name=cfg.nameParts?cfg.nameParts.map((k:string)=>p?.[k]).filter(Boolean).join(' '):first(p,cfg.nameProps),parent=first(p,cfg.parentProps);
      if(!regionCode||!name)return null;
      const bbox=bboxGeom(f.geometry); if(!bbox.every(Number.isFinite))return null;
      return {countryCode:code,adminLevel:cfg.adminLevel,code:regionCode,name,parent,bbox,geom:f.geometry,centerLat:(bbox[1]+bbox[3])/2,centerLng:(bbox[0]+bbox[2])/2};
    }).filter(Boolean);
  })());
  return regionPromises.get(code)!;
}

function findRegion(lat:number,lon:number,regions:any[]){ for(const r of regions){ const b=r.bbox; if(lon<b[0]||lon>b[2]||lat<b[1]||lat>b[3])continue; if(contains(lon,lat,r.geom))return r; } return null; }
function routeSamples(route:any[]){ const out:any[]=[]; const step=Math.max(1,Math.floor(route.length/80)); for(let i=0;i<route.length;i+=step){ const p=route[i]; if(!Array.isArray(p)||p.length<2)continue; const lat=Number(p[0]),lon=Number(p[1]); if(Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180)out.push([lat,lon]); } return out; }
function hintedCountries(samples:any[]){ const found=new Set<string>(); for(const [lat,lon] of samples){ for(const [code,boxes] of Object.entries(COUNTRY_HINTS) as any){ for(const b of boxes as any[]){ if(lon>=b[0]&&lon<=b[2]&&lat>=b[1]&&lat<=b[3]){found.add(code);break;} } } } return [...found]; }

async function countriesForRoute(route:any[]){
  const samples=routeSamples(route),world=await loadWorld(),found=new Set<string>();
  for(const [lat,lon] of samples){
    for(const f of world){ const b=f.bbox; if(lon<b[0]||lon>b[2]||lat<b[1]||lat>b[3])continue; if(contains(lon,lat,f.geom)){ if(CONFIG[f.iso3])found.add(f.iso3); break; } }
  }
  if(found.size) return [...found];
  for(const code of hintedCountries(samples)){
    const regs=await loadRegions(code);
    if(samples.some(([lat,lon])=>!!findRegion(lat,lon,regs))) found.add(code);
  }
  return [...found];
}

function analyseRoute(route:any[],target:number,byCountry:Map<string,any[]>){
  const rows=new Map<string,any>(); let calculated=0;
  for(let i=1;i<route.length;i++){
    const a=route[i-1],b=route[i]; if(!Array.isArray(a)||!Array.isArray(b)||a.length<2||b.length<2)continue;
    const aLat=Number(a[0]),aLon=Number(a[1]),bLat=Number(b[0]),bLon=Number(b[1]); if(![aLat,aLon,bLat,bLon].every(Number.isFinite))continue;
    const km=distanceKm(aLat,aLon,bLat,bLon); if(!Number.isFinite(km)||km<=0)continue; calculated+=km;
    const lat=(aLat+bLat)/2,lon=(aLon+bLon)/2; let region=null;
    for(const regs of byCountry.values()){ region=findRegion(lat,lon,regs); if(region)break; }
    if(!region)continue;
    const key=`${region.countryCode}|${region.adminLevel}|${region.code}`,row=rows.get(key)||{...region,km:0}; row.km+=km; rows.set(key,row);
  }
  if(target>0&&calculated>0){ const scale=target/calculated; for(const r of rows.values())r.km*=scale; }
  return [...rows.values()].filter((r:any)=>r.km>.0001);
}

Deno.serve(async(req:Request)=>{
  try{
    if(req.method!=='POST')return new Response('Method not allowed',{status:405});
    const body=await req.json().catch(()=>({})),runId=Number(body.run_id);
    if(!Number.isInteger(runId)||runId<=0)return new Response(JSON.stringify({ok:false,error:'invalid run_id'}),{status:400,headers:{'content-type':'application/json'}});
    const {data:run,error:runErr}=await sb.from('runs').select('id,user_id,activity_date,route,distance_km,deleted_at').eq('id',runId).maybeSingle();
    if(runErr)throw runErr;
    if(!run)return new Response(JSON.stringify({ok:true,skipped:'missing'}),{headers:{'content-type':'application/json'}});
    const activityMs=Date.parse(`${run.activity_date}T00:00:00Z`);
    if(!Number.isFinite(activityMs)||Math.abs(Date.now()-activityMs)>3*86400000)return new Response(JSON.stringify({ok:true,skipped:'outside live window'}),{headers:{'content-type':'application/json'}});
    const {data:fresh}=await sb.from('rings_today_run_region_distance').select('updated_at').eq('run_id',runId).order('updated_at',{ascending:false}).limit(1);
    if(fresh?.[0]?.updated_at&&Date.now()-Date.parse(fresh[0].updated_at)<60000)return new Response(JSON.stringify({ok:true,skipped:'fresh'}),{headers:{'content-type':'application/json'}});
    await sb.from('rings_today_run_region_distance').delete().eq('run_id',runId);
    if(run.deleted_at||!Array.isArray(run.route)||run.route.length<2||!(Number(run.distance_km)>0))return new Response(JSON.stringify({ok:true,skipped:'not eligible'}),{headers:{'content-type':'application/json'}});
    const countries=await countriesForRoute(run.route),byCountry=new Map<string,any[]>();
    for(const code of countries)byCountry.set(code,await loadRegions(code));
    const rows=analyseRoute(run.route,Number(run.distance_km),byCountry).map((r:any)=>({user_id:run.user_id,run_id:run.id,activity_date:run.activity_date,country_code:r.countryCode,admin_level:r.adminLevel,region_code:r.code,region_name:r.name,parent_region_name:r.parent||null,distance_km:Number(r.km.toFixed(6)),center_lat:r.centerLat,center_lng:r.centerLng,updated_at:new Date().toISOString()}));
    if(rows.length){ const {error}=await sb.from('rings_today_run_region_distance').upsert(rows,{onConflict:'run_id,country_code,admin_level,region_code'}); if(error)throw error; }
    return new Response(JSON.stringify({ok:true,run_id:runId,countries,rows:rows.length}),{headers:{'content-type':'application/json'}});
  }catch(e:any){
    console.error(e);
    return new Response(JSON.stringify({ok:false,error:String(e?.message||e)}),{status:500,headers:{'content-type':'application/json'}});
  }
});
