'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {createHmac}=require('node:crypto');
const {createEphemeralP2Runtime}=require('./rings-now-p2-ephemeral-service-runtime.cjs');
const {JWT_TTL_SECONDS,checkIsolatedGoTrueTtl,assertGoTrueIssuedTtl}=
 require('./rings-now-p2-h2-isolated-gotrue-ttl.cjs');
function readEnv(file){return Object.fromEntries(fs.readFileSync(file,'utf8')
 .trim().split('\n').map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)];}));}
test('only run-owned disposable GoTrue gets TTL 300, secrets private and 0600',()=>{
 const rt=createEphemeralP2Runtime();
 try{
  const env=readEnv(rt.envFiles.gotrue);
  assert.equal(env.GOTRUE_JWT_EXP,'300');
  assert.equal(JWT_TTL_SECONDS,300);
  assert.equal(fs.statSync(rt.envFiles.gotrue).mode&0o777,0o600);
  assert.equal(env.GOTRUE_JWT_SECRET,readEnv(rt.envFiles.postgrest).PGRST_JWT_SECRET);
  assert.equal(checkIsolatedGoTrueTtl({env,executeRemainingMs:420000,
   setupReserveMs:90000}).status,'TTL_BUDGET_FEASIBLE_NOT_REALTIME_PROOF');
  assert.ok(!JSON.stringify(rt).includes(env.GOTRUE_JWT_SECRET));
 }finally{rt.dispose();}
});
test('TTL plan has strict exp+1 margin and never borrows cleanup reserve',()=>{
 const env={GOTRUE_JWT_EXP:'300',GOTRUE_JWT_AUD:'authenticated'};
 const p=checkIsolatedGoTrueTtl({env,executeRemainingMs:301000});
 assert.equal(p.requiredMs,301000);
 assert.equal(p.permittedMs,301000);
 assert.equal(p.cleanupAlreadyReservedByParent,true);
 assert.equal(p.g4Verified,false);
 for(const m of [0,300000,300999])
  assert.equal(checkIsolatedGoTrueTtl({env,executeRemainingMs:m}).status,
   'BLOCKED_TTL_EXCEEDS_EXECUTE_BUDGET');
 assert.equal(checkIsolatedGoTrueTtl({env,executeRemainingMs:400000,
  setupReserveMs:100000}).status,'BLOCKED_TTL_EXCEEDS_EXECUTE_BUDGET');
});
test('wrong, missing or below-minimum TTL rejected before any operation',()=>{
 for(const value of ['60','299','301','3600',undefined]){
  assert.throws(()=>checkIsolatedGoTrueTtl({
   env:{GOTRUE_JWT_EXP:value,GOTRUE_JWT_AUD:'authenticated'},
   executeRemainingMs:500000
  }));
 }
 for(const setupReserveMs of [-1,1.5,NaN]){
  assert.throws(()=>checkIsolatedGoTrueTtl({
   env:{GOTRUE_JWT_EXP:'300',GOTRUE_JWT_AUD:'authenticated'},
   executeRemainingMs:500000,setupReserveMs
  }));
 }
});
test('JWT claims TTL verified without treating synthetic token as GoTrue proof',()=>{
 const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const sign=(ttl)=>{
  const msg=encode({alg:'HS256'})+'.'+encode({
   sub:'12345678-1234-4234-8234-123456789abc',
   aud:'authenticated',role:'authenticated',iat:2000000000,exp:2000000000+ttl
  });
  return msg+'.'+createHmac('sha256','TEST_ONLY').update(msg).digest('base64url');
 };
 const outcome=assertGoTrueIssuedTtl({token:sign(300),observedAtSeconds:2000000001});
 assert.equal(outcome.signatureVerified,false);
 assert.equal(outcome.g4Verified,false);
 for(const ttl of [299,301,3600])
  assert.throws(()=>assertGoTrueIssuedTtl({
   token:sign(ttl),observedAtSeconds:2000000001
  }));
 assert.throws(()=>assertGoTrueIssuedTtl({token:sign(300),observedAtSeconds:2000000300}));
});
