import {strict as assert} from 'node:assert';
import {observeSyntheticCompleteness as observe} from './atlas-a-observed-evidence.mjs';
const ctx=()=>({epoch:11,sessionValidated:true,ownerBound:true,readOnly:true,
 revision:'SYNTH_REV',noConcurrentWrites:true,bfcacheRevalidated:true});
function fixture(){
 const events=[];
 return {pageSize:2,expectedOwnerEpoch:11,
  requestedScopes:[{kind:'all'},{kind:'year',year:2026},{kind:'month',year:2026,month:11}],
  ports:{
   getContext:async()=>{events.push('context');return ctx();},
   readPage:async({offset,limit})=>{events.push('page:'+offset);return [
    [{id:'synthetic-1'},{id:'synthetic-2'}],[{id:'synthetic-3'}]
   ][offset/limit] || [];},
   readLocal:async()=>{events.push('local');return {rows:[{id:'synthetic-L'}],
    enumerationComplete:true,parsingComplete:true,noErrors:true};},
   computeScope:async({key,cloud,local})=>{events.push('scope:'+key);
    return {complete:true,sourceCount:cloud.length+local.length,producedCount:3};}
  },events};
}
const clean=fixture(),out=await observe(clean);
assert.equal(out.cloudRows,3);assert.equal(out.scopeCount,3);
assert.equal(clean.events.join('|'),'context|page:0|page:2|local|scope:all|scope:y:2026|scope:m:2026-11|context');
assert(!JSON.stringify(out).includes('synthetic-1'));
let negatives=0;
async function block(label,alter) {
 const f=fixture();alter(f);
 await assert.rejects(()=>observe(f),/BLOCKED/,label);negatives++;
}
await block('missing last page',f=>f.ports.readPage=async()=>{throw Error('blocked network');}); // throws original
await block('duplicate identifiers',f=>f.ports.readPage=async({offset})=>offset===0?[{id:'dup'},{id:'dup'}]:[]);
await block('page over limit',f=>f.ports.readPage=async()=>[{id:'1'},{id:'2'},{id:'3'}]);
await block('wrong owner epoch',f=>f.ports.getContext=async()=>({...ctx(),epoch:12}));
await block('initial owner unverified',f=>f.ports.getContext=async()=>({...ctx(),ownerBound:false}));
await block('read only false',f=>f.ports.getContext=async()=>({...ctx(),readOnly:false}));
await block('local parsing failed',f=>f.ports.readLocal=async()=>({rows:[],enumerationComplete:true,parsingComplete:false,noErrors:true}));
await block('scope incomplete',f=>f.ports.computeScope=async()=>({complete:false,sourceCount:0,producedCount:0}));
await block('duplicate scope',f=>f.requestedScopes.push({kind:'all'}));
await block('missing all',f=>f.requestedScopes.shift());
await block('invalid month',f=>f.requestedScopes[2].month=13);
await block('final revision change',f=>{let i=0;f.ports.getContext=async()=>({...ctx(),revision:++i===1?'SYNTH_REV':'CHANGED'});});
await block('final concurrent write',f=>{let i=0;f.ports.getContext=async()=>({...ctx(),noConcurrentWrites:++i===1?true:false});});
await block('bfcache unverified',f=>{let i=0;f.ports.getContext=async()=>({...ctx(),bfcacheRevalidated:++i===1?true:false});});
console.log('PASS synthetic observed page returns, 3 scopes, '+negatives+' negative controls');
