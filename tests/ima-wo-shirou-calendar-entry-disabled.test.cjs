'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const from=html.indexOf('// REVIEW ONLY: disabled until a separate audited release decision.');
const to=html.indexOf('function rrCalRender(){',from);
const section=html.slice(from,to);
test('production entry is hard-disabled and rollout boundary remains unset',()=>{
 assert.ok(from>=0&&to>from);
 assert.match(section,/const RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED=false;/);
 assert.match(section,/const RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS=null;/);
 assert.match(section,/if\(!RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED\)return;/);
 assert.doesNotMatch(section,/localStorage|sessionStorage|fetch\s*\(/);
});
test('existing calendar map path is untouched; new action only under feature OFF gate',()=>{
 assert.match(html,/b\.append\(name,distance\);b\.onclick=\(\)=>focusCloudRun\(row\);rrCalRecords\.append\(b\);/);
 assert.match(html,/if\(RR_IMA_WO_SHIROU_CALENDAR_ENTRY_ENABLED\)\{[\s\S]*?action\.textContent=english\?'Rings Now: select this run':'リングスナウでこのランを選択'/);
 assert.match(html,/action\.onclick=\(\)=>rrImaWoShirouSelectCalendarRun\(row,selectionOwnerId,selectionDate,status\)/);
});
test('selection checks identity, date, calendar and logout before/after asynchronous work',()=>{
 assert.match(section,/currentUser\?\.id===selectionOwnerId/);
 assert.match(section,/rrCalOwner===selectionOwnerId/);
 assert.match(section,/rrCalMode==='calendar'/);
 assert.match(section,/r\.user_id===selectionOwnerId&&r\.deleted_at==null/);
 assert.match(section,/statusNode\.isConnected/);
 assert.match(section,/if\(!Number\.isSafeInteger\(RR_IMA_WO_SHIROU_FEATURE_STARTED_AT_MS\)\)/);
 assert.match(section,/supabaseClient\.auth\.getSession\(\)/);
 assert.match(section,/connection\.choose\(row\.id,selectionOwnerId,selectionDate\)/);
 assert.match(section,/connection\.confirmGachi\(true\)/);
 assert.match(html,/function rrCalRender\(\)\{\s*rrRingsNowClear\(\)/);
 assert.match(html,/function rrCalSetMode\(mode\)\{\s*rrRingsNowClear\(\)/);
 assert.match(html,/for\(const listener of \[\.\.\.rrRingsNowAuthListeners\]\)listener\(\);\s*rrRingsNowClear\(\)/);
});
test('no fabricated analysis or FIT auto-link',()=>{
 assert.match(section,/No FIT auto-link, no 1km result, no writes/);
 assert.doesNotMatch(section,/reviewSingleUserFitBuffer\(|\.from\('runs'\)|providerDataCombined:true|arrayBuffer\(/);
});
