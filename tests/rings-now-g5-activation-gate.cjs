'use strict';
const {execFileSync}=require('node:child_process');
const {inspectP2Preflight}=require('./rings-now-p2-stack-static-gate.cjs');
const manifest=require('./rings-now-g5-isolated-manifest.json');
const ALLOWED=['.github/workflows/rings-now-g5-isolated.yml','tests/rings-now-g5-isolated-manifest.json'];
function inspectActivation(){
 try{
  const env=process.env;
  const git=args=>execFileSync('git',args,{encoding:'utf8',timeout:5000,maxBuffer:8192,stdio:['ignore','pipe','ignore']}).trim();
  const head=git(['rev-parse','HEAD']);
  const parents=git(['rev-list','--parents','-n','1','HEAD']).split(/\s+/);
  const changes=git(['diff-tree','--no-commit-id','--name-only','-r','HEAD']).split('\n').sort();
  const pass=inspectP2Preflight(manifest,env).pass&&
   env.GITHUB_ACTIONS==='true'&&env.GITHUB_EVENT_NAME==='workflow_dispatch'&&
   env.GITHUB_RUN_ATTEMPT==='1'&&env.GITHUB_SHA===head&&/^[a-f0-9]{40}$/.test(head)&&
   env.GITHUB_REF==='refs/heads/'+manifest.approvedBranch&&
   /^refs\/heads\/run\/rings-now-g5-[a-z0-9-]+$/.test(env.GITHUB_REF)&&
   parents.length===2&&parents[0]===head&&parents[1]===manifest.checkoutCommit&&
   JSON.stringify(changes)===JSON.stringify(ALLOWED.slice().sort())&&
   git(['status','--porcelain'])===''&&
   Number.isFinite(Date.parse(manifest.approvedNotBefore))&&Number.isFinite(Date.parse(manifest.approvedNotAfter))&&
   Date.parse(manifest.approvedNotAfter)-Date.parse(manifest.approvedNotBefore)<=600000&&
   Date.now()>=Date.parse(manifest.approvedNotBefore)&&Date.now()<=Date.parse(manifest.approvedNotAfter);
  return {pass};
 }catch{return {pass:false};}
}
module.exports={inspectActivation};
