import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const path = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
const index=path('index.html');
const sw=path('sw.js');
const doc=path('docs/rings-now-calendar-source-preflight-20261114.md');
const modules=[
 'rings-now-calendar-owner-input-contract',
 'rings-now-calendar-selection-adapter',
 'rings-now-auth-snapshot-boundary',
 'rings-now-paginated-snapshot-source'
];
test('production entry is still disabled and rollout start remains null',()=>{
 assert.match(index,/const RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(index,/const RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
 const entry=index.match(/async function rrImaWoShirouSelectCalendarRun\([\s\S]*?\n}\nfunction rrCalRender\(/);
 assert.ok(entry,'Rings Now calendar handler must remain present but isolated');
 assert.match(entry[0],/if\(!RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED\)return;/);
});
test('current calendar is display-oriented with a distinct IndexedDB cache path',()=>{
 assert.match(index,/async function fetchCloudRuns\(options = \{\}\)/);
 assert.match(index,/const pageSize = 50;/);
 assert.match(index,/&user_id=eq\./);
 assert.match(index,/&deleted_at=is.null/);
 assert.match(index,/async function getCloudHeaders\(/);
 assert.match(index,/session\.access_token/);
 assert.match(index,/async function loadCloudRowsCache\(/);
 assert.match(index,/CLOUD_CACHE_STORE/);
 assert.match(index,/preloadedCloudRows\s*=\s*cachedCloudRows/);
 assert.match(index,/async function refreshCloudRowsInBackground\(/);
 assert.match(index,/function rrCalRender\(/);
 assert.match(index,/const years=cloudRows\.map/);
});
test('isolated owner boundary files have no new public imports or cached-data references',()=>{
 for(const key of modules){
  assert.equal(index.includes(key),false,'public entry imports '+key);
  assert.equal(sw.includes(key),false,'service worker refers to '+key);
 }
 for(const name of modules.slice(0,3)){
  const source=path('src/'+name+'.mjs');
  assert.doesNotMatch(source,/\bloadCloudRowsCache\b|\bcachedCloudRows\b|\bpreloadedCloudRows\b|\bcloudRows\b|\bindexedDB\b|\bCLOUD_CACHE_STORE\b/);
 }
});
test('integration preflight explicitly forbids treating display cache as authorization',()=>{
 assert.match(doc,/Viewing a cached entry does not authorize analysis/);
 assert.match(doc,/independently check an actual authenticated session/);
 assert.match(doc,/maximum 1,000-row contract/);
 assert.match(doc,/691,200 seconds/);
 assert.match(doc,/PR #109 draft\/HOLD/);
 assert.match(doc,/does \*\*not\*\* establish live Auth/);
});
