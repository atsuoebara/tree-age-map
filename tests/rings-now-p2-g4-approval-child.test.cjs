'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {inspectApprovalOnlyChild}=require('./rings-now-p2-g4-approval-child.cjs');
const {inspectCurrentCheckout}=require('./rings-now-p2-g4-approval-child-cli.cjs');
const source='a'.repeat(40),approval='b'.repeat(40);
const workflow='.github/workflows/rings-now-p2-isolated-manual.yml';
const manifestPath='tests/rings-now-p2-isolated-manifest.json';
function candidate(){
 return {manifest:{checkoutCommit:source,productionAccess:false},
  checkoutSha:approval,parents:[source],changedPaths:[workflow,manifestPath]};
}
test('B child structure can be described, but NEVER proves independent approval',()=>{
 const r=inspectApprovalOnlyChild(candidate());
 assert.equal(r.issues.length,0);
 assert.equal(r.g4Verified,false);
 assert.equal(r.executionAuthorized,false);
 assert.equal(r.gitObjectAuthenticityVerified,false);
 assert.equal(r.sourceContentsIndependentlyAudited,false);
});
test('two parents, no parent and self-reference are rejected',()=>{
 for(const parents of [[],[source,source],[approval]]){
  const x=candidate();x.parents=parents;
  assert.equal(inspectApprovalOnlyChild(x).status,'BLOCKED_APPROVAL_ONLY_CHILD');
 }
 const x=candidate();x.manifest.checkoutCommit=approval;
 assert.ok(inspectApprovalOnlyChild(x).issues.includes('manifest_source_parent_mismatch'));
});
test('unapproved file and duplicate change path are blocked',()=>{
 for(const paths of [[workflow,'tests/rings-now-p2-real-docker-runner.cjs'],
                     [workflow,workflow],[],[workflow,manifestPath,'README.md']]){
  const x=candidate();x.changedPaths=paths;
  assert.ok(inspectApprovalOnlyChild(x).issues.includes('approval_delta_not_restricted'));
 }
});
function gitFixture(overrides={}){
 const mapping={
  'rev-parse HEAD':approval,
  'rev-list --parents -n 1 HEAD':approval+' '+source,
  'diff-tree --no-commit-id --name-only -r HEAD':workflow+'\n'+manifestPath+'\n',
  ...overrides
 };
 return argv=>{
  const key=argv.join(' ');
  if(!Object.hasOwn(mapping,key))throw Error('unexpected mock git');
  return mapping[key];
 };
}
test('the read-only Git bridge checks HEAD, sole parent and exact file list',()=>{
 const x=inspectCurrentCheckout({
  readGit:gitFixture(),githubSha:approval,
  manifest:candidate().manifest
 });
 assert.equal(x.issues.length,0);assert.equal(x.executionAuthorized,false);
 for(const override of [
  {githubSha:source},
  {readGit:gitFixture({'rev-list --parents -n 1 HEAD':approval+' '+source+' '+source})},
  {readGit:gitFixture({'diff-tree --no-commit-id --name-only -r HEAD':workflow+'\n'+'src/app.js\n'})},
  {readGit:()=>{throw Error('shallow clone parent unavailable');}}
 ]){
  const y=inspectCurrentCheckout({
   readGit:override.readGit||gitFixture(),
   githubSha:override.githubSha||approval,manifest:candidate().manifest
  });
  assert.equal(y.status,'BLOCKED_APPROVAL_ONLY_CHILD');
 }
});
test('the actual source manifest cannot be treated as approved child',()=>{
 const current=require('./rings-now-p2-isolated-manifest.json');
 const x=inspectApprovalOnlyChild({...candidate(),manifest:current});
 assert.equal(x.status,'BLOCKED_APPROVAL_ONLY_CHILD');
 assert.equal(x.executionAuthorized,false);
});
