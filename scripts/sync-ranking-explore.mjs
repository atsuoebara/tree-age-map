/** Runner's Rings EXPLORE verified importer. Server-side only; never publish service key. */
import fs from 'node:fs';
const base = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !secret) throw Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in GitHub Actions secrets.');
const headers = { apikey: secret, Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' };
async function request(path, init={}) {
  const r=await fetch(`${base.replace(/\/$/,'')}/rest/v1/${path}`, { ...init, headers:{...headers,...init.headers} });
  if (!r.ok) throw Error(`${r.status} ${path.split('?')[0]}: ${(await r.text()).slice(0,300)}`);
  const txt=await r.text(); return txt ? JSON.parse(txt) : null;
}
function bboxGeom(g){
  let b=[Infinity,Infinity,-Infinity,-Infinity];
  function walk(x){if(!Array.isArray(x))return; if(typeof x[0]==='number' && typeof x[1]==='number'){b[0]=Math.min(b[0],x[0]);b[1]=Math.min(b[1],x[1]);b[2]=Math.max(b[2],x[0]);b[3]=Math.max(b[3],x[1]);return;}for(const v of x)walk(v)}
  walk(g.coordinates);return b;
}
function ringContains(x,y,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function polygonContains(x,y,polygon){return polygon.length>0&&ringContains(x,y,polygon[0])&&!polygon.slice(1).some(hole=>ringContains(x,y,hole));}
function contains(x,y,g){return g.type==='Polygon'?polygonContains(x,y,g.coordinates):g.type==='MultiPolygon'&&g.coordinates.some(p=>polygonContains(x,y,p));}
const jpn=JSON.parse(fs.readFileSync(new URL('../runners-rings-japan-web.geojson',import.meta.url),'utf8'));
// Japanese boundaries may contain multiple polygon pieces per municipality; merge by stable official N03_007 code.
const boundaries=jpn.features.map(f=>({code:String(f.properties.N03_007||''),name:[f.properties.N03_001,f.properties.N03_003,f.properties.N03_004].filter(Boolean).join(' '),geom:f.geometry,bbox:bboxGeom(f.geometry)})).filter(f=>f.code && f.geom);
const year=Number(process.env.EXPLORE_YEAR || new Date().getUTCFullYear());
if(!Number.isInteger(year)||year<2000||year>2099)throw Error('Invalid EXPLORE_YEAR');
let offset=0,processed=0,written=0;
// Only import people who explicitly opted into EXPLORE; never write their routes to ranking tables.
while(true){
  const users=await request(`ranking_settings?select=user_id&join_explore=eq.true&order=user_id&limit=100&offset=${offset}`);
  if(!users.length)break;
  for(const user of users){
    let runOffset=0;
    while(true){
      const runs=await request(`runs?select=id,user_id,activity_date,route&user_id=eq.${encodeURIComponent(user.user_id)}&activity_date=gte.${year}-01-01&activity_date=lt.${year+1}-01-01&route=not.is.null&order=id&limit=50&offset=${runOffset}`);
      if(!runs.length)break;
      for(const run of runs){
        if(!Array.isArray(run.route))continue;
        const found=new Map();
        // Stored route is [latitude,longitude]; GeoJSON is [longitude,latitude].
        // Inspect every recorded GPS point rather than only start/end or sparse samples.
        for(const p of run.route){
          if(!Array.isArray(p)||p.length<2)continue;
          const y=Number(p[0]),x=Number(p[1]);
          if(!Number.isFinite(x)||!Number.isFinite(y)||y<20||y>46||x<122||x>154)continue;
          for(const f of boundaries){
            if(found.has(f.code))continue;
            const b=f.bbox;
            if(x<b[0]||x>b[2]||y<b[1]||y>b[3])continue;
            if(contains(x,y,f.geom))found.set(f.code,f.name);
          }
        }
        const rows=[...found].map(([region_code,region_name])=>({user_id:user.user_id,run_id:run.id,activity_year:year,run_country:'JP',region_code,region_name}));
        if(rows.length){await request('ranking_explore_verified?on_conflict=run_id,run_country,region_code',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows)});written+=rows.length;}
        processed++;
      }
      runOffset+=runs.length;if(runs.length<50)break;
    }
  }
  offset+=users.length;if(users.length<100)break;
}
console.log(`EXPLORE ${year} JP: processed ${processed} opted-in runs, wrote ${written} verified run-region matches. Other countries are not imported by this version.`);
