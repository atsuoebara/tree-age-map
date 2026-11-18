'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const {prepareOriginalJwtH2}=require('./rings-now-p2-h2-original-jwt-stage.cjs');
const A='12345678-1234-4234-8234-123456789abc';
const B='87654321-4321-4321-8321-abcdef123456';
const N=2000000000,ENV={GOTRUE_JWT_EXP:'300',GOTRUE_JWT_AUD:'authenticated'};
function jwt(sub,iat,exp){
 const e=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const body=e({alg:'HS256',typ:'JWT'})+'.'+e({
  sub,role:'authenticated',aud:'authenticated',iat,exp
 });
 return body+'.'+createHmac('sha256','OFFLINE_FAKE_ONLY').update(body).digest('base64url');
}
function sessions(a,b,ids={a:A,b:B}){
 const h={h1Verified:false,evidence:{observations:Array(5).fill({})}};
 Object.defineProperties(h,{privateTokens:{value:{a,b},enumerable:false},
  privateIds:{value:ids,enumerable:false}});
 return Object.freeze(h);
}
function setup(){
 const old=jwt(A,N,N+300),oldB=jwt(B,N,N+300);
 const original=sessions(old,oldB);
 const fresh=sessions(jwt(A,N+300,N+600),jwt(B,N+300,N+600));
 const steps=[];
 const base={
  originalH1:original,gotrueEnv:ENV,observedAtSeconds:N,
  executeRemainingMs:410000,postWaitReserveMs:60000,
  waitForOriginalExpiry:async ({receipt})=>{
   steps.push('wait');return Object.freeze({
    status:'ORIGINAL_JWT_RELEASED_AFTER_INJECTED_CLOCKS_NOT_G4_PROOF',
    privateExpiredJwt:receipt.privateOriginalJwt,g4Verified:false
   });
  },
  refreshOwners:async ()=>{steps.push('refresh');return fresh;},
  readWallSeconds:()=>N+301
 };
 return {old,original,fresh,base,steps};
}
test('offline callback contract releases unchanged original and fresh matching users',async()=>{
 const x=setup();
 const result=await prepareOriginalJwtH2(x.base);
 assert.equal(result.status,'ORIGINAL_GOTRUE_H2_HANDOFF_CLAIMS_ONLY_NOT_G4_PROOF');
 assert.deepEqual(x.steps,['wait','refresh']);
 assert.equal(result.privateExpiredOriginalJwt,x.old);
 assert.equal(result.privateRefreshedH1,x.fresh);
 assert.equal(result.g4Verified,false);
 assert.equal(result.realElapsedTimeVerified,false);
 assert.ok(!JSON.stringify(result).includes(x.old));
 assert.ok(!JSON.stringify(result).includes(x.fresh.privateTokens.a));
});
test('insufficient execute budget rejects without waiting or refresh',async()=>{
 const x=setup();
 const result=await prepareOriginalJwtH2({
  ...x.base,executeRemainingMs:360000,postWaitReserveMs:60000
 });
 assert.equal(result.status,'BLOCKED_ORIGINAL_JWT_BUDGET_NOT_RUN');
 assert.equal(result.attempted,false);
 assert.deepEqual(x.steps,[]);
});
test('blocked expiry wait cannot refresh owners',async()=>{
 const x=setup();
 const result=await prepareOriginalJwtH2({...x.base,
  waitForOriginalExpiry:async()=>({
   status:'BLOCKED_EXPIRY_EXCEEDS_BUDGET'
  })
 });
 assert.equal(result.status,'BLOCKED_ORIGINAL_JWT_WAIT_NOT_RUN');
 assert.deepEqual(x.steps,[]);
});
test('reject forged expiration return, exp equality and clock regression',async()=>{
 const x=setup();
 await assert.rejects(()=>prepareOriginalJwtH2({...x.base,
  waitForOriginalExpiry:async()=>({
   status:'ORIGINAL_JWT_RELEASED_AFTER_INJECTED_CLOCKS_NOT_G4_PROOF',
   privateExpiredJwt:jwt(A,N-1,N+300),g4Verified:false
  })
 }));
 assert.deepEqual(x.steps,[]);
 const y=setup();
 await assert.rejects(()=>prepareOriginalJwtH2({...y.base,
  readWallSeconds:()=>N+300
 }));
 assert.deepEqual(y.steps,['wait']);
 const z=setup();let count=0;
 await assert.rejects(()=>prepareOriginalJwtH2({...z.base,
  readWallSeconds:()=>++count===1?N+301:N+300
 }));
 assert.deepEqual(z.steps,['wait','refresh']);
});
test('reject mismatched refresh identity and old session reuse',async()=>{
 for(const fresh of [
  sessions(jwt(B,N+300,N+600),jwt(A,N+300,N+600)),
  sessions(jwt(A,N,N+300),jwt(B,N+300,N+600)),
  sessions(jwt(A,N+300,N+600),jwt(B,N+300,N+600),{a:A,b:A})
 ]){
  const x=setup();
  await assert.rejects(()=>prepareOriginalJwtH2({
   ...x.base,refreshOwners:async()=>fresh
  }));
 }
});
test('reject TTL mismatch and runner proof promotion without refresh',async()=>{
 const x=setup();
 await assert.rejects(()=>prepareOriginalJwtH2({
  ...x.base,gotrueEnv:{...ENV,GOTRUE_JWT_EXP:'3600'}
 }));
 assert.deepEqual(x.steps,[]);
 const y=setup();
 await assert.rejects(()=>prepareOriginalJwtH2({
  ...y.base,waitForOriginalExpiry:async({receipt})=>({
   status:'ORIGINAL_JWT_RELEASED_AFTER_INJECTED_CLOCKS_NOT_G4_PROOF',
   privateExpiredJwt:receipt.privateOriginalJwt,g4Verified:true
  })
 }));
 assert.deepEqual(y.steps,[]);
});
