'use strict';
// Local-only unit tests of pure assertions. Uses fake JWT payloads, NOT real Auth proof.
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('./rings-now-p2-auth-http-assertions.cjs');
const token = claims => 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.c2ln';
const claims = {sub:'synthetic-user-a',role:'authenticated',aud:'authenticated',exp:100};
const row = {id:'r1',user_id:'synthetic-user-a',activity_date:'2026-11-16',distance_km:5,started_at:'2026-11-16T10:00:00.123456Z',deleted_at:null};
test('JWT claims parsing is only structural, not cryptographic', () => {
  assert.deepEqual(p.assertJwtClaims(token(claims),claims),claims);
  assert.throws(()=>p.assertJwtClaims(token({...claims,sub:'other'}),claims));
  assert.throws(()=>p.assertJwtClaims('invalid',claims));
});
test('owner rows accepted; cross-owner and invalid row blocked by assertion',()=>{
  p.assertNoOtherOwnerRows({status:'candidate_snapshot',rows:[row]},claims.sub);
  assert.throws(()=>p.assertNoOtherOwnerRows({status:'candidate_snapshot',rows:[{...row,user_id:'synthetic-user-b'}]},claims.sub));
  assert.throws(()=>p.assertNoOtherOwnerRows({status:'candidate_snapshot',rows:[{...row,started_at:null}]},claims.sub));
  assert.throws(()=>p.assertNoOtherOwnerRows({status:'candidate_snapshot',rows:[{...row,extra:1}]},claims.sub));
});
test('blocked response reason and rows exclusion',()=>{
  p.assertBlocked({status:'blocked',reason:'too_many_rows'},'too_many_rows');
  assert.throws(()=>p.assertBlocked({status:'blocked',reason:'too_many_rows',rows:[]},'too_many_rows'));
});
test('expired claims and HTTP rejection must both be observed separately',()=>{
  p.assertExpired(claims,100);
  p.assertHttpRejected({status:401});
  assert.throws(()=>p.assertExpired(claims,99));
  assert.throws(()=>p.assertHttpRejected({status:200}));
});

test('atomic expiry-and-rejection assertion rejects incomplete observations',()=>{
  const observation = {token:token(claims),nowSeconds:100,response:{status:401}};
  assert.equal(p.assertExpiredTokenRejected(observation),true);
  for (const key of ['token','nowSeconds','response']) {
    const missing = {...observation};
    delete missing[key];
    assert.throws(()=>p.assertExpiredTokenRejected(missing),key+' omitted');
  }
  assert.throws(()=>p.assertExpiredTokenRejected({...observation,nowSeconds:99}));
  assert.throws(()=>p.assertExpiredTokenRejected({...observation,response:{status:200}}));
  assert.throws(()=>p.assertExpiredTokenRejected({...observation,response:{status:'401'}}));
  assert.throws(()=>p.assertExpiredTokenRejected({...observation,token:token({...claims,exp:101})}));
});
