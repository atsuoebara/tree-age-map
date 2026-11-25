'use strict';
// Rings Now: dormant pre-HTTP H2 preparation using an original H1 GoTrue JWT.
// No I/O on import; callbacks are supplied by a separately audited runner.
// A fake callback cannot establish authentic GoTrue issuance or elapsed time.
const assert=require('node:assert/strict');
const {captureGoTrueH1Receipt}=
 require('./rings-now-p2-h2-gotrue-expiry-receipt.cjs');
const {checkIsolatedGoTrueTtl,assertGoTrueIssuedTtl}=
 require('./rings-now-p2-h2-isolated-gotrue-ttl.cjs');
const {prepareRefreshedH2Sessions}=
 require('./rings-now-p2-h2-refresh-handoff.cjs');

async function prepareOriginalJwtH2({
 originalH1,gotrueEnv,observedAtSeconds,executeRemainingMs,
 postWaitReserveMs,waitForOriginalExpiry,refreshOwners,readWallSeconds,mark=()=>{}
}={}){
 assert.equal(typeof waitForOriginalExpiry,'function');
 assert.equal(typeof refreshOwners,'function');
 assert.equal(typeof readWallSeconds,'function');
 assert.ok(Number.isSafeInteger(postWaitReserveMs)&&postWaitReserveMs>0,
  'reserve time for refresh, seed and seven H2 requests');
 // This execute budget is already net of cleanup/verify. Subtract only
 // the work after waiting, never cleanup/verify a second time.
 mark('BUDGET');
 const budget=checkIsolatedGoTrueTtl({
  env:gotrueEnv,executeRemainingMs,setupReserveMs:postWaitReserveMs
 });
 if(budget.status!=='TTL_BUDGET_FEASIBLE_NOT_REALTIME_PROOF')
  return Object.freeze({status:'BLOCKED_ORIGINAL_JWT_BUDGET_NOT_RUN',
   attempted:false,realElapsedTimeVerified:false,g4Verified:false});
 mark('RECEIPT');
 const receipt=captureGoTrueH1Receipt({
  h1:originalH1,observedAtSeconds
 });
 assertGoTrueIssuedTtl({
  token:receipt.privateOriginalJwt,observedAtSeconds
 });
 // The wait callback must be a separately reviewed real-clock bridge; the
 // claims-only output is never treated as evidence of actual elapsed time.
 mark('WAIT');
 const waited=await waitForOriginalExpiry({receipt});
 if(waited?.status==='BLOCKED_EXPIRY_EXCEEDS_BUDGET')
  return Object.freeze({status:'BLOCKED_ORIGINAL_JWT_WAIT_NOT_RUN',
   attempted:false,realElapsedTimeVerified:false,g4Verified:false});
 mark('WAIT_CHECK');
 assert.equal(waited?.status,
  'ORIGINAL_JWT_RELEASED_AFTER_INJECTED_CLOCKS_NOT_G4_PROOF');
 assert.equal(waited?.privateExpiredJwt,receipt.privateOriginalJwt,
  'expiry must return the unchanged H1 access token');
 assert.equal(waited.g4Verified,false);
 const afterWaitSeconds=readWallSeconds();
 assert.ok(Number.isSafeInteger(afterWaitSeconds)&&
  afterWaitSeconds>receipt.expiresAtSeconds,
  'original JWT is not strictly expired on current wall clock');
 // Only after expiration, ask the caller to issue NEW GoTrue signin requests
 // for both original identities; never reuse the expired owner tokens.
 mark('REFRESH');
 const refreshedH1=await refreshOwners();
 mark('HANDOFF');
 const afterRefreshSeconds=readWallSeconds();
 assert.ok(Number.isSafeInteger(afterRefreshSeconds)&&
  afterRefreshSeconds>=afterWaitSeconds,
  'wall clock regression while refreshing owners');
 const handoff=prepareRefreshedH2Sessions({
  originalH1,refreshedH1,
  expiredOriginalJwt:receipt.privateOriginalJwt,
  nowSeconds:afterRefreshSeconds
 });
 assert.equal(handoff.g4Verified,false);
 const safe={status:'ORIGINAL_GOTRUE_H2_HANDOFF_CLAIMS_ONLY_NOT_G4_PROOF',
  originalTokenPreserved:true,ownerIdentitiesPreserved:true,
  signatureVerified:false,realElapsedTimeVerified:false,
  h2Verified:false,g4Verified:false};
 Object.defineProperties(safe,{
  privateRefreshedH1:{value:refreshedH1,enumerable:false},
  privateExpiredOriginalJwt:{value:handoff.privateExpiredOriginalJwt,
   enumerable:false}
 });
 return Object.freeze(safe);
}
module.exports={prepareOriginalJwtH2};
