#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const archive=fs.readFileSync('runner_rings_archive.js','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const selector='#appRoot .rrFeatureTiles a[href="./today.html"]';
assert.equal(archive.split("document.querySelector('"+selector+"')").length-1,2,'startup and observer must both detect canonical Today tile');
assert(!archive.includes('#dashboard .rrFeatureTiles a[href="./today.html"]'),'obsolete dashboard selector must not remain');
const feature=html.slice(html.indexOf('<div class="rrFeatureTiles"'),html.indexOf('<details id="accountPanel"'));
assert.equal((feature.match(/href="\.\/today\.html"/g)||[]).length,1,'exactly one canonical Today feature tile');
assert.equal((html.match(/id="ringsTodayDashboardLink"/g)||[]).length,0,'no static legacy Today tile');
assert(html.includes('class="authPublicLink" href="./today.html"'),'logged-out public Today link retained');
assert(archive.includes('#authArea .authPublicLinks a[href="./today.html"]'),'logged-out duplicate guard retained');
assert(html.includes('runner_rings_archive.js?v=20261119-today-tile-dedupe-02'),'fresh Safari asset query');
const app=html.match(/const APP_BUILD = '([^']+)'/),worker=sw.match(/const RR_BUILD = '([^']+)'/);
assert(app&&worker);assert.equal(app[1],worker[1]);
console.log('PASS: one Today tile, guards after relocation, public navigation preserved');
