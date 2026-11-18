'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const {prepareRefreshedH2Sessions}=require('./rings-now-p2-h2-refresh-handoff.cjs');
const A='12345678-1234-4234-8234-123456789abc';
const B='87654321-4321-4321-8321-abcdef123456';
const N=2000000000;
function token(sub,iat,exp,role='authenticated'){
 const e=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const input=e({alg:'HS256',typ:'JWT'})+'.'+e({sub,role,aud:'authenticated',iat,exp});
 return input+'.'+createHmac('sha256','OFFLINE_FAKE_ONLY').update(input).digest('base64url');
}
function h1(a,b,ids={a:A,b:B}){
 const report={h1Verified:false};
 Object.defineProperties(report,{
  privateTokens:{value:{a,b},enumerable:false},
  privateIds:{value:ids,enumerable:false}
 });
 return Object.freeze(report);
}
function pair(){
 const old=token(A,N-301,N-1);
 const original=h1(old,token(B,N-301,N-1));
 const refreshed=h1(token(A,N-1,N+299),token(B,N-1,N+299));
 return {old,original,refreshed};
}
test('preserves exact expired JWT while returning refreshed same-owner sessions privately',()=>{
 const p=pair();
 const result=prepareRefreshedH2Sessions({
  originalH1:p.original,refreshedH1:p.refreshed,
  expiredOriginalJwt:p.old,nowSeconds:N
 });
 assert.equal(result.status,'H2_REFRESHED_OWNERS_CLAIMS_ONLY_NOT_G4_PROOF');
 assert.equal(result.privateExpiredOriginalJwt,p.old);
 assert.equal(result.privateTokens.a,p.refreshed.privateTokens.a);
 assert.equal(result.privateTokens.b,p.refreshed.privateTokens.b);
 assert.equal(result.g4Verified,false);
 assert.equal(result.realElapsedTimeVerified,false);
 for(const secret of [p.old,p.refreshed.privateTokens.a,p.refreshed.privateTokens.b])
  assert.ok(!JSON.stringify(result).includes(secret));
});
test('rejects exp boundary, altered old JWT, stale/invalid or wrong-owner refresh',()=>{
 const p=pair();
 const base={originalH1:p.original,refreshedH1:p.refreshed,
  expiredOriginalJwt:p.old,nowSeconds:N};
 const bad=[
  {...base,nowSeconds:N-1},
  {...base,expiredOriginalJwt:token(A,N-301,N-1)},
  {...base,refreshedH1:h1(token(B,N-1,N+299),token(A,N-1,N+299))},
  {...base,refreshedH1:h1(token(A,N-1,N+299),token(B,N-1,N+299),{a:B,b:A})},
  {...base,refreshedH1:h1(p.old,token(B,N-1,N+299))},
  {...base,refreshedH1:h1(token(A,N-1,N),token(B,N-1,N+299))},
  {...base,refreshedH1:h1(token(A,N+1,N+299),token(B,N-1,N+299))},
  {...base,refreshedH1:h1(token(A,N-1,N+299,'service_role'),token(B,N-1,N+299))},
  {...base,refreshedH1:h1(token(A,N-1,N+299),token(B,N-1,N+299),{a:A,b:A})}
 ];
 for(const input of bad)assert.throws(()=>prepareRefreshedH2Sessions(input));
});
