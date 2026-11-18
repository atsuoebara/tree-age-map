'use strict';
// Dormant, offline-only refresh handoff. No network, timers, Docker or SQL.
// The caller must independently attest original GoTrue provenance and actual
// elapsed expiry; JWT claim parsing here does NOT prove a signature.
const assert=require('node:assert/strict');
const {claimsOf}=require('./rings-now-p2-h2-postgrest-http.cjs');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateOwnerSessions(h1,nowSeconds){
 assert.ok(h1&&h1.h1Verified===false&&h1.privateTokens&&h1.privateIds,
  'complete H1 private owner sessions required');
 assert.ok(Number.isSafeInteger(nowSeconds)&&nowSeconds>0,'time required');
 const ids=h1.privateIds,tokens=h1.privateTokens;
 assert.match(ids.a||'',UUID);assert.match(ids.b||'',UUID);
 assert.notEqual(ids.a,ids.b,'owner sessions must remain distinct');
 for(const who of ['a','b']){
  const c=claimsOf(tokens[who]);
  assert.equal(c.sub,ids[who]);assert.equal(c.role,'authenticated');
  assert.equal(c.aud,'authenticated');
  assert.ok(Number.isSafeInteger(c.exp)&&Number.isSafeInteger(c.iat));
  assert.ok(c.iat<=nowSeconds&&c.exp>nowSeconds,'fresh owner token must be live');
 }
 return {ids,tokens};
}

function prepareRefreshedH2Sessions({
 originalH1,refreshedH1,expiredOriginalJwt,nowSeconds
}={}){
 const original=validateOriginalIds(originalH1);
 const fresh=validateOwnerSessions(refreshedH1,nowSeconds);
 assert.equal(fresh.ids.a,original.a,'refreshed A identity changed');
 assert.equal(fresh.ids.b,original.b,'refreshed B identity changed');
 const old=originalH1.privateTokens.a;
 assert.equal(expiredOriginalJwt,old,'original JWT bytes must not change');
 const c=claimsOf(expiredOriginalJwt);
 assert.equal(c.sub,original.a);assert.equal(c.role,'authenticated');
 assert.equal(c.aud,'authenticated');
 assert.ok(Number.isSafeInteger(c.exp)&&c.exp<nowSeconds,
  'original token must be strictly expired');
 assert.notEqual(fresh.tokens.a,expiredOriginalJwt,'A login must be refreshed');
 const report={status:'H2_REFRESHED_OWNERS_CLAIMS_ONLY_NOT_G4_PROOF',
  originalTokenPreserved:true,identityPreserved:true,
  originalGoTrueSignatureVerified:false,realElapsedTimeVerified:false,g4Verified:false};
 Object.defineProperties(report,{
  privateTokens:{value:Object.freeze({a:fresh.tokens.a,b:fresh.tokens.b}),enumerable:false},
  privateIds:{value:Object.freeze({a:fresh.ids.a,b:fresh.ids.b}),enumerable:false},
  privateExpiredOriginalJwt:{value:expiredOriginalJwt,enumerable:false}
 });
 return Object.freeze(report);
}

function validateOriginalIds(h1){
 assert.ok(h1&&h1.h1Verified===false&&h1.privateIds&&h1.privateTokens);
 assert.match(h1.privateIds.a||'',UUID);assert.match(h1.privateIds.b||'',UUID);
 assert.notEqual(h1.privateIds.a,h1.privateIds.b);
 const old=claimsOf(h1.privateTokens.a);
 assert.equal(old.sub,h1.privateIds.a);
 return h1.privateIds;
}
module.exports={validateOwnerSessions,prepareRefreshedH2Sessions};
