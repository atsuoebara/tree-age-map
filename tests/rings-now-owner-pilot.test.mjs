import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createOwnerPilotHandler} from '../supabase/functions/rings-now-owner-pilot/contract.mjs';
const owner='12345678-1234-1234-1234-123456789abc';
const valid={enabled:true,ownerId:owner,expiresAtMs:2000,nowMs:()=>1000,getUser:async()=>({id:owner,is_anonymous:false})};
const request=(headers={},body='{"protocol":"rings-now-review-v1","build":"v1"}')=>new Request('https://example.invalid',{method:'POST',headers:{origin:'https://runnersrings.com',authorization:'Bearer a.b.c','content-type':'application/json',...headers},body});
test('only authenticated allowlisted owner within trial receives positive control',async()=>{
 const r=await createOwnerPilotHandler(valid)(request());
 assert.equal(r.status,200);assert.equal((await r.json()).enabled,true);
});
test('defaults, other owner, anonymous, expired, unverifiable and wrong origin deny',async()=>{
 for(const opts of [{},{enabled:false},{ownerId:''},{expiresAtMs:1000},{getUser:async()=>({id:'other',is_anonymous:false})},{getUser:async()=>({id:owner,is_anonymous:true})},{getUser:async()=>{throw Error()} }]){
 const h=createOwnerPilotHandler(Object.keys(opts).length?{...valid,...opts}:{});assert.equal((await (await h(request())).json()).enabled,false);
 }
 for(const req of [request({origin:'https://evil.invalid'}),request({authorization:''}),request({},'{"fit":"x"}')])assert.equal((await (await createOwnerPilotHandler(valid)(req)).json()).enabled,false);
});
test('expiry during authentication denies',async()=>{
 let now=1000;const h=createOwnerPilotHandler({...valid,nowMs:()=>now,getUser:async()=>{now=2000;return {id:owner,is_anonymous:false}}});
 assert.equal((await (await h(request())).json()).enabled,false);
});
