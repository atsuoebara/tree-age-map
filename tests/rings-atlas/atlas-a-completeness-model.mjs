// Atlas G3 pre-gate: synthetic event evidence collector, not a credential verifier.
// No browser, storage, networking, GPS, source activity rows, or live auth imports.
const fail = why => { throw Error('Atlas evidence BLOCKED: '+why); };
const positive = x => Number.isSafeInteger(x)&&x>=0;
const canonical = kind => ['all','year','month'].includes(kind);
export function createSyntheticCompletenessCollector(config) {
 if(!config||!positive(config.epoch)||!positive(config.pageSize)||config.pageSize<1||
    config.pageSize>500||!positive(config.expectedScopes)||config.expectedScopes<1)
   fail('invalid construction');
 let phase='init',expectedOffset=0,seenRows=0,terminal=false,local=false,
     compiled=false,verified=false,revAtStart=null,revAtEnd=null,ownerEpoch=config.epoch,
     scopes=new Set(),fault=false;
 function guard(){if(fault)fail('poisoned');}
 function event(e){
  guard();
  if(!e||typeof e!=='object'||Array.isArray(e)||typeof e.kind!=='string')fail('invalid event');
  if(e.epoch!==ownerEpoch){fault=true;fail('owner or session epoch changed');}
  switch(e.kind){
   case 'begin':
    if(phase!=='init'||typeof e.revision!=='string'||!e.revision||e.revision.length>128)fail('bad begin');
    revAtStart=e.revision;phase='paging';break;
   case 'page':
    if(phase!=='paging'||terminal||!positive(e.offset)||e.offset!==expectedOffset||
      !positive(e.count)||e.count>config.pageSize||e.success!==true){
      fault=true;fail('page incomplete, skipped, duplicated or failed');
    }
    seenRows+=e.count;expectedOffset+=e.count;
    if(e.count<config.pageSize)terminal=true;
    break;
   case 'local':
    if(phase!=='paging'||!terminal||e.enumerationComplete!==true||
       e.parsingComplete!==true||e.noErrors!==true){
      fault=true;fail('local enumeration/parsing incomplete');
    }
    local=true;phase='scopes';break;
   case 'scope':
    if(phase!=='scopes'||!local||!canonical(e.type)||e.complete!==true||
      !positive(e.sourceCount)||e.sourceCount>seenRows+e.localCount||
      !positive(e.localCount)||!positive(e.producedCount)){
      fault=true;fail('invalid or partial scope computation');
    }
    if(e.type==='all'&&(e.year!==undefined||e.month!==undefined))fail('invalid all scope');
    if(e.type!=='all'&&(!Number.isInteger(e.year)||e.year<2000||e.year>2100))fail('invalid year');
    if(e.type==='year'&&e.month!==undefined)fail('invalid year scope');
    if(e.type==='month'&&(!Number.isInteger(e.month)||e.month<1||e.month>12))fail('invalid month');
    const key=e.type==='all'?'all':e.type==='year'?'y:'+e.year:'m:'+e.year+'-'+String(e.month).padStart(2,'0');
    if(scopes.has(key)){fault=true;fail('duplicate scope');}
    scopes.add(key);break;
   case 'finish':
    if(phase!=='scopes'||!terminal||!local||!scopes.has('all')||
      scopes.size!==config.expectedScopes||typeof e.revision!=='string'||
      e.revision!==revAtStart||e.ownerStillSame!==true||e.authRevalidated!==true||
      e.bfcacheRevalidated!==true||e.noConcurrentWrites!==true||e.noErrors!==true){
      fault=true;fail('incomplete or stale evidence');
    }
    revAtEnd=e.revision;verified=true;phase='complete';break;
   case 'abort':
   case 'signout':
   case 'accountSwitch':
   case 'bfcache':
   case 'mutation':
    fault=true;phase='blocked';break;
   default: fail('unknown event');
  }
 }
 function outcome(){
  // Return no owner, route, names, source revision, or geographical data.
  return Object.freeze({state:verified&&!fault?'MODEL_PASS':'BLOCKED',
    pageCountComplete:terminal&&verified&&!fault,cloudRows:verified&&!fault?seenRows:null,
    scopes:verified&&!fault?scopes.size:0,
    note:'Synthetic model only; caller assertions are NOT real authentication/completeness proof'});
 }
 return Object.freeze({event,outcome});
}
