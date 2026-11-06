/* C-3: notify, never auto-reload or force a waiting Service Worker to activate. */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator) || location.protocol !== 'https:') return;

  function newer(candidate, current) {
    const valid = /^\d{4}\.\d{2}\.\d{2}\.\d+$/;
    if (!valid.test(candidate) || !valid.test(current)) return false;
    const a = candidate.split('.').map(Number);
    const b = current.split('.').map(Number);
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return a[i] > b[i];
    }
    return false;
  }

  function show(build) {
    if (document.getElementById('rrPwaUpdateNotice')) return;
    const en = document.documentElement.lang === 'en';
    const panel = document.createElement('aside');
    panel.id = 'rrPwaUpdateNotice';
    panel.setAttribute('role', 'status');
    panel.setAttribute('aria-live', 'polite');
    Object.assign(panel.style, {
      position: 'fixed', zIndex: '10020', bottom: 'calc(12px + env(safe-area-inset-bottom))',
      left: '12px', right: '12px', maxWidth: '460px', margin: '0 auto',
      padding: '14px', border: '1px solid #78eaff', borderRadius: '14px',
      background: '#13253c', color: '#fff', boxShadow: '0 8px 28px #0008',
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', lineHeight: '1.5'
    });
    const headline = document.createElement('div');
    headline.style.fontWeight = '750';
    headline.textContent = en ? 'An update is available: Build ' + build
                              : '新しい更新があります：Build ' + build;
    panel.append(headline);
    const explanation = document.createElement('p');
    explanation.style.margin = '6px 0 10px';
    explanation.textContent = en ? 'Finish any import or sync before updating.'
                                  : '取り込み・同期などの作業を終えてから更新してください。';
    panel.append(explanation);
    const buttons = document.createElement('div');
    Object.assign(buttons.style, { display: 'flex', gap: '8px', flexWrap: 'wrap' });
    const instructions = document.createElement('button');
    instructions.type = 'button';
    instructions.textContent = en ? 'How to update' : '更新方法';
    const later = document.createElement('button');
    later.type = 'button';
    later.textContent = en ? 'Later' : 'あとで';
    for (const button of [instructions, later]) {
      Object.assign(button.style, {
        border: '1px solid #78eaff', borderRadius: '9px', padding: '8px 12px',
        background: '#173e54', color: '#fff', font: 'inherit', cursor: 'pointer'
      });
      buttons.append(button);
    }
    later.addEventListener('click', () => panel.remove());
    instructions.addEventListener('click', () => {
      explanation.textContent = en
        ? 'When you are finished, close all Runner\'s Rings windows/tabs, then reopen it while online. No automatic reload will occur.'
        : '作業終了後、ランリングのホーム画面アプリとSafariのタブをすべて閉じ、オンラインで開き直してください。自動再読み込みは行いません。';
      instructions.disabled = true;
    });
    panel.append(buttons);
    document.body.append(panel);
  }

  function inspectWaiting(registration) {
    const worker = registration.waiting;
    if (!worker || !navigator.serviceWorker.controller) return;
    const channel = new MessageChannel();
    let finished = false;
    function cleanup() {
      if (finished) return;
      finished = true;
      channel.port1.close();
    }
    channel.port1.onmessage = event => {
      if (!finished && event.data && event.data.type === 'RR_BUILD_INFO' &&
          typeof event.data.build === 'string' &&
          newer(event.data.build, APP_BUILD)) show(event.data.build);
      cleanup();
    };
    // A pre-C3 worker has no message handler; a timeout prevents retained ports.
    setTimeout(cleanup, 3000);
    try { worker.postMessage({ type: 'RR_GET_BUILD' }, [channel.port2]); }
    catch (error) { cleanup(); }
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(registration => {
      inspectWaiting(registration);
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed') inspectWaiting(registration);
        });
      });
      // Explicitly look for a newer SW on a visit; never auto-activate it.
      registration.update().catch(() => {});
    }).catch(error => {
      console.warn("Runner's Rings Service Worker registration skipped:", error);
    });
  }, { once: true });
})();
