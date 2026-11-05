'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync(require('node:path').join(__dirname,'..','index.html'),'utf8');
const start=html.indexOf('function rrCalDate(row){'),end=html.indexOf('function rrCalRender()',start);
assert.ok(start>0 && end>start,'calendar date parser must exist');
const parseDate=new Function(html.slice(start,end)+';return rrCalDate;')();
const cases=[
  [{activity_date:'2026-11-06',started_at:'2026-11-05T15:30:00Z'},'2026-11-06'],
  [{activity_date:'2026-11-05',started_at:'2026-11-06T01:30:00Z'},'2026-11-05'],
  [{activity_date:'2024-02-29'},'2024-02-29'],
  [{activity_date:'2025-02-29'},''],
  [{activity_date:'2026-11-31'},''],
  [{activity_date:'2026-13-01'},''],
  [{activity_date:'2026-00-01'},''],
  [{activity_date:null,started_at:'2026-11-05T15:30:00Z'},''],
];
for(const [row,expected] of cases)assert.equal(parseDate(row),expected);
assert.match(html, /const monthStart=String\(rrCalYear\).*?rrCalMonth\+1/);
assert.match(html,/date=rrCalDate\(row\);if\(!date\.startsWith\(monthStart\)\)continue/);
assert.match(html,/const distances=runs\.filter/);
assert.match(html,/const km=distances\.reduce/);
assert.match(html,/runs\.length>1/);
assert.match(html,/selected\.sort/);
assert.match(html,/b\.onclick=\(\)=>focusCloudRun\(row\)/);
assert.match(html,/getElementById\('runCalendarQuickButton'\)\.onclick/);
assert.match(html,/getElementById\('cloudRunsList'\)\.style\.display=calendar\?'none':''/);
assert.match(html,/const requestOwner = currentUser\?\.id \|\| null/);
assert.match(html,/currentUser\?\.id !== requestOwner\) return/);
assert.match(html,/rrCalOwner=null;rrCalDay=null/);
assert.match(html,/月間年輪とは集計対象が異なる場合があります/);
assert.match(html,/rrRunCalendarMonthSummary/);
assert.match(html,/const allMonthRuns=Array\.from\(perDay\.values\(\)\)\.flat\(\)/);
assert.match(html,/const totalMonthKm=validMonthKm\.reduce/);
assert.match(html,/rrCalSetMode\('list'\)/);
assert.match(html,/align-self:stretch/);
assert.match(html,/today-dedupe-01/);
assert.match(html,/p0-breakdown-01/);
console.log('Run calendar static + date regression tests passed:',cases.length,'date cases and 16 guards');
