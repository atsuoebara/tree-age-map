'use strict';
// Future dormant workflow preflight. No work on import.
// Only read Git commit metadata from current checkout; no arbitrary refs or args.
const {execFileSync}=require('node:child_process');
const {inspectApprovalOnlyChild}=require('./rings-now-p2-g4-approval-child.cjs');
function inspectCurrentCheckout({readGit,githubSha,manifest}={}){
 if(typeof readGit!=='function')return {status:'BLOCKED_APPROVAL_ONLY_CHILD',issues:['git_reader_missing']};
 try{
  const head=readGit(['rev-parse','HEAD']).trim();
  const raw=readGit(['rev-list','--parents','-n','1','HEAD']).trim().split(/\s+/);
  const paths=readGit(['diff-tree','--no-commit-id','--name-only','-r','HEAD'])
   .split('\n').filter(Boolean);
  if(raw[0]!==head||head!==githubSha)
   return {status:'BLOCKED_APPROVAL_ONLY_CHILD',issues:['dispatch_head_mismatch']};
  return inspectApprovalOnlyChild({manifest,checkoutSha:head,
   parents:raw.slice(1),changedPaths:paths});
 }catch{
  return {status:'BLOCKED_APPROVAL_ONLY_CHILD',issues:['git_metadata_unavailable']};
 }
}
function main(){
 const manifest=require('./rings-now-p2-isolated-manifest.json');
 const report=inspectCurrentCheckout({
  githubSha:process.env.GITHUB_SHA,manifest,
  readGit:argv=>execFileSync('git',argv,{
   encoding:'utf8',timeout:5000,maxBuffer:8192,stdio:['ignore','pipe','ignore']
  })
 });
 if(report.issues.length){
  process.stderr.write('BLOCKED_NOT_RUN: approval-only parent/diff preflight failed\n');
  process.exitCode=2;
  return;
 }
 // Not proof of an audit or authority; the existing manifest preflight still
 // rejects unless exact owner approval, fresh billing and independent audit exist.
 process.stdout.write('APPROVAL_CHILD_STRUCTURE_ONLY_NOT_G4_PROOF\n');
}
if(require.main===module)main();
module.exports={inspectCurrentCheckout,main};
