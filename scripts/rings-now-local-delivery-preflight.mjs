// REVIEW-ONLY conservative static-source preflight. Never an authorization
// to publish real FIT input. Does not read, store, or parse FIT data.
import {readFileSync} from 'node:fs';
import {resolve,dirname,extname,relative,isAbsolute} from 'node:path';
const STATIC_IMPORT=/\b(?:import\s+(?:[^;\n]*?\s+from\s*)?|export\s+[^;\n]*?\s+from\s*)['"]([^'"]+)['"]/g;
const EGRESS=[
 ['fetch',/\bfetch\s*\(/],['xhr',/\bXMLHttpRequest\b/],
 ['websocket',/\bWebSocket\b/],['eventsource',/\bEventSource\b/],
 ['beacon',/\bsendBeacon\s*\(/],['worker',/\b(?:SharedWorker|Worker)\s*\(/],
 ['serviceworker',/\bserviceWorker\s*\.\s*register\s*\(/],
 ['persistent_storage',/\b(?:localStorage|sessionStorage|indexedDB|caches)\b/],
 ['cross_window',/\bpostMessage\s*\(/],['form_submit',/\.submit\s*\(/],
 ['navigation',/\b(?:location\s*=|location\.assign\s*\(|location\.replace\s*\(|window\.open\s*\()/],
 ['dynamic_import',/\bimport\s*\(/]
];
const line=(s,pos)=>s.slice(0,pos).split('\n').length;
function within(root,path){
 const rel=relative(root,path);
 return rel!==''&&!rel.startsWith('..')&&!isAbsolute(rel);
}
export function inspectSourceGraph({rootDir,entryPath,read=readFileSync}={}){
 if(typeof rootDir!=='string'||typeof entryPath!=='string')throw new TypeError('root and entry required');
 const root=resolve(rootDir),entry=resolve(root,entryPath),problems=[],inspected=[],seen=new Set();
 if(!within(root,entry))return {status:'blocked',problems:[{code:'entry_outside_root'}],inspected:[]};
 const queue=[entry];
 while(queue.length){
  const path=queue.shift();
  if(seen.has(path))continue;
  seen.add(path);
  if(!within(root,path)){problems.push({code:'import_outside_root',file:path});continue}
  let content;
  try{content=read(path,'utf8')}catch{problems.push({code:'missing_or_unreadable_source',file:relative(root,path)});continue}
  const file=relative(root,path);
  inspected.push(file);
  if(!['.mjs','.js','.html'].includes(extname(path)))problems.push({code:'unknown_source_type',file});
  for(const [name,regex] of EGRESS){const match=regex.exec(content);if(match)problems.push({code:name,file,line:line(content,match.index)})}
  if(extname(path)==='.html'){
   if(!/connect-src\s+'none'/.test(content))problems.push({code:'missing_connect_src_none',file});
   if(!/form-action\s+'none'/.test(content))problems.push({code:'missing_form_action_none',file});
   if(/<script\b[^>]*\bsrc\s*=/.test(content))problems.push({code:'script_src_requires_review',file});
   if(/<form\b/i.test(content))problems.push({code:'form_element_requires_review',file});
  }
  let m;
  const re=new RegExp(STATIC_IMPORT.source,'g');
  while((m=re.exec(content))){
   const spec=m[1];
   if(!spec.startsWith('.')){problems.push({code:'non_relative_import',file,spec});continue}
   const target=resolve(dirname(path),spec);
   if(!within(root,target)){problems.push({code:'import_outside_root',file,spec});continue}
   queue.push(target);
  }
 }
 return {status:problems.length?'blocked':'requires_manual_review',
  problems,inspected:inspected.sort()};
}
// Output is only source filenames and static findings, never a FIT payload.
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 const root=process.argv[2],entry=process.argv[3];
 if(!root||!entry)throw Error('usage: node scripts/rings-now-local-delivery-preflight.mjs <checkout-root> <relative-html>');
 const result=inspectSourceGraph({rootDir:root,entryPath:entry});
 console.log(JSON.stringify(result,null,2));
 if(result.status==='blocked')process.exitCode=1;
}
