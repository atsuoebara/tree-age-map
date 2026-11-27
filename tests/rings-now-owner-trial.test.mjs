import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handleOwnerTrial} from '../supabase/functions/rings-now-owner-trial/contract.mjs';
import {createOwnerTrialRequest} from '../src/rings-now-owner-trial-client.mjs';
const ownerId='12345678-1234-1234-1234-123456789abc',origin='https://runnersrings.com';
const cfg={ownerId,enabled:'true',startsAt:100,expiresAt:200,now:150,verifyUser:async token=>token==='valid'?{id:ownerId}:token==='other'?{id:'other'}:null};
const call=(token='valid',config=cfg,extra={})=>handleOwnerTrial(new Request('https://example.invalid',{method:'POST',headers:{origin,authorization:'Bearer '+token},...extra}),config);
test('only verified owner in explicit short trial gets permission',async()=>{
 assert.equal((await (await call()).json()).enabled,true);
 for(const [token,config] of [['other',cfg],['invalid',cfg],['valid',{...cfg,enabled:false}],['valid',{...cfg,ownerId:null}],['valid',{...cfg,now:99}],['valid',{...cfg,now:200}],['valid',{...cfg,expiresAt:999999999}],['valid',{...cfg,verifyUser:async()=>{throw Error()}}]]){
  assert.equal((await (await call(token,config)).json()).enabled,false);
 }
});
test('wrong origin, anonymous request, wrong method, body and invalid preflight deny',async()=>{
 for(const extra of [{headers:{origin:'https://evil.invalid',authorization:'Bearer valid'}},{headers:{origin}},{method:'GET'},{body:'{}'},{method:'OPTIONS',headers:{origin,'access-control-request-method':'POST','access-control-request-headers':'x-other'}}]){
  const r=await call('valid',cfg,extra);assert.equal((await r.json()).enabled,false);
 }
 const r=await call('valid',cfg,{method:'OPTIONS',headers:{origin,'access-control-request-method':'POST','access-control-request-headers':'authorization'}});
 assert.equal(r.status,204);
});
test('parent transport is disabled by default and sends only bearer to fixed endpoint',async()=>{
 let calls=0;
 const fetchImpl=async(url,opts)=>{calls++;assert.equal(opts.body,undefined);assert.equal(opts.credentials,'omit');assert.deepEqual(opts.headers,{authorization:'Bearer valid'});const r=await call();Object.defineProperty(r,'url',{value:url});return r};
 const readSession=async()=>({access_token:'valid'});
 assert.equal(await createOwnerTrialRequest({readSession,fetchImpl})(),null);assert.equal(calls,0);
 assert.equal((await createOwnerTrialRequest({enabled:true,readSession,fetchImpl})()).enabled,true);assert.equal(calls,1);
});
test('public and private trial remain OFF; no token passed to frame',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 const html=read('index.html'),child=read('src/rings-now-fit-frame.mjs'),host=read('src/rings-now-fit-screen-host.mjs');
 for(const name of ['RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED','RR_RINGS_NOW_REAL_FIT_READ_ENABLED','RR_RINGS_NOW_OWNER_TRIAL_ENABLED'])assert.ok(html.includes('const '+name+'=false;'));
 assert.ok(html.includes('const RR_RINGS_NOW_OWNER_TRIAL_STARTED_AT_MS=null;'));
 assert.ok(child.includes('const OWNER_TRIAL_SCREEN_ENABLED=false;'));
 assert.doesNotMatch(host,/access_token|authorization:/);
});
