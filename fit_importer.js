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
        'FIT activity 作成成功:',
        activity
      );

      if (
        typeof window.findPossibleDuplicate !==
        'function'
      ) {
        throw new Error(
          'findPossibleDuplicate が見つかりません'
        );
      }

      if (
        typeof window.registerActivity !==
        'function'
      ) {
        throw new Error(
          'registerActivity が見つかりません'
        );
      }

      if (
        typeof window.saveActivityToCloud !==
        'function'
      ) {
        throw new Error(
          'saveActivityToCloud が見つかりません'
        );
      }

      const duplicate =
        window.findPossibleDuplicate(
          activity
        );

      if (duplicate) {

        console.log(
          '✅ 重複判定成功：既存ランのため保存しません'
        );

        console.log(
          '重複対象:',
          duplicate
        );

        return;
      }

      const registered =
        window.registerActivity(
          activity
        );

      if (!registered) {

        console.log(
          '✅ 完全一致：既に登録済みのため保存しません'
        );

        return;
      }

      console.log(
        '新規FITとして登録しました'
      );

      const savedRow =
        await window.saveActivityToCloud(
          activity
        );

      console.log(
        '☁️ FITクラウド保存成功'
      );

      console.log(
        '保存結果:',
        savedRow
      );

    }
    catch(error) {

      console.error(
        'FIT処理失敗:',
        error
      );

    }
    finally {

      fitInput.value =
        '';

    }

  };
window.buildActivityFromFIT =
  buildActivityFromFIT;
