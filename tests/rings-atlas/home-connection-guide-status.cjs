#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const begin=html.indexOf('const rrConnectionStates = {');
const end=html.indexOf("if (typeof window.initGarminConnection === 'function')",begin);
assert(begin>=0&&end>begin,'connection summary source exists');
const script=html.slice(begin,end);
function trial(){
  const summary={textContent:''},guide={open:false},observers=[];
  const document={documentElement:{lang:'ja'},getElementById(id){return id==='rrConnectionSummary'?summary:id==='dataSetupGuide'?guide:null;}};
  const window={addEventListener(){}};
  class MutationObserver{constructor(fn){observers.push(fn)}observe(){}}
  const context={document,window,MutationObserver};
  vm.runInNewContext(script,context);
  return {summary,guide,window,document};
}
const a=trial();
assert.equal(a.guide.open,false,'loading status must not expand guide');
a.window.rrSetConnectionState('strava',false);
a.window.rrSetConnectionState('coros',false);
a.window.rrSetConnectionState('garmin',false);
assert.equal(a.guide.open,false,'unknown intervals status prevents auto opening');
a.window.rrSetConnectionState('intervals',false);
assert.equal(a.guide.open,true,'four explicit disconnections expose guide with one tap');
a.guide.open=false;
a.window.rrSetConnectionState('strava',false);
assert.equal(a.guide.open,false,'manual close stays closed after refresh');
const b=trial();
b.window.rrSetConnectionState('strava',true);
for(const p of ['coros','garmin','intervals'])b.window.rrSetConnectionState(p,false);
assert.equal(b.guide.open,false,'connected user guide stays folded');
assert.match(b.summary.textContent,/Strava/);
const c=trial();
for(const p of ['strava','coros','intervals'])c.window.rrSetConnectionState(p,false);
c.window.rrSetConnectionState('garmin',null);
assert.equal(c.guide.open,false,'provider failure is unknown, not disconnected');
assert(html.includes('<details class="setupGuide setupGuideAuth" id="authImportGuide">'),'public onboarding remains');
assert(html.includes('id="rrDataConnectionMenu"'),'existing menu preserved');
assert(html.includes('id="dataSetupGuide"'),'signed-in guide preserved');
const app=html.match(/const APP_BUILD = '([^']+)'/),worker=sw.match(/const RR_BUILD = '([^']+)'/);
assert(app&&worker);assert.equal(app[1],worker[1]);
console.log('PASS: confirmed-new users see guide in one tap; connected/unknown states stay compact');
