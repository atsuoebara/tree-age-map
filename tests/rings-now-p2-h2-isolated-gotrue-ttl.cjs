'use strict';
// DORMANT pure policy; cannot authorize Docker or prove JWT behavior.
const assert=require('node:assert/strict');
const JWT_TTL_SECONDS=300;
const STRICT_EXPIRY_MARGIN_SECONDS=1;
const MAX_WAIT_MS=540000;
function checkIsolatedGoTrueTtl({env,executeRemainingMs,setupReserveMs=0}={}){
 assert.ok(env&&typeof env==='object');
 assert.equal(env.GOTRUE_JWT_EXP,String(JWT_TTL_SECONDS),
  'GoTrue TTL must be exactly 300 seconds in disposable environment');
 assert.equal(env.GOTRUE_JWT_AUD,'authenticated');
 assert.ok(Number.isSafeInteger(executeRemainingMs)&&executeRemainingMs>=0);
 assert.ok(Number.isSafeInteger(setupReserveMs)&&setupReserveMs>=0);
 const requiredMs=(JWT_TTL_SECONDS+STRICT_EXPIRY_MARGIN_SECONDS)*1000;
 const usableMs=Math.max(0,executeRemainingMs-setupReserveMs);
 // The parent coordinator already deducted cleanup/verification reserve
 // from the execute budget. Do not subtract it a second time.
 const permittedMs=Math.min(MAX_WAIT_MS,usableMs);
 return Object.freeze({status:requiredMs<=permittedMs
  ?'TTL_BUDGET_FEASIBLE_NOT_REALTIME_PROOF':'BLOCKED_TTL_EXCEEDS_EXECUTE_BUDGET',
  jwtTtlSeconds:JWT_TTL_SECONDS,requiredMs,permittedMs,
  cleanupAlreadyReservedByParent:true,
  actualGoTrueIssuanceVerified:false,realElapsedTimeVerified:false,g4Verified:false});
}
function assertGoTrueIssuedTtl({token,observedAtSeconds}={}){
 // Shape/time only; not a signature nor GoTrue server configuration proof.
 const {claimsOf}=require('./rings-now-p2-h2-postgrest-http.cjs');
 const c=claimsOf(token);
 assert.ok(Number.isSafeInteger(c.iat)&&Number.isSafeInteger(c.exp));
 assert.equal(c.exp-c.iat,JWT_TTL_SECONDS,'issued TTL mismatch');
 assert.ok(Number.isSafeInteger(observedAtSeconds)&&
  observedAtSeconds>=c.iat&&observedAtSeconds<c.exp,'H1 token not live');
 return Object.freeze({status:'JWT_TTL_CLAIMS_MATCH_NOT_G4_PROOF',
  ttlSeconds:JWT_TTL_SECONDS,signatureVerified:false,g4Verified:false});
}
module.exports={JWT_TTL_SECONDS,STRICT_EXPIRY_MARGIN_SECONDS,
 checkIsolatedGoTrueTtl,assertGoTrueIssuedTtl};
