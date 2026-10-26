const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const excluded = {
  'googlede761637420561cb.html':'Google ownership verification payload',
  'garmin-return.html':'OAuth return page; may receive authentication parameters',
  'journal-admin.html':'Editorial administration',
  'journal-v2-preview.html':'Preview',
  'rings-layers-lab.html':'Experiment (noindex,nofollow)',
  'index-usa-adm2-local-geojson.html':'Local geometry experiment'
};
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.name==='.git'?[]:e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const inventory=[];
const existingSyntaxIssues=[];
for(const file of walk(root).filter(f=>f.endsWith('.html'))){
  const name=path.relative(root,file).replaceAll('\\','/');
  const html=fs.readFileSync(file,'utf8');
  if(excluded[name]){assert(!html.includes('googletagmanager.com/gtag/js'));inventory.push({page:name,status:excluded[name]});continue;}
  const loaders=[...html.matchAll(/<script[^>]+src="https:\/\/www.googletagmanager.com\/gtag\/js\?id=([^"]+)"/g)];
  assert.equal(loaders.length,1,name);assert.equal(loaders[0][1],'G-CX6V4G2ML5',name);
  const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  for(const [,attrs,code] of scripts)if(!/\bsrc=|application\/ld\+json/.test(attrs)&&code.trim()){
    try{new vm.Script(code,{filename:name});}catch(error){
      if(!name.startsWith('journal/articles/'))throw error;
      existingSyntaxIssues.push({page:name,error:error.message});
    }
  }
  const tag=scripts.find(([,attrs,code])=>code.includes("gtag('config'"))[2];
  const ctx={Date};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(tag,ctx);
  const calls=ctx.window.dataLayer.map(a=>Array.from(a));
  assert.equal(calls.filter(a=>a[0]==='config').length,1,name);
  assert.equal(calls.find(a=>a[0]==='config')[1],'G-CX6V4G2ML5',name);
  const manual=name==='journal-post.html';
  assert.equal(calls.find(a=>a[0]==='config')[2]?.send_page_view,manual?false:undefined,name);
  inventory.push({page:name,status:manual?'Manual page_view after published article title':'One automatic page_view via config'});
}
// Execute the real dynamic article script with a delayed, read-only fixture response.
const html=fs.readFileSync(path.join(root,'journal-post.html'),'utf8');
const app=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes('let post=null'));
async function articleCase(data,error){
  const elements=new Map(),events=[];
  function el(){return {classList:{toggle(){}},replaceChildren(){},append(){},setAttribute(){},addEventListener(type,fn){this[type]=fn;}};}
  const document={title:'Journal',documentElement:{},getElementById(id){if(!elements.has(id))elements.set(id,el());return elements.get(id);},createElement:el};
  let resolve;const result=new Promise(r=>resolve=r);
  const query={select(){return this;},eq(){return this;},maybeSingle(){return result;}};
  const ctx={document,window:{supabase:{createClient:()=>({from:()=>query})}},localStorage:{getItem:()=>null,setItem(){}},navigator:{},location:{search:'?slug=fixture',origin:'https://runnersrings.com',pathname:'/journal-post.html'},URL,URLSearchParams,Date,console,gtag:(...a)=>events.push(a)};
  vm.runInNewContext(app,ctx);assert.equal(events.length,0);
  resolve({data,error});await new Promise(r=>setImmediate(r));
  if(data&&!error){assert.equal(events.length,1);assert.equal(events[0][1],'page_view');assert.equal(events[0][2].page_title,"Fixture | Runner's Rings Journal");elements.get('en').click();assert.equal(events.length,1,'Language redraw must not duplicate');}
  else assert.equal(events.length,0,'No article view for missing/error results');
}
(async()=>{
  await articleCase({title_ja:'Fixture',published_at:'2026-10-26'},null);
  await articleCase(null,null);
  await articleCase(null,{message:'expected test error'});
  const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const handler=index.slice(index.indexOf('if (timelapseOpenButton) {'),index.indexOf('if (timelapseCloseButton) {'));
  let click,open=false,available=true;const events=[];
  vm.runInNewContext(handler,{timelapseOpenButton:{addEventListener:(_,fn)=>click=fn},syncTimelapseDefaults:()=>available,isRunnerRingsEnglish:()=>true,alert(){},timelapsePanel:{classList:{toggle:()=>open=!open,contains:()=>open},scrollIntoView(){}},gtag:(...a)=>events.push(a)});
  available=false;click();assert.equal(events.length,0);available=true;click();click();assert.equal(events.length,1);assert.equal(events[0][1],'timelapse_open');
  assert.equal((index.match(/gtag\('event', 'timelapse_complete'/g)||[]).length,1);
  assert(index.indexOf("gtag('event', 'timelapse_complete'")>index.indexOf('await stopped;'));
  console.log(JSON.stringify({htmlCount:inventory.length,tracked:inventory.filter(x=>x.status.includes('page_view')).length,existingSyntaxIssues,inventory},null,2));
  console.log('PASS: tags, IDs, inline syntax, initialization, dynamic article, panel events. Video rendering not exercised.');
})().catch(e=>{console.error(e);process.exitCode=1;});
