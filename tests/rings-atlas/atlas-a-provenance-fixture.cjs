#!/usr/bin/env node
'use strict';
// Atlas provenance T01-T13: synthetic snapshots only. No real network/auth/data.
const assert=require('node:assert/strict');
function blocked(message){throw new Error('BLOCKED: '+message);}
function validate(x){
 if(!x||!x.start||!x.end||!Array.isArray(x.pages))blocked('input missing');
 const a=x.start,b=x.end;
 for(const c of [a,b]){
  if(c.auth!==true||c.owner!=='fixture-owner'||c.epoch!==7||c.readOnly!==true||c.bfcacheOk!==true||
   c.revision!=='r1'||c.geoRevision!=='g1')blocked('owner/version/geography changed');
 }
 if(x.httpOk!==true||x.localComplete!==true||x.noConcurrentWrites!==true)blocked('source incomplete');
 if(!x.consistencyTokenValidated||x.consistencyTokenValidated!==true)blocked('no proven common snapshot');
 let offset=0,terminal=false,ids=new Set(),rows=[];
 for(const p of x.pages){
  if(terminal||!p||p.offset!==offset||p.httpOk!==true||!Array.isArray(p.rows)||
   p.rows.length>x.pageSize)blocked('invalid paging');
  for(const row of p.rows){
   if(!row||typeof row.id!=='string'||ids.has(row.id)||
    row.version!=='r1'||row.geoRevision!=='g1')blocked('row inconsistent');
   ids.add(row.id);rows.push(row);
  }
  offset+=p.rows.length;
  if(p.rows.length<x.pageSize)terminal=true;
 }
 if(!terminal)blocked('missing terminal page');
 if(!Array.isArray(x.scopes)||!x.scopes.includes('all')||
  x.scopes.length!==new Set(x.scopes).size||x.scopes.length!==x.expectedScopeCount||
  x.scopes.some(p=>!/^all$|^y:20\d{2}$|^m:20\d{2}-(0[1-9]|1[0-2])$/.test(p)))blocked('scopes incomplete');
 return {state:'MODEL_PASS',syntheticRows:rows.length,syntheticScopes:x.scopes.length};
}
const mk=()=>({start:{auth:true,owner:'fixture-owner',epoch:7,readOnly:true,bfcacheOk:true,revision:'r1',geoRevision:'g1'},
end:{auth:true,owner:'fixture-owner',epoch:7,readOnly:true,bfcacheOk:true,revision:'r1',geoRevision:'g1'},
pageSize:2,pages:[{offset:0,httpOk:true,rows:[{id:'a',version:'r1',geoRevision:'g1'},{id:'b',version:'r1',geoRevision:'g1'}]},
{offset:2,httpOk:true,rows:[{id:'c',version:'r1',geoRevision:'g1'}]}],
httpOk:true,localComplete:true,noConcurrentWrites:true,consistencyTokenValidated:true,
scopes:['all','y:2026','m:2026-11'],expectedScopeCount:3});
const good=validate(mk());assert.equal(good.syntheticRows,3);
const scenarios=[
 ['full page missing terminal',v=>v.pages.pop()],
 ['page skipped',v=>v.pages[1].offset=4],
 ['duplicate ID',v=>v.pages[1].rows[0].id='a'],
 ['HTTP 403',v=>v.pages[0].httpOk=false],
 ['owner change',v=>v.end.owner='other'],
 ['session epoch change',v=>v.end.epoch=8],
 ['auth lost',v=>v.end.auth=false],
 ['bfcache revalidation missing',v=>v.end.bfcacheOk=false],
 ['local incomplete',v=>v.localComplete=false],
 ['scope missing',v=>v.scopes.pop()],
 ['same-count swapped row without common revision',v=>{v.pages[1].rows[0].id='new-c';v.consistencyTokenValidated=false;}],
 ['same-count row-content update',v=>v.pages[1].rows[0].version='r2'],
 ['geographic boundary version changed halfway',v=>v.pages[1].rows[0].geoRevision='g2'],
 ['geographic version changed before finish',v=>v.end.geoRevision='g2'],
 ['unproven consistency token',v=>v.consistencyTokenValidated=false],
 ['concurrent writes',v=>v.noConcurrentWrites=false]
];
for(const [name,mutate] of scenarios){
 const fixture=mk();mutate(fixture);
 assert.throws(()=>validate(fixture),/BLOCKED/,name);
}
assert(!JSON.stringify(good).includes('fixture-owner'));
console.log(JSON.stringify({status:'PASS',syntheticRuns:good.syntheticRows,
negativeScenarios:scenarios.length,scopeCount:good.syntheticScopes,
warning:'Proof flags and row version are synthetic input. No real consistency/auth guarantee.'},null,2));
