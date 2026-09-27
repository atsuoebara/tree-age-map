/** Private EXPLORE coverage discovery. Does not change existing ranking data.
 * Only GPS runs of users who opted in to EXPLORE are read. Report has aggregate counts only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const supported=new Set(['JPN','AUS','CAN','DEU','FRA','GBR','IDN','KHM','KOR','MYS','NZL','PHL','SGP','THA','USA','VNM']);
const geo=JSON.parse(fs.readFileSync(path.join(root,'runners-rings-world-adm0.geojson'),'utf8'));
function bbox(g){const b=[Infinity,Infinity,-Infinity,-Infinity];function walk(v){if(!Array.isArray(v))return;if(typeof v[0]==='number'&&typeof v[1]==='number'){b[0]=Math.min(b[0],v[0]);b[1]=Math.min(b[1],v[1]);b[2]=Math.max(b[2],v[0]);b[3]=Math.max(b[3],v[1]);return;}v.forEach(walk);}walk(g.coordinates);return b;}
function insideRing(x,y,r){let yes=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
function insidePolygon(x,y,p){return p.length>0&&insideRing(x,y,p[0])&&!p.slice(1).some(h=>insideRing(x,y,h));}
function contains(x,y,g){return g.type==='Polygon'?insidePolygon(x,y,g.coordinates):g.type==='MultiPolygon'&&g.coordinates.some(p=>insidePolygon(x,y,p));}
const grid=new Map();
for(const f of geo.features){if(!f.geometry)continue;const p=f.properties||{};const iso3=p.iso3_standard||p.iso3;if(!iso3)continue;const b=bbox(f.geometry);if(!b.every(Number.isFinite))continue;const entry={iso3,name:p.name_en||p.name||iso3,nameJa:p.name_ja||'',bbox:b,geometry:f.geometry};for(let ix=Math.floor(b[0]);ix<=Math.floor(b[2]);ix++)for(let iy=Math.floor(b[1]);iy<=Math.floor(b[3]);iy++){const k=`${ix},${iy}`;if(!grid.has(k))grid.set(k,[]);grid.get(k).push(entry);}}
function countriesInRoute(route){const found=new Map();for(const p of route){if(!Array.isArray(p)||p.length<2)continue;const y=Number(p[0]),x=Number(p[1]);if(!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(y)>90||Math.abs(x)>180)continue;for(const f of grid.get(`${Math.floor(x)},${Math.floor(y)}`)||[]){if(found.has(f.iso3))continue;const b=f.bbox;if(x<b[0]||x>b[2]||y<b[1]||y>b[3])continue;if(contains(x,y,f.geometry))found.set(f.iso3,f);}}return [...found.values()];}
if(process.argv.includes('--self-test')){if(geo.features.length<200||grid.size===0)throw Error('World boundaries missing');const jp=countriesInRoute([[35.6812,139.7671]]);if(!jp.some(x=>x.iso3==='JPN'))throw Error('Tokyo point did not resolve to Japan');const empty=countriesInRoute([[999,999]]);if(empty.length)throw Error('Invalid coordinates matched');console.log(`Coverage self-test passed: ${geo.features.length} world features; Tokyo -> Japan`);process.exit(0);}
const base=process.env.SUPABASE_URL,secret=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!base||!secret)throw Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
const year=Number(process.env.EXPLORE_YEAR||new Date().getUTCFullYear());if(!Number.isInteger(year)||year<2000||year>2099)throw Error('Invalid EXPLORE_YEAR');
async function request(uri){const r=await fetch(`${base.replace(/\/$/,'')}/rest/v1/${uri}`,{headers:{apikey:secret,Authorization:`Bearer ${secret}`}});if(!r.ok)throw Error(`${r.status} ${uri.split('?')[0]}: ${(await r.text()).slice(0,250)}`);return r.json();}
const stats=new Map();let userOffset=0,scannedRuns=0,scannedUsers=0;
while(true){const users=await request(`ranking_settings?select=user_id&join_explore=eq.true&order=user_id&limit=100&offset=${userOffset}`);if(!users.length)break;for(const user of users){scannedUsers++;let runOffset=0;while(true){const runs=await request(`runs?select=id,activity_date,route&user_id=eq.${encodeURIComponent(user.user_id)}&activity_date=gte.${year}-01-01&activity_date=lt.${year+1}-01-01&route=not.is.null&order=id&limit=50&offset=${runOffset}`);if(!runs.length)break;for(const run of runs){if(!Array.isArray(run.route))continue;scannedRuns++;for(const f of countriesInRoute(run.route)){if(supported.has(f.iso3))continue;if(!stats.has(f.iso3))stats.set(f.iso3,{iso3:f.iso3,country:f.name,countryJa:f.nameJa,runs:0,users:new Set()});const row=stats.get(f.iso3);row.runs++;row.users.add(user.user_id);}}runOffset+=runs.length;if(runs.length<50)break;}}userOffset+=users.length;if(users.length<100)break;}
const unsupported=[...stats.values()].map(({users,...v})=>({...v,runners:users.size})).sort((a,b)=>b.runners-a.runners||b.runs-a.runs||a.iso3.localeCompare(b.iso3));
const report={year,generatedAt:new Date().toISOString(),scope:'EXPLORE opted-in users only',scannedUsers,scannedRuns,supportedCountryCount:supported.size,unsupported};
const out=path.resolve(process.env.COVERAGE_REPORT_PATH||'explore-coverage-report.json');fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(`Coverage ${year}: ${scannedUsers} opted-in users, ${scannedRuns} runs; ${unsupported.length} unsupported countries found.`);
console.log(`Private report: ${out} (do not commit or publish)`);
