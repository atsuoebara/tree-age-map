'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const {ORDER,buildGoTrueRequest,inspectGoTrueResponse,collectH1OverTransport}=
 require('./rings-now-p2-h1-gotrue-http.cjs');
const users={
 a:{email:'rn-p2-'+'1'.repeat(24)+'-a@example.invalid',password:'a'.repeat(64)},
 b:{email:'rn-p2-'+'2'.repeat(24)+'-b@example.invalid',password:'b'.repeat(64)}
};
const ids={a:'00000000-0000-4000-8000-000000000001',b:'00000000-0000-4000-8000-000000000002'};
function token(id){
 const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const header=enc({alg:'HS256',typ:'JWT'});
 const payload=enc({sub:id,role:'authenticated',aud:'authenticated',iat:1700000000,exp:1700000300});
 return header+'.'+payload+'.'+createHmac('sha256','OFFLINE_ONLY').update(header+'.'+payload).digest('base64url');
}
test('fixed internal GoTrue endpoints and synthetic invalid-domain identities only',()=>{
 for(const id of ORDER){
  const request=buildGoTrueRequest(id,users);
  assert.ok(request.startsWith('POST /signup HTTP/1.1')||
   request.startsWith('POST /token?grant_type=password HTTP/1.1'));
  assert.ok(request.includes('Host: gotrue:9999\r\n'));
  assert.ok(!request.includes('http://')&&!request.includes('https://'));
 }
 assert.throws(()=>buildGoTrueRequest('h1_any',users));
 assert.throws(()=>buildGoTrueRequest('h1_signup_a',{...users,a:{...users.a,email:'live@example.com'}}));
 assert.throws(()=>buildGoTrueRequest('h1_signin_b',{...users,b:{...users.b,password:'secret'}}));
 const bad=buildGoTrueRequest('h1_bad_password',users);
 assert.ok(bad.endsWith(JSON.stringify({email:users.a.email,password:'0'.repeat(64)})));
});
test('HTTP signins require matching user and JWT claims',()=>{
 const jwt=token(ids.a);
 const a=inspectGoTrueResponse('h1_signin_a',{status:200,body:{access_token:jwt,user:{id:ids.a}}});
 assert.equal(a.token,jwt);
 assert.equal(a.observation.tokenShape,'THREE_SEGMENTS');
 assert.equal(a.h1Verified,undefined);
 assert.throws(()=>inspectGoTrueResponse('h1_signin_a',{status:200,body:{access_token:jwt,user:{id:ids.b}}}));
 assert.throws(()=>inspectGoTrueResponse('h1_signin_a',{status:200,body:{access_token:'invalid',user:{id:ids.a}}}));
});
test('wrong password is not a success; status-only evidence never includes body',()=>{
 const r=inspectGoTrueResponse('h1_bad_password',{status:401,body:{email:users.a.email,token:token(ids.a)}});
 assert.equal(r.token,null);assert.equal(r.observation.httpStatus,401);
 assert.ok(!JSON.stringify(r.observation).includes(users.a.email));
 assert.throws(()=>inspectGoTrueResponse('h1_bad_password',{status:200}));
});
test('collects observations from transport responses in fixed case order',async()=>{
 const seen=[];
 const transport=async({caseId,request})=>{
  seen.push(caseId);
  assert.ok(request.includes('Host: gotrue:9999'));
  const who=caseId.endsWith('_b')?'b':'a';
  if(caseId==='h1_bad_password')return {status:400};
  if(caseId.startsWith('h1_signup'))return {status:200,body:{id:ids[who]}};
  return {status:200,body:{access_token:token(ids[who]),user:{id:ids[who]}}};
 };
 const r=await collectH1OverTransport({transport,users});
 assert.deepEqual(seen,ORDER);
 assert.equal(r.evidence.observations.length,5);
 assert.equal(r.evidence.h1Verified,false);assert.equal(r.h1Verified,false);
 assert.equal(r.privateIds.a,ids.a);assert.equal(r.privateIds.b,ids.b);
 // Even careless serialization of the entire internal return object or
 // individual successful response must not expose the private bearer token.
 assert.ok(!JSON.stringify(r).includes(token(ids.a)));
 assert.ok(!JSON.stringify(r).includes(users.a.email));
 const checked=inspectGoTrueResponse('h1_signin_a',{
  status:200,body:{access_token:token(ids.a),user:{id:ids.a}}
 });
 assert.ok(!JSON.stringify(checked).includes(token(ids.a)));
 const serialized=JSON.stringify(r.evidence);
 for(const secret of [users.a.email,users.a.password,token(ids.a)])assert.ok(!serialized.includes(secret));
});
test('missing user or failed transport cannot fabricate a complete report',async()=>{
 await assert.rejects(()=>collectH1OverTransport({transport:async()=>({status:200,body:{}}),users}));
 await assert.rejects(()=>collectH1OverTransport({transport:async()=>{throw Error('disconnected');},users}));
});
