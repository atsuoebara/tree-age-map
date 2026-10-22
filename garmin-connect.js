// Provider credentials stay on the server. A user JWT is sent only in POST bodies.
window.initGarminConnection = function ({ client, url }) {
  const connect = document.getElementById('garminApiConnectButton');
  const disconnect = document.getElementById('garminApiDisconnectButton');
  const message = document.getElementById('garminApiMessage');
  const shortcut = document.getElementById('garminShortcutButton');
  const english = (localStorage.getItem('runners-rings-language') || navigator.language).startsWith('en');
  const text = (ja, en) => english ? en : ja;
  if (shortcut) {
    shortcut.textContent = text('Garmin設定', 'Garmin settings');
    shortcut.title = text('接続設定を開きます。接続後に同期したGPS付きのランを自動で取り込みます。', 'Open connection settings. GPS runs synced after connecting are imported automatically.');
    shortcut.onclick = () => {
      const panel = document.getElementById('accountPanel');
      if (panel) panel.open = true;
      document.getElementById('garminApiSection')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
  }
  let revision = 0;
  let busy = false;
  async function session() {
    const { data, error } = await client.auth.getSession();
    if (error || !data.session) throw new Error('session');
    return data.session;
  }
  async function refresh() {
    const current = ++revision;
    connect.disabled = true;
    disconnect.hidden = true;
    message.textContent = text('Garminの接続状態を確認中…', 'Checking Garmin connection…');
    try {
      const account = await session();
      const response = await fetch(url + '/functions/v1/garmin-oauth/status', {
        method: 'POST', body: new URLSearchParams({ access_token: account.access_token }),
        credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('status');
      const result = await response.json();
      if (current !== revision) return;
      connect.hidden = result.connected;
      disconnect.hidden = !result.connected;
      connect.disabled = false;
      if (shortcut) shortcut.textContent = result.connected
        ? text('✓ Garmin接続済み', '✓ Garmin connected')
        : text('Garminに接続', 'Connect Garmin');
      message.textContent = result.connected
        ? text('Garminに接続済みです。接続後にGarmin Connectへ同期したGPS付きのランを自動で取り込みます。反映まで時間がかかる場合があります。', 'Garmin is connected. GPS runs synced to Garmin Connect after connecting are imported automatically. Imports may take some time.')
        : text('Garminは未接続です。', 'Garmin is not connected.');
      const returnUrl = new URL(window.location.href);
      if (['connected', 'disconnected'].includes(returnUrl.searchParams.get('garmin'))) {
        const panel = document.getElementById('accountPanel');
        if (panel) panel.open = true;
        returnUrl.searchParams.delete('garmin');
        window.history.replaceState(null, '', returnUrl);
      }
    } catch {
      if (current !== revision) return;
      connect.hidden = false;
      connect.disabled = false;
      message.textContent = text('接続状態を確認できません。ログイン状態や通信を確認してください。', 'Could not check the connection. Check your sign-in and network.');
    }
  }
  async function submit(action) {
    if (busy) return;
    if (action === 'disconnect' && !confirm(text('Garminとの接続を解除しますか？保存済みのランは削除されません。', 'Disconnect Garmin? Previously saved runs will be kept.'))) return;
    busy = true;
    connect.disabled = disconnect.disabled = true;
    message.textContent = text('Garminの手続きを開始しています…', 'Starting Garmin connection request…');
    try {
      const account = await session();
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = url + '/functions/v1/garmin-oauth/' + action;
      const token = document.createElement('input');
      token.type = 'hidden'; token.name = 'access_token'; token.value = account.access_token;
      form.appendChild(token); document.body.appendChild(form);
      form.submit(); form.remove();
    } catch {
      message.textContent = text('開始できませんでした。ログインし直してお試しください。', 'Could not start. Please sign in again.');
      busy = false;
      connect.disabled = disconnect.disabled = false;
    }
  }
  connect.onclick = () => submit('start');
  disconnect.onclick = () => submit('disconnect');
  client.auth.onAuthStateChange(() => { setTimeout(refresh, 0); });
  window.addEventListener('pageshow', () => { busy = false; disconnect.disabled = false; refresh(); });
  refresh();
};
