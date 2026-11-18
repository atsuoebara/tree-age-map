'use strict';
// Dormant, pure receipt gate for one *unchanged* GoTrue H1 access token.
// Time inputs are caller observations: they are NOT proof of elapsed real time.
const assert=require('node:assert/strict');
const {claimsOf}=require('./rings-now-p2-h2-postgrest-http.cjs');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const USER='a';
function captureGoTrueH1Receipt({h1,observedAtSeconds}={}){
 assert.ok(h1&&typeof h1==='object'&&h1.h1Verified===false);
 assert.ok(h1.evidence?.observations?.length===5,'complete H1 evidence required');
 assert.ok(Number.isSafeInteger(observedAtSeconds)&&observedAtSeconds>0);
 const token=h1.privateTokens?.[USER],id=h1.privateIds?.[USER];
 assert.match(id||'',UUID);
 const c=claimsOf(token);
 assert.equal(c.sub,id);assert.equal(c.role,'authenticated');
 assert.equal(c.aud,'authenticated');
 assert.ok(Number.isSafeInteger(c.iat)&&Number.isSafeInteger(c.exp));
 assert.ok(c.exp>c.iat);
 assert.ok(c.exp>observedAtSeconds,'capture only while live');
 assert.ok(c.iat<=observedAtSeconds,'cannot capture before issuance');
 assert.ok(c.exp-c.iat<=604800,'reject unbounded access token TTL');
 const receipt={
  status:'GOTRUE_H1_TOKEN_RECEIPT_CLAIMS_ONLY',
  subject:id,issuedAtSeconds:c.iat,expiresAtSeconds:c.exp,
  observedAtSeconds,provenance:'H1_SIGNIN_HTTP_RESPONSE_NOT_SIGNATURE_PROVEN',
  signatureVerified:false,realElapsedTimeVerified:false,g4Verified:false
 };
 Object.defineProperty(receipt,'privateOriginalJwt',{value:token,enumerable:false});
 return Object.freeze(receipt);
}
function planGoTrueExpiry({receipt,nowSeconds,budgetSeconds}={}){
 assert.equal(receipt?.status,'GOTRUE_H1_TOKEN_RECEIPT_CLAIMS_ONLY');
 assert.equal(receipt.signatureVerified,false);
 assert.ok(Number.isSafeInteger(nowSeconds)&&nowSeconds>=receipt.observedAtSeconds,
  'clock regression refused');
 assert.ok(Number.isSafeInteger(budgetSeconds)&&budgetSeconds>=0&&budgetSeconds<=540,
  'bounded time budget required');
 // Strictly past expiry; equality is NOT accepted by downstream H2.
 const secondsRemaining=Math.max(0,receipt.expiresAtSeconds+1-nowSeconds);
 const status=secondsRemaining===0?'CLAIMS_PAST_EXPIRY_NOT_REALTIME_PROOF':
  secondsRemaining<=budgetSeconds?'WAIT_WITHIN_REMAINING_BUDGET':
  'BLOCKED_EXPIRY_EXCEEDS_BUDGET';
 return Object.freeze({status,secondsRemaining,
  originalTokenPreserved:true,tokenMutated:false,
  realElapsedTimeVerified:false,g4Verified:false});
}
function releaseExpiredOriginalJwt({receipt,observedAtSeconds}={}){
 // This is NOT a time wait or clock attestation. The caller must separately
 // verify real wall clock, monotonic deadline and authentic GoTrue provenance.
 const decision=planGoTrueExpiry({receipt,nowSeconds:observedAtSeconds,budgetSeconds:0});
 assert.equal(decision.status,'CLAIMS_PAST_EXPIRY_NOT_REALTIME_PROOF',
  'must not release before the original exp is strictly past');
 const result={
  status:'ORIGINAL_GOTRUE_H1_CLAIMS_EXPIRED_NOT_SIGNATURE_PROVEN',
  subject:receipt.subject,originalTokenPreserved:true,
  signatureVerified:false,realElapsedTimeVerified:false,g4Verified:false
 };
 Object.defineProperty(result,'privateExpiredJwt',{
  value:receipt.privateOriginalJwt,enumerable:false
 });
 return Object.freeze(result);
}
module.exports={captureGoTrueH1Receipt,planGoTrueExpiry,releaseExpiredOriginalJwt};
