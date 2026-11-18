'use strict';
// Dormant H2 orchestration. No I/O, SQL, Docker, HTTP or timers on import.
const assert=require('node:assert/strict');
const {CASES,claimsOf,buildH2Request,checkH2Response,summarizeH2Observations}=require('./rings-now-p2-h2-postgrest-http.cjs');
const {buildH2IsolatedSeedSql}=require('./rings-now-p2-h2-isolated-seed-sql.cjs');
function validateH1(h1,nowSeconds){
 assert.ok(h1&&h1.h1Verified===false&&h1.privateTokens&&h1.privateIds);
 assert.ok(Number.isSafeInteger(nowSeconds)&&nowSeconds>0);
 const {a:ownerA,b:ownerB}=h1.privateTokens;
 const {a:idA,b:idB}=h1.privateIds;
 const a=claimsOf(ownerA),b=claimsOf(ownerB);
 assert.equal(a.sub,idA);assert.equal(b.sub,idB);
 assert.equal(a.role,'authenticated');assert.equal(b.role,'authenticated');
 assert.ok(a.exp>nowSeconds&&b.exp>nowSeconds,'live H1 tokens required');
 const seedSql=buildH2IsolatedSeedSql({ownerA:idA,ownerB:idB});
 return {ownerA,ownerB,idA,idB,seedSql};
}
async function collectH2OverTransport({h1,nowSeconds,readNowSeconds,seedDisposableSql,provideExpiredToken,provideDeniedToken,transport}={}){
 for(const fn of [seedDisposableSql,provideExpiredToken,provideDeniedToken,transport])
  assert.equal(typeof fn,'function','missing H2 prerequisite callback');
 const h=validateH1(h1,nowSeconds);
 // Caller must independently check run ownership and actual A/B rows.
 const seed=await seedDisposableSql({sql:h.seedSql,ownerA:h.idA,ownerB:h.idB});
 assert.equal(seed?.status,'ISOLATED_TWO_OWNERS_CLI_REPORTED','seed prerequisite absent');
 // Tokens are provided by audited future mechanisms; never forge expiry.
 const expired=await provideExpiredToken({ownerA:h.idA});
 const denied=await provideDeniedToken({ownerA:h.idA,role:'p2_h2_no_rpc'});
 // Validate ALL prerequisite token claims BEFORE the first H2 transport.
 // These checks are shape/time gates, not proof of signature or issuance.
 const ec=claimsOf(expired);
 assert.equal(ec.sub,h.idA);
 assert.equal(ec.role,'authenticated');
 assert.ok(Number.isSafeInteger(ec.exp)&&ec.exp<nowSeconds,
  'provided expired JWT must already be past expiry');
 const dc=claimsOf(denied);
 assert.equal(dc.sub,h.idA);assert.equal(dc.role,'p2_h2_no_rpc');
 assert.ok(Number.isSafeInteger(dc.exp)&&dc.exp>nowSeconds,
  'dedicated no-grant JWT must remain valid');
 const options={ownerA:h.ownerA,ownerB:h.ownerB,expired,denied,nowSeconds};
 const observations=[];
 let lastNow=nowSeconds;
 for(const caseId of CASES){
  // Real runner supplies a fresh wall-clock value before every request.
  // Older offline contracts may omit the callback; they retain fixed-time
  // semantics and cannot be promoted to genuine expiry evidence.
  const current=readNowSeconds===undefined?nowSeconds:readNowSeconds();
  assert.ok(Number.isSafeInteger(current)&&current>=lastNow,
   'H2 clock regressed or became invalid');
  lastNow=current;
  if(readNowSeconds!==undefined){
   const ac=claimsOf(h.ownerA),bc=claimsOf(h.ownerB),dc=claimsOf(denied);
   assert.ok(ac.exp>current&&bc.exp>current&&dc.exp>current,
    'owner or negative-role token expired during H2');
   assert.ok(ec.exp<current,'original token is not expired');
  }
  const request=buildH2Request({caseId,...options,nowSeconds:current});
  const response=await transport({caseId,request});
  const subject=caseId==='h2_owner_b'?h.idB:h.idA;
  observations.push(checkH2Response(caseId,response,{subject,expectedRows:1}));
 }
 const summary=summarizeH2Observations(observations);
 assert.equal(summary.missingCases.length,0);
 return Object.freeze({
  status:'H2_SEVEN_CASES_CLI_REPORTED_NOT_G4_PROOF',
  summary,h1Verified:false,h2Verified:false,g4Verified:false
 });
}
module.exports={validateH1,collectH2OverTransport};
