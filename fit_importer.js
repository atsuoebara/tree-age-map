import { Decoder, Stream } from './fit-sdk/src/index.js';

console.log('FIT SDK loaded');

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

window.buildActivityFromFIT =
  buildActivityFromFIT;
