import { Decoder, Stream } from './fit-sdk/src/index.js';

console.log('FIT SDK loaded');

const RR_ENGLISH_FIXES = new Map([
  ["Runner's Ringsの始め方", "How to get started with Runner's Rings"],
  ["Runner's Ringsに無料登録", "Create your free Runner's Rings account"],
  ['メールアドレスとパスワードでアカウントを作成します。', 'Create an account with your email address and password.'],
  ['Email addressとPasswordでAccountを作成します。', 'Create an account with your email address and password.'],
  ['ランニングデータを取り込む', 'Import your running data'],
  ['Strava、Intervals.icu、COROS、FIT / GPX / TCX / ZIPなどから取り込めます。', 'Import runs from Strava, Intervals.icu, COROS, FIT / GPX / TCX / ZIP, and more.'],
  ['自分だけのランニングマップを楽しむ', 'Enjoy your personal running map'],
  ['走った道、地域走破、ALL・年別の広がりを地図で振り返れます。', 'Review the roads you have run, regions you have explored, and your ALL or yearly progress on the map.'],
  ['芸能人だからすごい、じゃない。井上咲楽さんの3時間14分19秒をチャッピーが本気で分析', "It’s not impressive just because she’s a celebrity — Chappy takes a close look at Sakura Inoue’s 3:14:19"],
  ['Log inすると、あなたのランニングマップを表示します。', 'Log in to view your personal running map.'],
  ['Log inすると、 あなたのランニングマップを表示します。', 'Log in to view your personal running map.'],
  ['走った人生の物語・開発の裏側を読む →', 'Read running stories and behind-the-scenes development →'],
  ['世界のランナーとつながる・ランキングを見る →', 'Connect with runners worldwide · View rankings →'],
  ['市町村ごとの順位で、今年の“陣取り”を見る →', 'See this year’s territory standings by municipality →'],
  ['表示', 'Display'],
  ['コース', 'Routes']
]);

function formatEnglishMonthValue(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return value || '';
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return value || '';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function syncEnglishMonthInputs() {
  const isEnglish = (document.documentElement.lang || '').toLowerCase().startsWith('en');
  const ids = ['timelapseStartMonth', 'timelapseEndMonth', 'timelapseReviewMonth'];

  ids.forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;

    let wrapper = input.closest('.rrEnglishMonthWrap');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.className = 'rrEnglishMonthWrap';
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);
    }

    let display = wrapper.querySelector('.rrEnglishMonthDisplay');
    if (!display) {
      display = document.createElement('span');
      display.className = 'rrEnglishMonthDisplay';
      wrapper.appendChild(display);
    }

    const refresh = () => {
      if (isEnglish) {
        wrapper.classList.add('isEnglish');
        input.classList.add('rrEnglishMonthInput');
        display.hidden = false;
        display.textContent = formatEnglishMonthValue(input.value);
      } else {
        wrapper.classList.remove('isEnglish');
        input.classList.remove('rrEnglishMonthInput');
        display.hidden = true;
      }
    };

    if (!input.dataset.rrEnglishMonthBound) {
      input.dataset.rrEnglishMonthBound = '1';
      input.addEventListener('input', () => setTimeout(syncEnglishMonthInputs, 0));
      input.addEventListener('change', () => setTimeout(syncEnglishMonthInputs, 0));
    }

    refresh();
  });
}

function applyEnglishLeftoverFixes() {
  const isEnglish = (document.documentElement.lang || '').toLowerCase().startsWith('en');
  if (!isEnglish) {
    syncEnglishMonthInputs();
    return;
  }

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const value = node.nodeValue?.trim();
    if (!value) continue;

    const japaneseMonth = value.match(/^(\d{4})年(\d{1,2})月$/);
    if (japaneseMonth) {
      const year = Number(japaneseMonth[1]);
      const month = Number(japaneseMonth[2]);
      if (month >= 1 && month <= 12) {
        const translatedMonth = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' })
          .format(new Date(Date.UTC(year, month - 1, 1)));
        node.nodeValue = node.nodeValue.replace(value, translatedMonth);
      }
      continue;
    }

    if (!RR_ENGLISH_FIXES.has(value)) continue;
    const translated = RR_ENGLISH_FIXES.get(value);
    node.nodeValue = node.nodeValue.replace(value, translated);
  }

  syncEnglishMonthInputs();
}

function improveLanguageSwitchDiscoverability() {
  const switcher = document.getElementById('languageSwitch');
  if (!switcher) return;

  const englishButton = switcher.querySelector('[data-language="en"]');
  if (englishButton) englishButton.textContent = 'English';

  switcher.setAttribute('aria-label', '言語を変更 / Change language');
  switcher.setAttribute('title', '日本語 / English');

  let moreLanguages = document.getElementById('rrMoreLanguagesShortcut');
  if (!moreLanguages) {
    moreLanguages = document.createElement('button');
    moreLanguages.id = 'rrMoreLanguagesShortcut';
    moreLanguages.type = 'button';
    switcher.appendChild(moreLanguages);
    moreLanguages.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const panel = document.getElementById('rrOnDeviceTranslate');
      if (!panel) return;
      panel.open = true;
      panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  const refreshMoreLanguagesLabel = () => {
    const isEnglish = (document.documentElement.lang || '').toLowerCase().startsWith('en');
    moreLanguages.textContent = isEnglish ? 'More languages' : '補助翻訳';
    moreLanguages.setAttribute('aria-label', isEnglish ? 'More languages' : '補助翻訳を開く');
  };
  refreshMoreLanguagesLabel();
  applyEnglishLeftoverFixes();

  if (!document.getElementById('runnerRingsLanguageHintStyle')) {
    const style = document.createElement('style');
    style.id = 'runnerRingsLanguageHintStyle';
    style.textContent = `
      #languageSwitch{
        align-items:center;
        z-index:2000;
        border-color:rgba(234,255,0,.55) !important;
        box-shadow:0 0 0 1px rgba(234,255,0,.08),0 5px 18px rgba(0,0,0,.26);
        overflow:visible !important;
      }
      #languageSwitch::before{
        content:'🌐';
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding-left:5px;
        font-size:14px;
        line-height:1;
      }
      #languageSwitch .languageButton{
        min-width:48px;
        padding:7px 10px;
        font-size:12px;
      }
      #rrMoreLanguagesShortcut{
        position:absolute;
        right:2px;
        top:calc(100% + 5px);
        border:0;
        background:transparent;
        color:#cbd5e1;
        font:700 11px/1.2 system-ui,sans-serif;
        text-decoration:underline;
        text-underline-offset:2px;
        cursor:pointer;
        white-space:nowrap;
        padding:3px 5px;
      }
      #rrMoreLanguagesShortcut:hover{color:#fff;}
      .rrEnglishMonthWrap{
        position:relative;
        width:100%;
      }
      .rrEnglishMonthWrap.isEnglish{
        min-height:39px;
        border:1px solid rgba(255,255,255,.14);
        border-radius:9px;
        background:#0f1d2f;
        overflow:hidden;
      }
      .rrEnglishMonthWrap > input{
        width:100%;
      }
      .rrEnglishMonthWrap.isEnglish > input{
        position:absolute;
        inset:0;
        width:100%;
        height:100%;
        min-height:39px;
        opacity:0 !important;
        z-index:2;
        cursor:pointer;
      }
      .rrEnglishMonthDisplay{
        position:absolute;
        inset:0;
        display:flex;
        align-items:center;
        justify-content:center;
        pointer-events:none;
        color:#fff;
        font:inherit;
        font-weight:700;
        z-index:1;
      }
      @media (max-width:520px){
        header h1{padding-right:158px !important;}
        #languageSwitch{top:10px;right:8px;}
        #languageSwitch .languageButton{padding:7px 8px;font-size:11px;}
        #rrMoreLanguagesShortcut{font-size:10px;top:calc(100% + 3px);}
      }
    `;
    document.head.appendChild(style);
  }

  const languageObserver = new MutationObserver(() => {
    refreshMoreLanguagesLabel();
    setTimeout(applyEnglishLeftoverFixes, 0);
  });
  languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  switcher.addEventListener('click', () => {
    setTimeout(() => {
      refreshMoreLanguagesLabel();
      applyEnglishLeftoverFixes();
    }, 0);
  });

  const timelapseOpenButton = document.getElementById('timelapseOpenButton');
  if (timelapseOpenButton) {
    timelapseOpenButton.addEventListener('click', () => {
      setTimeout(syncEnglishMonthInputs, 50);
      setTimeout(syncEnglishMonthInputs, 250);
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', improveLanguageSwitchDiscoverability, { once: true });
} else {
  improveLanguageSwitchDiscoverability();
}

const semicirclesToDegrees = value => value * (180 / Math.pow(2, 31));

async function buildActivityFromFIT(file) {
  const arrayBuffer = await file.arrayBuffer();
  const stream = Stream.fromArrayBuffer(arrayBuffer);
  const decoder = new Decoder(stream);
  const { messages, errors } = decoder.read();
  console.log('FIT errors:', errors);
  const session = messages.sessionMesgs?.[0];
  if (!session) throw new Error('FITにsession情報がありません');
  if (session.sport !== 'running') throw new Error(`ランニング以外のFITです: ${session.sport}`);
  const records = messages.recordMesgs || [];
  const gpsRecords = records.filter(record => Number.isFinite(record.positionLat) && Number.isFinite(record.positionLong));
  const latlngs = gpsRecords.map(record => [semicirclesToDegrees(record.positionLat), semicirclesToDegrees(record.positionLong)]);
  if (latlngs.length < 2) throw new Error('GPS座標が不足しています');
  if (typeof window.analyseRoute !== 'function') throw new Error('analyseRoute が見つかりません');
  if (typeof window.buildCellsFromRoute !== 'function') throw new Error('buildCellsFromRoute が見つかりません');
  const analysis = window.analyseRoute(latlngs);
  const date = session.startTime ? new Date(session.startTime) : null;
  const distanceKm = Number.isFinite(session.totalDistance) ? session.totalDistance / 1000 : analysis.calculatedKm;
  const cells = Array.from(window.buildCellsFromRoute(latlngs));
  return {
    source: 'fit',
    name: file.name.replace(/\.fit$/i, ''),
    date,
    startedAt: date,
    year: date ? date.getFullYear() : null,
    distance: distanceKm,
    latlngs,
    cityDistances: analysis.cityDistances,
    cities: analysis.cities,
    prefectures: analysis.prefectures,
    cells
  };
}

async function inspectFITFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const stream = Stream.fromArrayBuffer(arrayBuffer);
  const decoder = new Decoder(stream);
  const { messages } = decoder.read();
  const session = messages.sessionMesgs?.[0];
  if (!session) return { isRunning: false, hasGPS: false };
  const records = messages.recordMesgs || [];
  const gpsRecords = records.filter(record => Number.isFinite(record.positionLat) && Number.isFinite(record.positionLong));
  const gpsRecordCount = gpsRecords.length;
  const latlngs = gpsRecords.map(record => [semicirclesToDegrees(record.positionLat), semicirclesToDegrees(record.positionLong)]);
  const date = session.startTime ? new Date(session.startTime) : null;
  const distance = Number.isFinite(session.totalDistance) ? session.totalDistance / 1000 : null;
  return {
    isRunning: session.sport === 'running',
    hasGPS: gpsRecordCount >= 2,
    gpsRecordCount,
    date,
    startedAt: date,
    distance,
    latlngs,
    name: file.name.replace(/\.fit$/i, '')
  };
}

window.inspectFITFile = inspectFITFile;
window.buildActivityFromFIT = buildActivityFromFIT;