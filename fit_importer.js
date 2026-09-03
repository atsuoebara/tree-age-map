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

fitInput.onchange = async event => {

  const file =
    event.target.files?.[0];

  if (!file) {
    return;
  }

  try {

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

    console.log(
      '開始日時:',
      session?.startTime
    );

    console.log(
      'sport:',
      session?.sport
    );

    console.log(
      'subSport:',
      session?.subSport
    );

    console.log(
      '距離:',
      session?.totalDistance
    );

    console.log(
      'GPS座標数:',
      gpsRecords.length
    );

    console.log(
      'session:',
      session
    );

  }
  catch(error) {

    console.error(
      'FIT読み込み失敗:',
      error
    );

  }

};
