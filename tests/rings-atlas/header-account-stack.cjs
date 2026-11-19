#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const js=fs.readFileSync(path.resolve(__dirname,'../../header-account-placement.js'),'utf8');
for(const id of ['rrHeaderTopRow','rrHeaderAccount','accountProfileArea','accountProfile',
                 'accountDisplayName','accountSettingsButton','rrMapRecordSummary']) {
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id+' must remain unique');
}
const h=html.indexOf('<header>'), row=html.indexOf('id="rrHeaderTopRow"');
const title=html.indexOf("Runner's Rings<span class=\"brandReading\">");
const slot=html.indexOf('id="rrHeaderAccount"'), end=html.indexOf('</header>');
assert(h<row && row<title && title<slot && slot<end,'account slot must be to the right of title');
assert.match(html, /#rrHeaderAccount #accountProfileArea\s*\{[^}]*flex-direction:column/);
assert.match(html, /#rrHeaderAccount #accountSettingsButton\s*\{[^}]*min-height:40px/);
assert.match(html, /header\.rrHasAccount #languageSwitch\s*\{[^}]*position:static/);
assert.match(js, /slot\.appendChild\(profile\)/);
assert.match(js, /getComputedStyle\(root\)\.display\s*!==\s*'none'/);
assert.match(js, /getComputedStyle\(auth\)\.display\s*===\s*'none'/);
assert.match(js, /slot\.hidden\s*=\s*!signedIn/);
assert.match(js, /new MutationObserver\(sync\)/);
assert.match(js, /window\.addEventListener\('pageshow', sync\)/);
assert.doesNotMatch(js, /fetch\s*\(|localStorage|sessionStorage|indexedDB|cloneNode/);
assert(html.indexOf('id="rrMapRecordSummary"')<html.indexOf('id="map"'));
console.log('PASS: title-right single account stack, login visibility, language control, map summary preserved');
