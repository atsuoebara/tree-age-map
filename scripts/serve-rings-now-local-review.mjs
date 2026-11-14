// PRIVATE LOCAL REVIEW SERVER. Never start from a public host or deploy as a website.
// No POST, no FIT upload, no request logging. Run only after separate owner approval
// to open the FIT review on their own PC; actual real-FIT use requires another approval.
import {createServer} from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve,dirname,relative,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {localReviewHtml} from '../src/rings-now-local-fit-review-page.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const ENTRY='src/rings-now-iphone-isolated-handoff.mjs';
const IMPORT=/\b(?:import\s+(?:[^;\n]*?\s+from\s*)?|export\s+[^;\n]*?\s+from\s*)['"](\.{1,2}\/[^'"]+)['"]/g;
const allowedPath=p=>{
 const rel=relative(ROOT,p);
 return !!rel&&!rel.startsWith('..')&&!rel.startsWith('/')&&!rel.startsWith('\\')&&
  (rel.startsWith('src/')||rel.startsWith('fit-sdk/'))&&
  ['.mjs','.js'].includes(extname(p));
};
export function discoverAllowedSources(){
 const found=new Set(),pending=[resolve(ROOT,ENTRY)];
 while(pending.length){
  const file=pending.shift();if(found.has(file))continue;
  if(!allowedPath(file))throw new Error('Unexpected source dependency path');
  const content=readFileSync(file,'utf8');found.add(file);
  let m;const matcher=new RegExp(IMPORT.source,'g');
  while((m=matcher.exec(content))) pending.push(resolve(dirname(file),m[1]));
 }
 return found;
}
const commonHeaders={
 'Cache-Control':'no-store, no-cache, max-age=0',
 'Pragma':'no-cache',
 'Referrer-Policy':'no-referrer',
 'X-Content-Type-Options':'nosniff',
 'X-Robots-Tag':'noindex, nofollow, noarchive',
 'Cross-Origin-Resource-Policy':'same-origin',
 'Content-Security-Policy':"default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'"
};
const eq=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)};
export function startLocalFitReview({port=0}={}){
 const allowed=discoverAllowedSources();
 const secret=randomBytes(32).toString('hex'),cookieName='rr_rings_now_local';
 let consumed=false;
 const server=createServer((req,res)=>{
  const deny=(code)=>{res.writeHead(code,{...commonHeaders,'Content-Type':'text/plain; charset=utf-8'});res.end('Unavailable')};
  if(req.method!=='GET'&&req.method!=='HEAD'){deny(405);return}
  if(req.socket.remoteAddress!=='127.0.0.1' && req.socket.remoteAddress!=='::ffff:127.0.0.1'){deny(403);return}
  if(req.headers.host!=='127.0.0.1:'+server.address()?.port){deny(403);return}
  const path=req.url?.split('?')[0];
  if(path==='/open/'+secret){
   if(req.method!=='GET'||consumed){deny(403);return}
   consumed=true;
   res.writeHead(303,{...commonHeaders,'Location':'/review','Set-Cookie':cookieName+'='+secret+'; HttpOnly; SameSite=Strict; Path=/','Content-Type':'text/plain'});
   res.end();return;
  }
  const cookies=(req.headers.cookie||'').split(';').map(x=>x.trim());
  const val=cookies.find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';
  if(!consumed||!eq(val,secret)){deny(403);return}
  if(path==='/review'){
   res.writeHead(200,{...commonHeaders,'Content-Type':'text/html; charset=utf-8'});
   res.end(req.method==='HEAD'?'':localReviewHtml());return
  }
  // Serve ONLY the audited static import graph. Never serve FITs or arbitrary files.
  const requested=typeof path==='string'&&/^\/(?:src|fit-sdk)\/[a-zA-Z0-9_.\/-]+$/.test(path)?resolve(ROOT,'.'+path):null;
  if(!requested||!allowed.has(requested)){deny(404);return}
  res.writeHead(200,{...commonHeaders,'Content-Type':'text/javascript; charset=utf-8'});
  res.end(req.method==='HEAD'?'':readFileSync(requested)); 
 });
 return new Promise((done,fail)=>{
  server.once('error',fail);
  server.listen(port,'127.0.0.1',()=>done({server,url:'http://127.0.0.1:'+server.address().port+'/open/'+secret,allowedCount:allowed.size}));
 });
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 startLocalFitReview().then(x=>{
  process.stdout.write('LOCAL-ONLY review address (keep private): '+x.url+'\n');
  process.stdout.write('CTRL+C stops local server. Do not select real FIT without separate approval.\n');
 }).catch(e=>{process.stderr.write('Unable to start private review server: '+e.message+'\n');process.exitCode=1});
}
