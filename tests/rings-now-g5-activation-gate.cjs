'use strict';
const {execFileSync}=require('node:child_process');
const {inspectP2Preflight}=require('./rings-now-p2-stack-static-gate.cjs');
const manifest=require('./rings-now-g5-isolated-manifest.json');
const ALLOWED=['.github/workflows/rings-now-g5-isolated.yml','tests/rings-now-g5-isolated-manifest.json'];
function inspectActivationFacts({manifest:m,env,head,parents,changes,clean,now}={}){
 try{
  const begin=Date.parse(m.approvedNotBefore),end=Date.parse(m.approvedNotAfter);
  const pass=inspectP2Preflight(m,env).pass&&
   env.GITHUB_ACTIONS==='true'&&env.GITHUB_EVENT_NAME==='workflow_dispatch'&&
   env.GITHUB_RUN_ATTEMPT==='1'&&env.GITHUB_SHA===head&&/^[a-f0-9]{40}$/.test(head)&&
   env.GITHUB_REF==='refs/heads/'+m.approvedBranch&&
   /^refs\/heads\/run\/rings-now-g5-[a-z0-9-]+$/.test(env.GITHUB_REF)&&
   parents.length===2&&parents[0]===head&&parents[1]===m.checkoutCommit&&
   JSON.stringify(changes.slice().sort())===JSON.stringify(ALLOWED.slice().sort())&&
   clean===true&&Number.isFinite(now)&&Number.isFinite(begin)&&Number.isFinite(end)&&
   end>begin&&end-begin<=600000&&now>=begin&&now<=end;
  return {pass:pass===true};
 }catch{return {pass:false};}
}
function inspectActivation(){
 try{
  const git=args=>execFileSync('git',args,{encoding:'utf8',timeout:5000,maxBuffer:8192,stdio:['ignore','pipe','ignore']}).trim();
  return inspectActivationFacts({manifest,env:process.env,
   head:git(['rev-parse','HEAD']),
   parents:git(['rev-list','--parents','-n','1','HEAD']).split(/\s+/),
   changes:git(['diff-tree','--no-commit-id','--name-only','-r','HEAD']).split('\n'),
   clean:git(['status','--porcelain'])==='',now:Date.now()});
 }catch{return {pass:false};}
}
module.exports={inspectActivation,inspectActivationFacts};
