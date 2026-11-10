#!/usr/bin/env node
'use strict';
// Execute the real renderCloudRuns function in an isolated VM with mocked I/O.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('// Reopening the cloud list shortly after a successful read');
const end = html.indexOf('/* =====================================\n   過去ラン', start);
assert(start >= 0 && end > start, 'Unable to locate current cloud-list implementation');
const source = html.slice(start, end);
let now = 100000, requests = 0, renders = 0;
let rows = [{id: 1, activity_date:'2026-11-10', route:[[36,139],[36.1,139.1]]}];
const list = {innerHTML:''};
const context = {
  Date: {now:()=>now},
  currentUser: {id:'owner-a'},
  cloudRows: [],
  cloudRunCount:0,
  rrCalOwner:null,
  document:{getElementById(id){assert.equal(id,'cloudRunsList'); return list;}},
  renderCloudRowsList(){renders++;},
  async fetchCloudRuns(){requests++; return rows;},
  async saveCloudRowsCache(){},
  async updateStorageInfo(){},
  rrCalRender(){},
  setStatus(){},
  console
};
vm.createContext(context);
vm.runInContext(source+'\nglobalThis.testRenderCloudRuns = renderCloudRuns;',context);
const run=context.testRenderCloudRuns;
(async()=>{
  await run({skipRecent:true});
  assert.equal(requests,1,'first list open must fetch');
  await run({skipRecent:true});
  assert.equal(requests,1,'reopen within 30 s must reuse rows');
  assert(renders>=2,'cached rows must still render');
  now+=30000;
  await run({skipRecent:true});
  assert.equal(requests,2,'after 30 s must fetch');
  await run();
  assert.equal(requests,3,'explicit refresh must fetch');
  context.currentUser={id:'owner-b'};
  await run({skipRecent:true});
  assert.equal(requests,4,'different account must fetch');
  rows=[];
  await run({skipRecent:true});
  assert.equal(requests,5,'transition to empty result must fetch once');
  await run({skipRecent:true});
  assert.equal(requests,6,'empty list must never be throttled');
  console.log('Cloud-list egress regression: 7 scenarios passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
