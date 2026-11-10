#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const {readFileSync, rmSync} = require('node:fs');
const path = 'journal-preview-artifact/fictional-journal-preview/index.html';
try {
  const result = spawnSync(process.execPath, ['scripts/generate-journal.mjs'], {
    env: {...process.env, FIXTURE_PREVIEW:'true', DRY_RUN:'false'},
    encoding:'utf8', timeout:60000
  });
  assert.equal(result.status,0, 'Fixture generation failed: '+result.stderr);
  const html=readFileSync(path,'utf8');
  assert.equal((html.match(/class="rr-creator-link"/g)||[]).length,2,'Japanese and English articles must both show creator credit');
  assert.equal((html.match(/https:\/\/www\.instagram\.com\/atsuoebarun\//g)||[]).length,2,'Both links must use one explicit personal account');
  assert.match(html,/作っている人/);
  assert.match(html,/Made by/);
  assert.match(html,/個人アカウント/);
  assert.match(html,/personal account/);
  assert.match(html,/rel="noopener noreferrer"/);
  assert.match(html,/data-lang="en" hidden/);
  assert.match(html,/class="back" href="\/journal.html"/);
  console.log('Journal creator link fixture: all checks passed');
} finally {
  rmSync('journal-preview-artifact',{recursive:true,force:true});
}
