#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const indexPath = path.resolve(process.cwd(), 'index.html');

if (!fs.existsSync(indexPath)) {
  console.error('❌ index.html が見つかりません。リポジトリのルートで実行してください。');
  process.exit(1);
}

const html = fs.readFileSync(indexPath, 'utf8');

const checks = [
  {
    name: 'Version表示',
    patterns: [
      /const\s+APP_VERSION\s*=\s*['"][^'"]+['"]\s*;/,
      /getElementById\(['"]appVersion['"]\)/
    ]
  },
  {
    name: '日本語／EN切替ボタン',
    patterns: [
      /id=['"]languageSwitch['"]/,
      /data-language=['"]ja['"]/,
      /data-language=['"]en['"]/,
      /RR_LANGUAGE_STORAGE_KEY/,
      /function\s+setRunnerRingsLanguage\s*\(/,
      /function\s+translateUiNode\s*\(/
    ]
  },
  {
    name: '起動画面',
    patterns: [
      /id=['"]launchSplash['"]/,
      /class=['"]launchSplashLogo['"]/,
      /RunnerRingsSplashSessionKey/,
      /sessionStorage\.getItem\(\s*window\.RunnerRingsSplashSessionKey/,
      /sessionStorage\.setItem\(\s*window\.RunnerRingsSplashSessionKey/,
      /if\s*\(\s*!window\.RunnerRingsShouldShowSplash\s*\)/,
      /function\s+finishLaunchSplash\s*\(/,
      /init\(\)\.finally\(\s*finishLaunchSplash\s*\)/
    ]
  },
 {
  name: '初期設定案内',
  patterns: [
    /初期設定：データの取り込み方/,
    /Strava経由/,
    /Intervals\.icu経由/,
    /COROSから直接/,
    /FIT・GPX・ZIP/,
    /詳しい手順を見る/
  ]
},  {
    name: 'Strava新規連携の一時停止案内',
    patterns: [
      /const\s+STRAVA_NEW_CONNECTIONS_PAUSED\s*=\s*true\s*;/,
      /id=['"]stravaPauseNotice['"]/,
      /Strava新規連携を一時停止しています/,
      /New Strava connections are temporarily paused/
    ]
  },
  {
    name: 'COROSの約24時間案内と結果保持',
    patterns: [
      /24時間程度/,
      /COROS_IMPORT_RESULT_KEY/,
      /sessionStorage\.setItem\(\s*COROS_IMPORT_RESULT_KEY/,
      /sessionStorage\.getItem\(\s*COROS_IMPORT_RESULT_KEY/
    ]
  },
  {
    name: '通常ルートの赤線設定',
    patterns: [
      /const\s+ROUTE_COLOR\s*=\s*['"]#ff3b30['"]\s*;/,
      /color\s*:\s*ROUTE_COLOR[\s\S]{0,120}?weight\s*:\s*2\.5[\s\S]{0,120}?opacity\s*:\s*0\.65/
    ]
  },
  {
    name: '選択ランの青線設定',
    patterns: [
      /color\s*:\s*['"]#0057ff['"][\s\S]{0,100}?weight\s*:\s*6[\s\S]{0,100}?opacity\s*:\s*1/
    ]
  },
  {
    name: '地図と主要画面',
    patterns: [
      /id=['"]map['"]/,
      /id=['"]appRoot['"]/,
      /id=['"]cloudRunsPanel['"]/,
      /id=['"]dashboard['"]/,
      /L\.map\s*\(/
    ]
  },
  {
    name: 'ログイン・新規登録',
    patterns: [
      /id=['"]loginButton['"]/,
      /id=['"]signupButton['"]/,
      /\.auth\s*\.signInWithPassword\s*\(/,
      /\.auth\s*\.signUp\s*\(/
    ]
  },
  {
    name: 'アカウント設定の折りたたみ',
    patterns: [
      /id=['"]accountSettingsButton['"]/,
      /⚙\s*アカウント設定/,
      /accountSettingsButton\.addEventListener\s*\(\s*['"]click['"]\s*,\s*openAccountPanel\s*\)/,
      /<details\s+id=['"]accountPanel['"]/,
      /<summary>アカウント設定<\/summary>/,
      /<details\s+id=['"]accountPanel['"][\s\S]*?<\/details>\s*<details\s+id=['"]dataSetupGuide['"]/,
      /accountPanel\.open\s*=\s*true/,
      /id=['"]accountCloseButton['"]/,
      /accountCloseButton\.addEventListener[\s\S]*?accountPanel\.open\s*=\s*false/
    ]
  }
];

const failures = [];

for (const check of checks) {
  const missing = check.patterns.filter(pattern => !pattern.test(html));

  if (missing.length === 0) {
    console.log(`✅ ${check.name}`);
  } else {
    console.error(`❌ ${check.name}（${missing.length}項目不足）`);
    failures.push(check.name);
  }
}

const inlineScripts = [];
const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let scriptMatch;

while ((scriptMatch = scriptPattern.exec(html)) !== null) {
  const attributes = scriptMatch[1];
  const source = scriptMatch[2].trim();

  if (!/\bsrc\s*=/i.test(attributes) && source) {
    inlineScripts.push(source);
  }
}

try {
  inlineScripts.forEach(source => {
    new Function(source);
  });
  console.log(`✅ JavaScript構文（インライン ${inlineScripts.length}ブロック）`);
} catch (error) {
  console.error(`❌ JavaScript構文：${error.message}`);
  failures.push('JavaScript構文');
}

console.log('');

if (failures.length > 0) {
  console.error('Runner\'s Rings 自動チェック：失敗');
  console.error(`確認が必要：${failures.join('、')}`);
  process.exit(1);
}

console.log('Runner\'s Rings 自動チェック：すべて合格');
console.log('手動確認：スマホで起動画面、言語切替、地図の線、COROS取込みを確認してください。');
