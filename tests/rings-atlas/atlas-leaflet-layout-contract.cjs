#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.resolve(__dirname, '../../rings-atlas-view.js'), 'utf8');
assert.match(source, /function refreshMapLayout\s*\(\)/);
assert.match(source, /requestAnimationFrame\s*\(/);
assert.match(source, /map\.invalidateSize\s*\(\{pan:false, animate:false\}\)/);
assert.equal((source.match(/refreshMapLayout\(\);/g) || []).length, 2,
  'both open and close must refresh the existing map');
assert.doesNotMatch(source, /\bL\.map\s*\(|\bfetch\s*\(|XMLHttpRequest|\bsetView\s*\(/,
  'Atlas must not create or refetch a map or change its center');
console.log('PASS: Atlas open/close schedule existing Leaflet size refresh only');
