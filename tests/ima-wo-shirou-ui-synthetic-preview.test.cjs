'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync(require('node:path').join(__dirname,'../previews/ima-wo-shirou-calendar-synthetic-20261113.html'),'utf8');
test('standalone preview uses synthetic only, no live reads or persistence',()=>{
 assert.match(html,/架空データのみ/);
 assert.match(html,/const rows=\[/);
 assert.match(html,/user_id:'DEMO'/);
 assert.doesNotMatch(html,/\bfetch\s*\(|\blocalStorage\b|\bsessionStorage\b|SUPABASE_RUNS_URL|GarminOAuth|<script\s+src=/i);
 assert.match(html,/import \{reviewSelectedCalendarRun\} from '\.\.\/src\/ima-wo-shirou-calendar-selection-review\.mjs'/);
});
test('selection is per run, never auto selected or certified',()=>{
 assert.match(html,/let active=null/);
 assert.match(html,/active=row;render\(\)/);
 assert.match(html,/selectedAsGachiRun:true/);
 assert.match(html,/verdict\.eligible/);
 assert.match(html,/解析は未認定のため実行できません/);
 assert.match(html,/信号待ちやトイレ休憩、自動ポーズなどの影響により、正しく分析できない場合があります。/);
});
test('synthetic time never used as production rollout',()=>{
 assert.match(html,/NOT a production rollout policy/);
 assert.match(html,/featureStartedAtMs=t-86400000/);
 assert.doesNotMatch(html,/index\.html\?lang/);
});
