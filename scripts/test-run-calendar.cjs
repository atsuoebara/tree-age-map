/* A-4 independent run calendar regression: static and pure date checks.
 * node scripts/test-run-calendar.cjs
 * No external services or user records.
 */
'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const srcStart=html.indexOf('/* Run calendar is a private display mode');
const srcEnd=html.indexOf('/* =====================================\n   クラウド一覧描画',srcStart);
assert.ok(srcStart!==-1&&srcEnd>srcStart,'inline run calendar must exist');
const source=html.slice(srcStart,srcEnd);
assert.doesNotThrow(()=>new Function(source));
const dateFunc=source.match(/function rrCalDate\(row\)\{[\s\S]*?\n\}/);
assert.ok(dateFunc,'date parser is present');
const date=new Function(dateFunc[0]+';return rrCalDate')();
for(const [input,expected] of [
  ['2026-11-05','2026-11-05'],
  ['2024-02-29','2024-02-29'],
  ['2026-02-29',''],
  ['2026-13-08',''],
  ['2026-00-08',''],
  ['foo',''],
  ['2013-06-06','2013-06-06'],
  [null,'']
])assert.equal(date({activity_date:input}),expected);
assert.equal(date({}), '');
assert.ok(html.includes('id="runCalendarQuickButton"'));
assert.ok(html.includes('id="cloudRunsList"'),'original list must remain');
assert.ok(html.includes('id="historySortArea"'),'original sort controls must remain');
assert.ok(source.includes('rrCalOwner===currentUser.id'),'owner isolation');
assert.ok(source.includes('focusCloudRun(row)'),'route focus must be reused');
assert.ok(source.includes('rrRunCalendarYear'),'year picker must be available');
assert.ok(source.includes('rrRunCalendarMonthSelect'),'month picker must be available');
assert.ok(source.includes("distances.length<runs.length?' +?':''"),'unknown distance cannot be silently counted as zero');
assert.ok(source.includes('perDay.get(day)||[]'),'same-day multiple-run lookup');
assert.ok(source.includes('km.toFixed(1)'),'daily summed km shown');
assert.ok(source.includes('row.name'),'run names stay available');
assert.ok(source.includes('rrCalGrid.replaceChildren()'),'no duplicate calendar cells');
assert.ok(source.includes('rrCalRecords.replaceChildren()'),'no duplicate detail results');
assert.ok(html.includes('rrCalOwner = currentUser?.id || null'),'owner assigned only on successful owner fetch');
assert.ok(html.includes('a4-milestones-preview.js?v=20261105-p0-breakdown-01'),'existing A-4 stays');
assert.ok(html.includes('runner_rings_archive.js?v=20261105-today-dedupe-01'),'Today fix stays');
console.log('Run calendar regression checks passed');
