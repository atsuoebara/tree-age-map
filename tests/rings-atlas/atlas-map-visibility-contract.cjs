#!/usr/bin/env node
'use strict';
// G0 preparation: protect the canonical map and filters from being hidden
// with #dashboard when Rings Atlas opens. This is a source contract, not
// a replacement for Safari/iPad interaction testing.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
const view = fs.readFileSync(path.join(__dirname, '../../rings-atlas-view.js'), 'utf8');
const openTag = id => {
  const matches = [...html.matchAll(new RegExp('<[a-zA-Z][^>]*\\bid="' + id + '"[^>]*>', 'g'))];
  assert.equal(matches.length, 1, id + ': expected exactly one element');
  return { index: matches[0].index, tag: matches[0][0] };
};
const app = openTag('appRoot').index;
const period = openTag('mapPeriodControls').index;
const filters = openTag('filters').index;
const mapMode = openTag('mapViewModeBar').index;
const map = openTag('map').index;
const dashboard = openTag('dashboard').index;
const atlas = openTag('rrAtlasView').index;
assert(app < period && period < filters && filters < mapMode && mapMode < map,
  'canonical filters and map order changed');
assert(map < dashboard && dashboard < atlas,
  'map must stay outside hidden dashboard and before Atlas');
assert.match(view, /home\.hidden\s*=\s*true/, 'Atlas must hide dashboard');
assert.match(view, /atlas\.hidden\s*=\s*false/, 'Atlas must show its view');
assert.doesNotMatch(view, /(?:getElementById\(['"]map['"]\)|querySelector\(['"]#map['"]\))\.remove\(/,
  'Atlas must not remove the map');
assert.doesNotMatch(view, /\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/, 'Atlas must not fetch again');
console.log('PASS: shared map and ALL/year/month controls remain outside hidden dashboard');
