/**
 * Runner's Rings — Rings Today sync.
 *
 * Aggregates every saved run into anonymous region-distance rows for Rings Today.
 * Participation settings are intentionally NOT consulted. Public output is exposed only
 * through get_rings_today(date), which returns region-level totals (no user IDs/routes).
 *
 * Required env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 * Optional:
 *   RINGS_TODAY_YEAR=2026
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const year = Number(process.env.RINGS_TODAY_YEAR || new Date().getUTCFullYear());
if (!Number.isInteger(year) || year < 2026 || year > 2099) throw Error('RINGS_TODAY_YEAR must be 2026-2099.');

const REGION_CONFIG = [
  {countryCode:'JPN',adminLevel:'ADM2',boundaryFile:'runners-rings-japan-web.geojson',codeProps:['N03_007'],nameParts:['N03_003','N03_004'],parentProps:['N03_001']},
  {countryCode:'THA',adminLevel:'ADM2',boundaryFile:'runners-rings-tha-adm2.geojson',codeProps:['shapeID','shapeISO','GID_2','code','id'],nameProps:['shapeName','NAME_2','name'],parentProps:['NAME_1','parentName']},
  {countryCode:'MYS',adminLevel:'ADM2',boundaryFile:'runners-rings-mys-adm2.geojson',codeProps:['shapeID','shapeISO','GID_2','code','id'],nameProps:['shapeName','NAME_2','name'],parentProps:['NAME_1','parentName']},
  {countryCode:'SLB',adminLevel:'ADM2',boundaryFile:'runners-rings-slb-adm2.geojson',codeProps:['shapeID','shapeISO','GID_2','code','id'],nameProps:['shapeName','NAME_2','name'],parentProps:['NAME_1','parentName']},
  {countryCode:'RUS',adminLevel:'ADM2',boundaryFile:'runners-rings-rus-adm2.geojson',codeProps:['shapeID','shapeISO','GID_2','code','id'],nameProps:['shapeName','NAME_2','name'],parentProps:['NAME_1','parentName']},
  {countryCode:'KOR',adminLevel:'ADM2',boundaryFile:'runners-rings-kor-adm2.geojson',codeProps:['shapeID','shapeISO','GID_2','code','id'],nameProps:['shapeName','NAME_2','name'],parentProps:['NAME_1','parentName']},
  {countryCode:'USA',adminLevel:'ADM2',boundaryFile:'runners-rings-usa-adm2-simplified.geojson',codeProps:['shapeID','shapeISO','GID_2','code','id'],nameProps:['shapeName','NAME_2','name'],parentProps:['NAME_1','parentName']},
  {countryCode:'GBR',adminLevel:'ADM2',boundaryFile:'runners-rings-gbr-adm2-simplified.geojson',codeProps:['shapeID','shapeISO','GID_2','code','id'],nameProps:['shapeName','NAME_2','name'],parentProps:['NAME_1','parentName']},
  {countryCode:'AUS',adminLevel:'ADM2',boundaryFile:'runners-rings-aus-adm2-simplified.geojson',codeProps:['shapeID','shapeISO','GID_2','code','id'],nameProps:['shapeName','NAME_2','name'],parentProps:['NAME_1','parentName']},
  {countryCode:'CAN',adminLevel:'ADM2',boundaryFile:'runners-rings-can-adm2.geojson',codeProps:['shapeID','shapeISO','GID_2','code','id'],nameProps:['shapeName','NAME_2','name'],parentProps:['NAME_1','parentName']},
  {countryCode:'FRA',adminLevel:'ADM2',boundaryFile:'runners-rings-fra-adm2-simplified.geojson',codeProps:['shapeID','shapeISO','GID_2','code','id'],nameProps:['shapeName','NAME_2','name'],parentProps:['NAME_1','parentName']},
  {countryCode:'DEU',adminLevel:'ADM2',boundaryFile:'runners-rings-deu-adm2-simplified.geojson',codeProps:['shapeID','shapeISO','GID_2','code','id'],nameProps:['shapeName','NAME_2','name'],parentProps:['NAME_1','parentName']},
  {countryCode:'NZL',adminLevel:'ADM2',boundaryFile:'runners-rings-nzl-adm2-simplified.geojson',codeProps:['shapeID','shapeISO','GID_2','code','id'],nameProps:['shapeName','NAME_2','name'],parentProps:['NAME_1','parentName']}
];

function first(p, keys=[]) { for (const k of keys) { const v=p?.[k]; if (v!=null && String(v).trim()) return String(v).trim(); } return ''; }
function bboxGeom(g) { const b=[Infinity,Infinity,-Infinity,-Infinity]; const walk=v=>{ if(!Array.isArray(v))return; if(typeof v[0]==='number'&&typeof v[1]==='number'){b[0]=Math.min(b[0],v[0]);b[1]=Math.min(b[1],v[1]);b[2]=Math.max(b[2],v[0]);b[3]=Math.max(b[3],v[1]);return;} for(const w of v)walk(w);}; walk(g.coordinates); return b; }
function ringContains(x,y,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function polygonContains(x,y,p){return p.length>0&&ringContains(x,y,p[0])&&!p.slice(1).some(h=>ringContains(x,y,h));}
function contains(x,y,g){return g?.type==='Polygon'?polygonContains(x,y,g.coordinates):g?.type==='MultiPolygon'&&g.coordinates.some(p=>polygonContains(x,y,p));}
function distanceKm(aLat,aLon,bLat,bLon){const R=6371.0088,toRad=v=>v*Math.PI/180,dLat=toRad(bLat-aLat),dLon=toRad(bLon-aLon),s1=Math.sin(dLat/2),s2=Math.sin(dLon/2),h=s1*s1+Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*s2*s2;return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));}
const cellSize=.5, cellKey=(lon,lat)=>`${Math.floor(lon/cellSize)},${Math.floor(lat/cellSize)}`;

function loadGlobalGrid(){
  const grid=new Map(); let loaded=0;
  for(const config of REGION_CONFIG){
    const file=path.join(root,config.boundaryFile);
    if(!fs.existsSync(file)){console.warn(`Skip missing boundary: ${config.boundaryFile}`);continue;}
    const geo=JSON.parse(fs.readFileSync(file,'utf8')); let countryLoaded=0;
    for(const f of geo.features||[]){
      if(!f?.geometry)continue; const p=f.properties||{};
      const code=first(p,config.codeProps);
      const name=config.nameParts ? config.nameParts.map(k=>p?.[k]).filter(Boolean).join(' ') : first(p,config.nameProps);
      const parent=first(p,config.parentProps);
      if(!code||!name)continue;
      const bbox=bboxGeom(f.geometry); if(!bbox.every(Number.isFinite))continue;
      const item={...config,code,name,parent,geom:f.geometry,bbox,centerLat:(bbox[1]+bbox[3])/2,centerLng:(bbox[0]+bbox[2])/2};
      for(let ix=Math.floor(bbox[0]/cellSize);ix<=Math.floor(bbox[2]/cellSize);ix++) for(let iy=Math.floor(bbox[1]/cellSize);iy<=Math.floor(bbox[3]/cellSize);iy++){
        const k=`${ix},${iy}`; if(!grid.has(k))grid.set(k,[]); grid.get(k).push(item);
      }
      loaded++; countryLoaded++;
    }
    console.log(`Rings Today: loaded ${countryLoaded} regions for ${config.countryCode}.`);
  }
  if(!loaded) throw Error('No region boundaries loaded.');
  return grid;
}

function findRegion(lat,lon,grid){
  for(const item of grid.get(cellKey(lon,lat))||[]){const b=item.bbox;if(lon<b[0]||lon>b[2]||lat<b[1]||lat>b[3])continue;if(contains(lon,lat,item.geom))return item;} return null;
}

function analyseRoute(route,targetDistanceKm,grid){
  const rows=new Map(); let calculatedKm=0;
  for(let i=1;i<route.length;i++){
    const a=route[i-1],b=route[i]; if(!Array.isArray(a)||!Array.isArray(b)||a.length<2||b.length<2)continue;
    const aLat=Number(a[0]),aLon=Number(a[1]),bLat=Number(b[0]),bLon=Number(b[1]);
    if(![aLat,aLon,bLat,bLon].every(Number.isFinite)||Math.abs(aLat)>90||Math.abs(bLat)>90||Math.abs(aLon)>180||Math.abs(bLon)>180)continue;
    const km=distanceKm(aLat,aLon,bLat,bLon); if(!Number.isFinite(km)||km<=0)continue; calculatedKm+=km;
    const region=findRegion((aLat+bLat)/2,(aLon+bLon)/2,grid); if(!region)continue;
    const key=`${region.countryCode}|${region.adminLevel}|${region.code}`;
    const row=rows.get(key)||{countryCode:region.countryCode,adminLevel:region.adminLevel,regionCode:region.code,regionName:region.name,parentRegionName:region.parent,centerLat:region.centerLat,centerLng:region.centerLng,km:0};
    row.km+=km; rows.set(key,row);
  }
  const target=Number(targetDistanceKm); if(Number.isFinite(target)&&target>0&&calculatedKm>0){const scale=target/calculatedKm;for(const row of rows.values())row.km*=scale;}
  return [...rows.values()].filter(r=>r.km>.0001);
}

if(process.argv.includes('--self-test')){
  const sq={type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,1],[0,0]]]};
  if(!contains(.5,.5,sq)||contains(2,2,sq))throw Error('Geometry self-test failed');
  if(Math.abs(distanceKm(0,0,0,1)-111.195)>.2)throw Error('Distance self-test failed');
  loadGlobalGrid(); console.log('Rings Today self-test passed.'); process.exit(0);
}

const base=process.env.SUPABASE_URL, secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!base||!secret)throw Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
const headers={apikey:secret,Authorization:`Bearer ${secret}`,'Content-Type':'application/json'};
async function request(uri,init={}){const r=await fetch(`${base.replace(/\/$/,'')}/rest/v1/${uri}`,{...init,headers:{...headers,...init.headers}});if(!r.ok)throw Error(`${r.status} ${uri.split('?')[0]}: ${(await r.text()).slice(0,500)}`);const t=await r.text();return t?JSON.parse(t):null;}

const grid=loadGlobalGrid(); let offset=0,runsProcessed=0,rowsWritten=0;
while(true){
  const runs=await request(`runs?select=id,user_id,activity_date,route,distance_km&activity_date=gte.${year}-01-01&activity_date=lt.${year+1}-01-01&deleted_at=is.null&route=not.is.null&distance_km=gt.0&order=id&limit=50&offset=${offset}`);
  if(!runs.length)break;
  for(const run of runs){
    if(!Array.isArray(run.route)||run.route.length<2)continue;
    await request(`rings_today_run_region_distance?run_id=eq.${encodeURIComponent(run.id)}`,{method:'DELETE'});
    const rows=analyseRoute(run.route,run.distance_km,grid).map(row=>({user_id:run.user_id,run_id:run.id,activity_date:run.activity_date,country_code:row.countryCode,admin_level:row.adminLevel,region_code:row.regionCode,region_name:row.regionName,parent_region_name:row.parentRegionName||null,distance_km:Number(row.km.toFixed(6)),center_lat:row.centerLat,center_lng:row.centerLng,updated_at:new Date().toISOString()}));
    if(rows.length){await request('rings_today_run_region_distance?on_conflict=run_id,country_code,admin_level,region_code',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows)});rowsWritten+=rows.length;}
    runsProcessed++;
  }
  offset+=runs.length; if(runs.length<50)break;
}
console.log(`Rings Today ${year}: processed ${runsProcessed} runs; upserted ${rowsWritten} region rows.`);
