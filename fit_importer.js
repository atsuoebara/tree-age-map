import { Decoder, Stream } from './fit-sdk/src/index.js';

console.log('FIT SDK loaded');

/*
 * Language switch discoverability helper.
 * index.html owns the actual Japanese/English switching logic; this only
 * makes that existing control easier to notice, especially for first-time
 * overseas visitors.
 */
function improveLanguageSwitchDiscoverability() {
  const switcher =
    document.getElementById(
      'languageSwitch'
    );

  if (!switcher) {
    return;
  }

  const englishButton =
    switcher.querySelector(
      '[data-language="en"]'
    );

  if (englishButton) {
    englishButton.textContent =
      'English';
  }

  switcher.setAttribute(
    'aria-label',
    '言語を変更 / Change language'
  );

  switcher.setAttribute(
    'title',
    '日本語 / English'
  );

  if (
    !document.getElementById(
      'runnerRingsLanguageHintStyle'
    )
  ) {
    const style =
      document.createElement(
        'style'
      );

    style.id =
      'runnerRingsLanguageHintStyle';

    style.textContent = `
      #languageSwitch{
        align-items:center;
        z-index:2000;
        border-color:rgba(234,255,0,.55) !important;
        box-shadow:0 0 0 1px rgba(234,255,0,.08),0 5px 18px rgba(0,0,0,.26);
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
      @media (max-width:520px){
        header h1{padding-right:158px !important;}
        #languageSwitch{top:10px;right:8px;}
        #languageSwitch .languageButton{padding:7px 8px;font-size:11px;}
      }
    `;

    document.head.appendChild(
      style
    );
  }
}

if (
  document.readyState ===
  'loading'
) {
  document.addEventListener(
    'DOMContentLoaded',
    improveLanguageSwitchDiscoverability,
    { once: true }
  );
} else {
  improveLanguageSwitchDiscoverability();
}

const semicirclesToDegrees =
  value =>
    value * (180 / Math.pow(2, 31));

async function buildActivityFromFIT(file) {

  const arrayBuffer =
    await file.arrayBuffer();

  const stream =
    Stream.fromArrayBuffer(
      arrayBuffer
    );

  const decoder =
    new Decoder(
      stream
    );

  const {
    messages,
    errors
  } =
    decoder.read();

  console.log(
    'FIT errors:',
    errors
  );

  const session =
    messages.sessionMesgs?.[0];

  if (!session) {
    throw new Error(
      'FITにsession情報がありません'
    );
  }

  if (
    session.sport !== 'running'
  ) {
    throw new Error(
      `ランニング以外のFITです: ${session.sport}`
    );
  }

  const records =
    messages.recordMesgs || [];

  const gpsRecords =
    records.filter(
      record =>
        Number.isFinite(
          record.positionLat
        ) &&
        Number.isFinite(
          record.positionLong
        )
    );

  const latlngs =
    gpsRecords.map(
      record => [
        semicirclesToDegrees(
          record.positionLat
        ),
        semicirclesToDegrees(
          record.positionLong
        )
      ]
    );

  if (
    latlngs.length < 2
  ) {
    throw new Error(
      'GPS座標が不足しています'
    );
  }

  if (
    typeof window.analyseRoute !==
    'function'
  ) {
    throw new Error(
      'analyseRoute が見つかりません'
    );
  }

  if (
    typeof window.buildCellsFromRoute !==
    'function'
  ) {
    throw new Error(
      'buildCellsFromRoute が見つかりません'
    );
  }

  const analysis =
    window.analyseRoute(
      latlngs
    );

  const date =
    session.startTime
      ? new Date(
          session.startTime
        )
      : null;

  const distanceKm =
    Number.isFinite(
      session.totalDistance
    )
      ? session.totalDistance / 1000
      : analysis.calculatedKm;

  const cells =
    Array.from(
      window.buildCellsFromRoute(
        latlngs
      )
    );

  return {

    source: 'fit',

    name:
      file.name.replace(
        /\.fit$/i,
        ''
      ),

    date,

    startedAt:
      date,

    year:
      date
        ? date.getFullYear()
        : null,

    distance:
      distanceKm,

    latlngs,

    cityDistances:
      analysis.cityDistances,

    cities:
      analysis.cities,

    prefectures:
      analysis.prefectures,

    cells

  };

}
async function inspectFITFile(
  file
) {

  const arrayBuffer =
    await file.arrayBuffer();

  const stream =
    Stream.fromArrayBuffer(
      arrayBuffer
    );

  const decoder =
    new Decoder(
      stream
    );

  const {
    messages
  } =
    decoder.read();

  const session =
    messages.sessionMesgs?.[0];

  if (
    !session
  ) {

    return {
      isRunning: false,
      hasGPS: false
    };

  }


  const records =
    messages.recordMesgs ||
    [];

    const gpsRecords =
    records.filter(
      record =>
        Number.isFinite(
          record.positionLat
        ) &&
        Number.isFinite(
          record.positionLong
        )
    );

  const gpsRecordCount =
    gpsRecords.length;

  const latlngs =
    gpsRecords.map(
      record => [
        semicirclesToDegrees(
          record.positionLat
        ),
        semicirclesToDegrees(
          record.positionLong
        )
      ]
    );

  const date =
    session.startTime
      ? new Date(
          session.startTime
        )
      : null;

  const distance =
    Number.isFinite(
      session.totalDistance
    )
      ? session.totalDistance / 1000
      : null;

  return {
    isRunning:
      session.sport ===
      'running',

    hasGPS:
      gpsRecordCount >=
      2,

        gpsRecordCount,

    date,

    startedAt:
      date,

    distance,

    latlngs,

    name:
      file.name.replace(
        /\.fit$/i,
        ''
      )
  };

}


window.inspectFITFile =
  inspectFITFile;
window.buildActivityFromFIT =
  buildActivityFromFIT;
