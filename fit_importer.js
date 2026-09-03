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

    console.log(
      'FIT file:',
      file.name,
      file.size,
      'bytes'
    );

    const arrayBuffer =
      await file.arrayBuffer();

    const stream =
      Stream.fromArrayBuffer(
        arrayBuffer
      );

    console.log(
      'isFIT:',
      Decoder.isFIT(
        stream
      )
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

    console.log(
      'FIT messages:',
      messages
    );

  }
  catch(error) {

    console.error(
      'FIT読み込み失敗:',
      error
    );

  }

};
