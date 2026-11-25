'use strict';
// DORMANT runner integration. Never invokes Docker on import.
// Real backend remains blocked by the independent runner safety guard.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {performance}=require('node:perf_hooks');
const {buildGoTrueRequest,inspectGoTrueResponse}=
 require('./rings-now-p2-h1-gotrue-http.cjs');
const {prepareOriginalJwtH2}=require('./rings-now-p2-h2-original-jwt-stage.cjs');
const {waitForOriginalGoTrueJwtInExecuteStage}=
 require('./rings-now-p2-h2-real-clock-expiry-bridge.cjs');
const {collectH2OverTransport}=
 require('./rings-now-p2-h2-sequence.cjs');

const POST_WAIT_RESERVE_MS=60000;
function readDisposableGoTruePolicy(runtime){
 const file=runtime?.envFiles?.gotrue;
 assert.match(file||'',/^\/tmp\/rn-p2-[a-zA-Z0-9_-]{6,64}\/gotrue\.env$/);
 const st=fs.lstatSync(file);
 assert.ok(st.isFile()&&!st.isSymbolicLink()&&(st.mode&0o777)===0o600);
 const data=fs.readFileSync(file,'utf8');
 const values={};
 for(const line of data.trimEnd().split('\n')){
  const cut=line.indexOf('=');
  assert.ok(cut>0);
  const key=line.slice(0,cut);
  assert.ok(!Object.hasOwn(values,key),'no duplicate env keys');
  // Keep secret values local; only retain the two non-secret policy values.
  if(key==='GOTRUE_JWT_EXP'||key==='GOTRUE_JWT_AUD')
   values[key]=line.slice(cut+1);
 }
 return Object.freeze(values);
}
async function refreshOriginalOwners({users,transport,mark=()=>{}}={}){
 assert.ok(users?.a&&users?.b);
 assert.equal(typeof transport,'function');
 const tokens={},ids={};
 for(const who of ['a','b']){
  const caseId='h1_signin_'+who;
  mark('REQUEST',caseId);
  const request=buildGoTrueRequest(caseId,users);
  mark('TRANSPORT',caseId);
  const response=await transport({caseId,request});
  mark('RESPONSE',caseId,response?.status);
  const checked=inspectGoTrueResponse(caseId,response);
  assert.ok(checked.token&&checked.userId,'fresh signin required');
  tokens[who]=checked.token;ids[who]=checked.userId;
 }
 const fresh={h1Verified:false};
 Object.defineProperties(fresh,{
  privateTokens:{value:Object.freeze(tokens),enumerable:false},
  privateIds:{value:Object.freeze(ids),enumerable:false}
 });
 return Object.freeze(fresh);
}
async function runOriginalGoTrueH2Stage({
 h1,runtime,driver,runId,executeDeadlineMs,
 cleanupReserveMs,verifyReserveMs,mark=()=>{}
}={}){
 mark('PREPARE');
 assert.ok(Number.isFinite(executeDeadlineMs)&&executeDeadlineMs>performance.now());
 assert.ok(Number.isSafeInteger(cleanupReserveMs)&&cleanupReserveMs>0);
 assert.ok(Number.isSafeInteger(verifyReserveMs)&&verifyReserveMs>0&&
  verifyReserveMs<cleanupReserveMs);
 for(const key of ['probeInternalGoTrue','seedH2DisposableOwners','probeInternalH2'])
  assert.equal(typeof driver?.[key],'function');
 assert.equal(typeof runtime?.issueH2SignedTestToken,'function');
 const wall=()=>Math.floor(Date.now()/1000);
 const observedAtSeconds=wall();
 const executeRemainingMs=Math.max(0,
  Math.floor(executeDeadlineMs-performance.now()));
 mark('POLICY');
 const stage=await prepareOriginalJwtH2({
  mark,
  originalH1:h1,gotrueEnv:readDisposableGoTruePolicy(runtime),
  observedAtSeconds,executeRemainingMs,
  postWaitReserveMs:POST_WAIT_RESERVE_MS,readWallSeconds:wall,
  waitForOriginalExpiry:({receipt})=>
   waitForOriginalGoTrueJwtInExecuteStage({
    receipt,executeDeadlineMs:executeDeadlineMs-POST_WAIT_RESERVE_MS,
    cleanupReserveMs,verifyReserveMs
   }),
  refreshOwners:()=>refreshOriginalOwners({
   mark,users:runtime.h1Users,
   transport:({caseId,request})=>driver.probeInternalGoTrue({
    runId,caseId,request,ephemeralDir:runtime.h1EphemeralDir
   })
  })
 });
 if(stage.status.startsWith('BLOCKED_'))
  return Object.freeze({status:stage.status,g4Verified:false,blocked:true});
 assert.equal(stage.status,'ORIGINAL_GOTRUE_H2_HANDOFF_CLAIMS_ONLY_NOT_G4_PROOF');
 // The negative no-RPC role is a distinct isolated synthetic JWT.
 // The expired positive-role JWT is ALWAYS the unchanged GoTrue H1 token.
 const nowSeconds=wall();
 const result=await collectH2OverTransport({
  mark,
  h1:stage.privateRefreshedH1,nowSeconds,readNowSeconds:wall,
  seedDisposableSql:({sql,ownerA,ownerB})=>
   driver.seedH2DisposableOwners({runId,ownerA,ownerB,sql,
    ephemeralDir:runtime.h1EphemeralDir}),
  provideExpiredToken:()=>stage.privateExpiredOriginalJwt,
  provideDeniedToken:({ownerA})=>runtime.issueH2SignedTestToken({
   subject:ownerA,role:'p2_h2_no_rpc',nowSeconds:wall(),expired:false
  }),
  transport:({caseId,request})=>{
   assert.ok(performance.now()<executeDeadlineMs,
    'execute deadline exceeded before H2 transport');
   return driver.probeInternalH2({
    runId,caseId,request,ephemeralDir:runtime.h1EphemeralDir
   });
  }
 });
 mark('SUMMARY');
 assert.equal(result.g4Verified,false);
 assert.equal(result.h2Verified,false);
 assert.ok(performance.now()<=executeDeadlineMs,
  'H2 exceeded execute stage time budget');
 return Object.freeze({status:'ORIGINAL_GOTRUE_H2_SEVEN_CLI_REPORTED_NOT_G4_PROOF',
  count:result.summary.observations.length,g4Verified:false,h2Verified:false});
}
module.exports={readDisposableGoTruePolicy,refreshOriginalOwners,
 runOriginalGoTrueH2Stage,POST_WAIT_RESERVE_MS};
