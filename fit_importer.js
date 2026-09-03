import { Decoder, Stream } from './fit-sdk/src/index.js';

console.log('FIT SDK loaded');

const fitInput = document.createElement('input');
fitInput.type = 'file';
fitInput.accept = '.fit';
fitInput.style.display = 'none';

document.body.appendChild(fitInput);

const fitTestButton = document.createElement('button');
fitTestButton.textContent = 'FITテスト';
fitTestButton.type = 'button';
fitTestButton.style.margin = '8px';
fitTestButton.style.padding = '10px 14px';

const importArea =
  document.getElementById('importArea');

if (importArea) {
  importArea.appendChild(fitTestButton);
}

fitTestButton.onclick = () => {
  fitInput.click();
};

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

  let cells = [];

  if (
    typeof window.buildCellsFromRoute ===
    'function'
  ) {

    cells =
      Array.from(
        window.buildCellsFromRoute(
          latlngs
        )
      );

    console.log(
      'buildCellsFromRoute 接続成功'
    );

  }
  else {

    console.log(
      'buildCellsFromRoute はまだFIT側から参照できません'
    );

  }

  return {

    source: 'fit',

    name:
      file.name
        .replace(
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

fitInput.onchange =
  async event => {

    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    try {

      const activity =
        await buildActivityFromFIT(
          file
        );

      console.log(
        'FIT activity 作成成功'
      );

      console.log(
        'activity:',
        activity
      );

      console.log(
        '日時:',
        activity.date
      );

      console.log(
        '距離km:',
        activity.distance
      );

      console.log(
        'GPS座標数:',
        activity.latlngs.length
      );

      console.log(
        '都道府県:',
        activity.prefectures
      );

      console.log(
        '市町村:',
        activity.cities
      );

      console.log(
        'cells数:',
        activity.cells.length
      );

    }
    catch(error) {

      console.error(
        'FIT読み込み失敗:',
        error
      );

    }

  };
