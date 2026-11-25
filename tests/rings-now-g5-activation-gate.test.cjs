'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {inspectActivationFacts}=require('./rings-now-g5-activation-gate.cjs');
const blocked=require('./rings-now-g5-isolated-manifest.json');
const parent='a'.repeat(40),head='b'.repeat(40),branch='run/rings-now-g5-test';
const begin=1800000000000,end=begin+600000;
function fixture(){
 return {manifest:{...blocked,status:'READY_FOR_REVIEW',checkoutCommit:parent,billingZeroAdditionalCost:'VERIFIED_FOR_THIS_RUN',independentAudit:'APPROVED_FOR_EXACT_HEAD',explicitExecutionApproval:true,approvedBranch:branch,approvedNotBefore:new Date(begin).toISOString(),approvedNotAfter:new Date(end).toISOString()},env:{GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:head,GITHUB_REF:'refs/heads/'+branch},head,parents:[head,parent],changes:['.github/workflows/rings-now-g5-isolated.yml','tests/rings-now-g5-isolated-manifest.json'],clean:true,now:begin};
}
test('synthetic exact approval child accepted as structure only',()=>{assert.equal(inspectActivationFacts(fixture()).pass,true);});
test('blocked manifest and approval omissions fail closed',()=>{
 for(const patch of [{status:'BLOCKED_NOT_RUN'},{explicitExecutionApproval:false},{independentAudit:'PENDING'},{billingZeroAdditionalCost:'NOT_VERIFIED'},{productionAccess:true}]){
 const f=fixture();Object.assign(f.manifest,patch);assert.equal(inspectActivationFacts(f).pass,false);
 }
});
test('wrong ref, attempt, event, checkout, diff or dirty worktree denied',()=>{
 for(const patch of [{GITHUB_REF:'refs/heads/main'},{GITHUB_RUN_ATTEMPT:'2'},{GITHUB_EVENT_NAME:'push'},{GITHUB_SHA:parent},{DATABASE_URL:'synthetic'}]){
 const f=fixture();Object.assign(f.env,patch);assert.equal(inspectActivationFacts(f).pass,false);
 }
 for(const patch of [{parents:[head,parent,parent]},{parents:[head,head]},{changes:[]},{changes:['README.md']},{clean:false}]){
 assert.equal(inspectActivationFacts({...fixture(),...patch}).pass,false);
 }
});
test('bounded approval window including endpoints, excluding outside and invalid windows',()=>{
 for(const now of [begin,end])assert.equal(inspectActivationFacts({...fixture(),now}).pass,true);
 for(const now of [begin-1,end+1,NaN])assert.equal(inspectActivationFacts({...fixture(),now}).pass,false);
 for(const until of [begin,begin-1,end+1]){const f=fixture();f.manifest.approvedNotAfter=new Date(until).toISOString();assert.equal(inspectActivationFacts(f).pass,false);}
});
