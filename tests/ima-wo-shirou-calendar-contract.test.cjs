'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('existing fetchCloudRuns retrieves required row fields without extra query', () => {
  const start = html.indexOf('async function fetchCloudRuns(options = {})');
  const end = html.indexOf('function buildActivityFromCloudRow(', start);
  assert.ok(start >= 0 && end > start);
  const body = html.slice(start, end);
  const select = body.match(/\?select=([^']+)'/);
  assert.ok(select, 'fetchCloudRuns select projection found');
  const columns = select[1].split(',');
  for(const key of ['id','user_id','started_at','activity_date','distance_km'])
    assert.ok(columns.includes(key), key+' available in the existing row');
  assert.match(body, /&user_id=eq\./);
  assert.match(body, /&deleted_at=is\.null/);
});
test('existing calendar preserves per-row choice and route navigation',()=>{
  assert.match(html,/function rrCalDate\(row\)/);
  assert.match(html,/b\.onclick=\(\)=>focusCloudRun\(row\)/);
  assert.match(html,/runs\.length>1/);
});
