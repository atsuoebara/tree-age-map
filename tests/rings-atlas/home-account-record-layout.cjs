#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const unique=id=>{
 const all=[...html.matchAll(new RegExp('id="'+id+'"','g'))];
 assert.equal(all.length,1,id+' must be unique');
 return all[0].index;
};
const account=unique('accountBar');
const profile=unique('accountProfileArea');
const period=unique('mapPeriodControls');
const summary=unique('rrMapRecordSummary');
const mode=unique('mapViewModeBar');
const map=unique('map');
const dashboard=unique('dashboard');
assert(account<profile && profile<period,'account controls moved out of header');
assert(period<summary && summary<mode && mode<map && map<dashboard,
  'records must be above existing map and outside dashboard');
for(const id of ['totalDistance','runCount','cityCount']) {
 const pos=unique(id);
 assert(summary<pos && pos<mode,id+' must retain canonical ID above map');
}
assert.match(html,/#accountBar #accountProfileArea\s*\{[^}]*order:3;[^}]*margin-left:auto;/);
assert.match(html, /@media \(max-width:520px\) \{\s*#accountBar #accountProfileArea/);
assert(!html.includes('id="rrPeriodOverview"'),'do not duplicate PR #254 summary');
console.log('PASS: account in right-aligned header and canonical record summary above map; no duplicate IDs');
