'use strict';
// G5 isolated use only; never import production secrets.
// A missing approval window or unreadable Actions history must block.
const https=require('node:https');
const {inspectOneShotHistory}=require('./rings-now-p3-v03-one-shot-history.cjs');
const block=()=>{process.stderr.write('BLOCKED_NOT_RUN: G5 one-shot history not proven\n');process.exit(2);};
async function main(){
 const m=require('./rings-now-p3-v03-isolated-manifest.json');
 const env=process.env;
 const repo=env.GITHUB_REPOSITORY,sha=env.GITHUB_SHA,id=env.GITHUB_RUN_ID;
 const attempt=Number(env.GITHUB_RUN_ATTEMPT);
 const branch=env.GITHUB_REF_NAME,token=env.GH_TOKEN;
 const start=m.approvedNotBefore;
 if(repo!=='atsuoebara/tree-age-map'||env.GITHUB_EVENT_NAME!=='workflow_dispatch'||
    typeof start!=='string'||branch!==m.approvedBranch||!token||attempt!==1)block();
 const url='https://api.github.com/repos/'+repo+
   '/actions/workflows/rings-now-p3-v03-isolated.yml/runs?'+
   'created='+encodeURIComponent('>='+start)+'&event=workflow_dispatch&per_page=100';
 let body='';
 const response=await new Promise((resolve,reject)=>{
  const req=https.get(url,{headers:{
    'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28','User-Agent':'rings-now-one-shot'
  }},res=>{
    if(res.statusCode!==200){res.resume();return reject(Error('github_status'));}
    res.setEncoding('utf8');
    res.on('data',part=>{body+=part;if(body.length>150000)req.destroy(Error('response_too_large'));});
    res.on('error',reject);
    res.on('end',()=>{try{resolve(JSON.parse(body));}catch{reject(Error('invalid_json'));}});
  });
  const timer=setTimeout(()=>req.destroy(Error('absolute_timeout')),8000);
  req.once('close',()=>clearTimeout(timer));
  req.setTimeout(8000,()=>req.destroy(Error('timeout')));
  req.on('error',reject);
 });
 const r=inspectOneShotHistory({response,runId:id,headSha:sha,runAttempt:attempt,
   branch,windowStart:start,windowEnd:m.approvedNotAfter});
 if(!r.pass)block();
 process.stdout.write('ONE_SHOT_HISTORY_VERIFIED\n');
}
if(require.main===module)main().catch(block);
module.exports={main};
