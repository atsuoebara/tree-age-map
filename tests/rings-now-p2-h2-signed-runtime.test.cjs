'use strict';
// Pure offline runtime checks: temporary files only; no Docker, SQL or network.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {createHmac}=require('node:crypto');
const {createEphemeralP2Runtime}=require('./rings-now-p2-ephemeral-service-runtime.cjs');
const {claimsOf}=require('./rings-now-p2-h2-postgrest-http.cjs');
const A='12345678-1234-4234-8234-123456789abc';
function verifySignature(token,secret){
 const parts=token.split('.');
 const expected=createHmac('sha256',secret).update(parts[0]+'.'+parts[1]).digest('base64url');
 assert.equal(parts[2],expected);
}
test('isolated signed tokens are restricted, correctly timed and not GoTrue-issued',()=>{
 const runtime=createEphemeralP2Runtime();
 const dir=runtime.h1EphemeralDir;
 try{
  const env=fs.readFileSync(runtime.envFiles.gotrue,'utf8');
  const secret=env.match(/^GOTRUE_JWT_SECRET=([a-f0-9]+)$/m)?.[1];
  assert.match(secret,/^[a-f0-9]{96}$/);
  const nowSeconds=2000000000;
  const expired=runtime.issueH2SignedTestToken({
   subject:A,role:'authenticated',nowSeconds,expired:true
  });
  const denied=runtime.issueH2SignedTestToken({
   subject:A,role:'p2_h2_no_rpc',nowSeconds,expired:false
  });
  verifySignature(expired,secret);verifySignature(denied,secret);
  assert.equal(claimsOf(expired).exp,nowSeconds-60);
  assert.equal(claimsOf(denied).exp,nowSeconds+3600);
  assert.equal(claimsOf(denied).role,'p2_h2_no_rpc');
  assert.ok(!JSON.stringify(runtime).includes(secret));
  assert.ok(!JSON.stringify(runtime).includes(expired));
  assert.ok(!JSON.stringify(runtime).includes(denied));
 }finally{
  runtime.dispose();
  assert.equal(fs.existsSync(dir),false);
 }
});
test('runtime H2 signer fails closed on invalid identity, role and expiry mode',()=>{
 const runtime=createEphemeralP2Runtime();
 try{
  const nowSeconds=2000000000;
  for(const spec of [
   {subject:'evil',role:'authenticated',nowSeconds,expired:true},
   {subject:A,role:'service_role',nowSeconds,expired:true},
   {subject:A,role:'authenticated',nowSeconds,expired:false},
   {subject:A,role:'p2_h2_no_rpc',nowSeconds,expired:true},
   {subject:A,role:'p2_h2_no_rpc',nowSeconds:0,expired:false}
  ])assert.throws(()=>runtime.issueH2SignedTestToken(spec));
 }finally{runtime.dispose();}
 assert.throws(()=>runtime.issueH2SignedTestToken({
  subject:A,role:'authenticated',nowSeconds:2000000000,expired:true
 }));
});
