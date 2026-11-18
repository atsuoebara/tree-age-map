'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const {captureGoTrueH1Receipt,planGoTrueExpiry,releaseExpiredOriginalJwt}=
 require('./rings-now-p2-h2-gotrue-expiry-receipt.cjs');
const A='12345678-1234-4234-8234-123456789abc';
const NOW=2000000000;
function jwt({sub=A,role='authenticated',iat=NOW-30,exp=NOW+300}={}){
 const e=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const p=e({alg:'HS256'})+'.'+e({sub,role,aud:'authenticated',iat,exp});
 return p+'.'+createHmac('sha256','OFFLINE_FIXTURE').update(p).digest('base64url');
}
function h1(token=jwt(),id=A){
 const h={h1Verified:false,evidence:{observations:[
  {caseId:'h1_signup_a'},{caseId:'h1_signin_a'},
  {caseId:'h1_signup_b'},{caseId:'h1_signin_b'},
  {caseId:'h1_bad_password'}
 ]}};
 Object.defineProperties(h,{
  privateTokens:{value:{a:token},enumerable:false},
  privateIds:{value:{a:id},enumerable:false}
 });
 return h;
}
test('H1 token is preserved unchanged, with nonenumerable secret and no proof promotion',()=>{
 const original=jwt(),receipt=captureGoTrueH1Receipt({h1:h1(original),observedAtSeconds:NOW});
 assert.equal(receipt.privateOriginalJwt,original);
 assert.equal(receipt.expiresAtSeconds,NOW+300);
 assert.equal(receipt.signatureVerified,false);
 assert.equal(receipt.realElapsedTimeVerified,false);
 assert.equal(receipt.g4Verified,false);
 assert.ok(!JSON.stringify(receipt).includes(original));
});
test('strict expiration boundary and bounded wait decision',()=>{
 const receipt=captureGoTrueH1Receipt({h1:h1(),observedAtSeconds:NOW});
 assert.equal(planGoTrueExpiry({receipt,nowSeconds:NOW,budgetSeconds:300}).status,
  'BLOCKED_EXPIRY_EXCEEDS_BUDGET');
 assert.equal(planGoTrueExpiry({receipt,nowSeconds:NOW,budgetSeconds:301}).status,
  'WAIT_WITHIN_REMAINING_BUDGET');
 assert.equal(planGoTrueExpiry({receipt,nowSeconds:NOW+300,budgetSeconds:0}).secondsRemaining,1);
 assert.equal(planGoTrueExpiry({receipt,nowSeconds:NOW+301,budgetSeconds:0}).status,
  'CLAIMS_PAST_EXPIRY_NOT_REALTIME_PROOF');
 assert.throws(()=>releaseExpiredOriginalJwt({receipt,observedAtSeconds:NOW+300}));
 const released=releaseExpiredOriginalJwt({receipt,observedAtSeconds:NOW+301});
 assert.equal(released.privateExpiredJwt,receipt.privateOriginalJwt);
 assert.equal(released.realElapsedTimeVerified,false);
 assert.ok(!JSON.stringify(released).includes(receipt.privateOriginalJwt));
});
test('malformed H1 provenance or user/role/expiry fails closed',()=>{
 for(const item of [
  {h1:h1(jwt({sub:A}), '87654321-4321-4321-8321-abcdef123456'),observedAtSeconds:NOW},
  {h1:h1(jwt({role:'service_role'})),observedAtSeconds:NOW},
  {h1:h1(jwt({exp:NOW})),observedAtSeconds:NOW},
  {h1:h1(jwt({iat:NOW+1})),observedAtSeconds:NOW},
  {h1:h1(jwt({exp:NOW+700000})),observedAtSeconds:NOW},
  {h1:{h1Verified:false},observedAtSeconds:NOW}
 ])assert.throws(()=>captureGoTrueH1Receipt(item));
});
test('regressed clock and unbounded budgets reject without leaking JWT',()=>{
 const receipt=captureGoTrueH1Receipt({h1:h1(),observedAtSeconds:NOW});
 for(const nowSeconds of [NOW-1,0,2.5])
  assert.throws(()=>planGoTrueExpiry({receipt,nowSeconds,budgetSeconds:300}));
 for(const budgetSeconds of [-1,541,NaN])
  assert.throws(()=>planGoTrueExpiry({receipt,nowSeconds:NOW,budgetSeconds}));
 assert.throws(()=>releaseExpiredOriginalJwt({receipt,observedAtSeconds:NOW-1}));
});
