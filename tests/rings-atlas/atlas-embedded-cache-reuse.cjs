#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');

function extractFunction(source,name){
  const start=source.indexOf('function '+name+'(');
  assert(start>=0,'function exists: '+name);
  const open=source.indexOf('{',start);
  let depth=0;
  for(let i=open;i<source.length;i++){
    if(source[i]==='{')depth++;
    else if(source[i]==='}'){depth--;if(depth===0)return source.slice(start,i+1);}
  }
  throw new Error('unbalanced braces: '+name);
}

// 1. The skip predicate is decided only by the embedded marker that the
//    Atlas shell route sets on <html> before the app script runs.
const predicate=extractFunction(html,'shouldSkipBackgroundCloudRefresh');
function evaluate(embedded,savedAt){
  const classes=embedded?['rrAtlasEmbedded']:[];
  const sandbox={document:{documentElement:{classList:{contains:k=>classes.includes(k)}}},cloudRowsCacheSavedAt:savedAt};
  return vm.runInNewContext(predicate+'\n;shouldSkipBackgroundCloudRefresh()',sandbox);
}
const now=Date.now();
assert.equal(evaluate(true,new Date(now-1000).toISOString()),true,'recent embedded cache must skip');
assert.equal(evaluate(false,new Date(now-1000).toISOString()),false,'normal top page must refresh');
assert.equal(evaluate(true,new Date(now-6*60*1000).toISOString()),false,'old direct Atlas cache must refresh');
assert.equal(evaluate(true,null),false,'missing timestamp must refresh');
assert.equal(evaluate(true,'invalid'),false,'invalid timestamp must refresh');
assert.equal(evaluate(true,new Date(now+60*1000).toISOString()),false,'future timestamp must refresh');
assert(html.includes('cloudRowsCacheSavedAt = request.result?.savedAt ?? null;'),'cache read retains savedAt');
assert(html.includes('cloudRowsCacheSavedAt = null;'),'freshness resets on cache read');

// 2. The startup path only skips when a per-user cache was actually used,
//    and the refresh itself is unchanged for every other path.
const callSite=html.indexOf('refreshCloudRowsInBackground(\n        cachedCloudRows');
assert(callSite>0,'startup background refresh call site exists');
const gate=html.slice(Math.max(0,callSite-400),callSite);
assert(gate.includes('cloudStartupUsedCache &&'),'skip applies only when the startup cache was used');
assert(gate.includes('!shouldSkipBackgroundCloudRefresh()'),'startup refresh is gated by the embedded predicate');
const refresh=extractFunction(html,'refreshCloudRowsInBackground');
assert(refresh.includes('await fetchCloudRuns()'),'background refresh still performs the full fetch when it runs');
assert(refresh.includes('saveCloudRowsCache'),'background refresh still re-saves the cache when it runs');

// 3. The cache that authorizes the skip is the signed-in user's own:
//    records live in a store keyed by userId and are read by currentUser.id.
const load=extractFunction(html,'loadCloudRowsCache');
assert(load.includes('currentUser.id'),'cache reads are keyed by the signed-in user id');
assert(html.includes("keyPath:'userId'"),'cache store is keyed by userId');

// 4. The cache is only ever written through saveCloudRowsCache, and every
//    call site is fed by a complete fetchCloudRuns() result, so a used
//    cache is a complete snapshot (never a partial write).
const puts=html.split("CLOUD_CACHE_STORE,\n              'readwrite'").length-1;
assert.equal(puts,1,'cache records are written in exactly one place');
const saveCalls=[...html.matchAll(/saveCloudRowsCache\(/g)].map(m=>m.index).filter(i=>html.slice(Math.max(0,i-30),i).includes('await'));
assert(saveCalls.length>=3,'cache is saved from the startup, background-refresh and list-refresh flows');
for(const i of saveCalls){
  const window=html.slice(Math.max(0,i-700),i);
  assert(window.includes('fetchCloudRuns()'),'every cache save is fed by fetchCloudRuns: offset '+i);
}

console.log('PASS: embedded Atlas reuses the per-user startup cache; normal refresh, cache ownership and complete-write invariants intact');
