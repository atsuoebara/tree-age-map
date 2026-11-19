#!/usr/bin/env node
import {strict as assert} from 'node:assert';
import {createSyntheticCompletenessCollector as create} from './atlas-a-completeness-model.mjs';
const epoch=7,revision='fixture-source-v1',pageSize=50;
const base={epoch,pageSize,expectedScopes:3};
function good(){
 const x=create(base),send=(kind,data={})=>x.event({kind,epoch,...data});
 send('begin',{revision});
 send('page',{offset:0,count:50,success:true});
 send('page',{offset:50,count:50,success:true});
 send('page',{offset:100,count:4,success:true}); // terminal <50
 send('local',{enumerationComplete:true,parsingComplete:true,noErrors:true});
 const counts={sourceCount:104,localCount:0,producedCount:104,complete:true};
 send('scope',{type:'all',...counts});
 send('scope',{type:'year',year:2026,...counts});
 send('scope',{type:'month',year:2026,month:11,...counts});
 send('finish',{revision,ownerStillSame:true,authRevalidated:true,
  bfcacheRevalidated:true,noConcurrentWrites:true,noErrors:true});
 return x;
}
const x=good();assert.equal(x.outcome().state,'MODEL_PASS');assert.equal(x.outcome().cloudRows,104);
let negatives=0;
function block(name,fn){
 assert.throws(fn,/BLOCKED/,name);negatives++;
}
block('epoch change',()=>{let x=create(base);x.event({kind:'begin',epoch,revision});x.event({kind:'page',epoch:99,offset:0,count:50,success:true});});
block('missing page',()=>{let x=create(base);x.event({kind:'begin',epoch,revision});x.event({kind:'page',epoch,offset:50,count:10,success:true});});
block('page failure',()=>{let x=create(base);x.event({kind:'begin',epoch,revision});x.event({kind:'page',epoch,offset:0,count:50,success:false});});
block('duplicate page',()=>{let x=create(base);x.event({kind:'begin',epoch,revision});x.event({kind:'page',epoch,offset:0,count:50,success:true});x.event({kind:'page',epoch,offset:0,count:10,success:true});});
block('local skipped',()=>{let x=create(base);x.event({kind:'begin',epoch,revision});x.event({kind:'local',epoch,enumerationComplete:true,parsingComplete:true,noErrors:true});});
block('local parse failed',()=>{let x=create(base);x.event({kind:'begin',epoch,revision});x.event({kind:'page',epoch,offset:0,count:0,success:true});x.event({kind:'local',epoch,enumerationComplete:true,parsingComplete:false,noErrors:true});});
block('duplicate scope',()=>{let x=create(base);x.event({kind:'begin',epoch,revision});x.event({kind:'page',epoch,offset:0,count:0,success:true});x.event({kind:'local',epoch,enumerationComplete:true,parsingComplete:true,noErrors:true});const p={kind:'scope',epoch,type:'all',complete:true,sourceCount:0,localCount:0,producedCount:0};x.event(p);x.event(p);});
block('unauthorized finish',()=>{let x=create(base);x.event({kind:'finish',epoch,revision,ownerStillSame:true,authRevalidated:true,bfcacheRevalidated:true,noConcurrentWrites:true,noErrors:true});});
block('bfcache',()=>{let x=create(base);x.event({kind:'bfcache',epoch});x.event({kind:'begin',epoch,revision});});
block('signout',()=>{let x=create(base);x.event({kind:'signout',epoch});x.event({kind:'begin',epoch,revision});});
block('unknown event',()=>{let x=create(base);x.event({kind:'skipSafety',epoch});});
assert(!JSON.stringify(good().outcome()).includes(revision));
console.log('PASS synthetic 104 rows, 3 scopes, '+negatives+' negative controls. No real data/credentials.');
