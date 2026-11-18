'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const {inspectCliPreflight}=require('./rings-now-p2-cli.cjs');
const current=require('./rings-now-p2-isolated-manifest.json');
const candidate=require('./rings-now-p2-g1-candidate-manifest.json');
const clone=x=>JSON.parse(JSON.stringify(x));
const copy=()=>clone(current);
function futureFixture(){
 const x=copy();x.status='READY_FOR_REVIEW';
 x.checkoutCommit='a'.repeat(40);
 x.billingZeroAdditionalCost='VERIFIED_FOR_THIS_RUN';
 x.independentAudit='APPROVED_FOR_EXACT_HEAD';
 x.explicitExecutionApproval=true;
 for(const k of ['postgres','gotrue','postgrest'])x.images[k]=clone(candidate.images[k]);
 return x;
}
test('actual imported manifest stays blocked before any Docker attempt',()=>{
 const result=inspectCliPreflight(['--isolated-once'],current,{});
 assert.equal(result.pass,false);
 assert.ok(result.issues.includes('execution_approval_missing'));
 assert.ok(result.issues.includes('manifest_not_in_phase'));
});
test('only an exact single CLI invocation shape is accepted',()=>{
 for(const argv of [[],['--help'],['--isolated-once','--again'],
  ['--isolated-once','--manifest','/tmp/fake'],['--isolated-once','--approved']])
  assert.ok(inspectCliPreflight(argv,futureFixture(),{}).issues.includes('invalid_exact_one_run_argument'));
});
test('fake complete future fixture passes syntax only; no execution',()=>{
 const r=inspectCliPreflight(['--isolated-once'],futureFixture(),{});
 assert.equal(r.pass,true);
});
test('every withheld authorization and injected production env fails',()=>{
 for(const patch of [{explicitExecutionApproval:false},{independentAudit:'PENDING'},
  {checkoutCommit:null},{billingZeroAdditionalCost:'NOT_VERIFIED'},
  {productionAccess:true},{status:'BLOCKED_NOT_RUN'}]){
  assert.equal(inspectCliPreflight(['--isolated-once'],{...futureFixture(),...patch},{}).pass,false);
 }
 for(const key of ['SUPABASE_URL','DATABASE_URL','PGPASSWORD','POSTGREST_JWT_SECRET']){
  const r=inspectCliPreflight(['--isolated-once'],futureFixture(),{[key]:'sentinel'});
  assert.equal(r.pass,false);
  assert.ok(r.issues.includes('forbidden_env_'+key.toLowerCase()));
 }
});
test('actual CLI blocks with no Docker, even when explicitly invoked',()=>{
 const child=spawnSync(process.execPath,[path.join(__dirname,'rings-now-p2-cli.cjs'),'--isolated-once'],{
  encoding:'utf8',timeout:5000,env:{PATH:process.env.PATH||'/usr/bin'}
 });
 assert.equal(child.status,2);
 assert.match(child.stderr,/BLOCKED_NOT_RUN/);
 assert.ok(!child.stdout.includes('DOCKER_CLI_LIFECYCLE'));
});
