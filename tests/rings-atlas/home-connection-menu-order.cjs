#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html','utf8');
const sw = fs.readFileSync('sw.js','utf8');
function order(selector) {
  const escaped=selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const found=[...html.matchAll(new RegExp(escaped+'\\s*\\{([^}]+)\\}','g'))];
  assert(found.length,'selector missing '+selector);
  const orders=found.map(x=>/\\border\\s*:\\s*(\\d+)/.exec(x[1])).filter(Boolean);
  assert(orders.length,'no order declaration '+selector);
  return Number(orders[orders.length-1][1]);
}
const closed=order('#accountBar #rrDataConnectionMenu');
const opened=order('#accountBar #rrDataConnectionMenu[open]');
assert.equal(opened,closed,'opened connection menu must not jump below run controls');
assert(opened<order('#accountBar #addRunButton'),'connection menu should precede add-run');
assert(opened<order('#accountBar #rrRunManageActions'),'connection menu should precede run management');
assert(html.includes('<details id="dataSetupGuide"'),'signed-in setup guide preserved');
assert(html.includes('<details class="setupGuide setupGuideAuth" id="authImportGuide">'),'logged-out public guide preserved');
const app=html.match(/const APP_BUILD = '([^']+)'/);
const worker=sw.match(/const RR_BUILD = '([^']+)'/);
assert(app&&worker);
assert.equal(app[1],worker[1]);
console.log('PASS: connection menu stable before run actions when opened and closed');
