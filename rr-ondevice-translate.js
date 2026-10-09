/*
 * Optional, on-device supplemental page translation for Runner's Rings.
 * Chrome desktop exposes the Translator API; other browsers receive a
 * browser-translation fallback message. No translation request is sent
 * to Runner's Rings or to a paid translation API.
 */
(() => {
  'use strict';

  if (!document.body || document.getElementById('rrOnDeviceTranslate')) return;

  const LANGUAGES = [
    ['ar', 'العربية'], ['bg', 'Български'], ['bn', 'বাংলা'],
    ['cs', 'Čeština'], ['da', 'Dansk'], ['de', 'Deutsch'],
    ['el', 'Ελληνικά'], ['es', 'Español'], ['fi', 'Suomi'],
    ['fr', 'Français'], ['he', 'עברית'], ['hi', 'हिन्दी'],
    ['hr', 'Hrvatski'], ['hu', 'Magyar'], ['id', 'Bahasa Indonesia'],
    ['it', 'Italiano'], ['kn', 'ಕನ್ನಡ'], ['ko', '한국어'],
    ['lt', 'Lietuvių'], ['mr', 'मराठी'], ['nl', 'Nederlands'],
    ['no', 'Norsk'], ['pl', 'Polski'], ['pt', 'Português'],
    ['ro', 'Română'], ['ru', 'Русский'], ['sk', 'Slovenčina'],
    ['sl', 'Slovenščina'], ['sv', 'Svenska'], ['ta', 'தமிழ்'],
    ['te', 'తెలుగు'], ['th', 'ไทย'], ['tr', 'Türkçe'],
    ['uk', 'Українська'], ['vi', 'Tiếng Việt'], ['zh', '简体中文'],
    ['zh-Hant', '繁體中文']
  ];
  const supported = new Map(LANGUAGES);
  const originalText = new Map();
  const lastRenderedText = new Map();
  const translatedAttributes = new Map();
  const lastRenderedAttributes = new Map();
  const translationCache = new Map();
  const ownTextWrites = new WeakSet();
  let translator = null;
  let targetLanguage = detectTargetLanguage();
  let active = false;
  let busy = false;
  let observer = null;
  let lastUiMessage = '';
  const TARGET_LANGUAGE_KEY = 'runners-rings-supplemental-language';
  const originalDocumentDir = document.documentElement.getAttribute('dir');

  function setDocumentDirection() {
    if (['ar', 'he'].includes(targetLanguage)) {
      document.documentElement.setAttribute('dir', 'rtl');
    } else if (originalDocumentDir === null) {
      document.documentElement.removeAttribute('dir');
    } else {
      document.documentElement.setAttribute('dir', originalDocumentDir);
    }
  }

  const uiLanguage = () =>
    (document.documentElement.lang || 'ja').toLowerCase().startsWith('en')
      ? 'en'
      : 'ja';

  function detectTargetLanguage() {
    try {
      const saved = localStorage.getItem(TARGET_LANGUAGE_KEY);
      if (saved && supported.has(saved)) return saved;
    } catch (_) {}
    const preferences = Array.isArray(navigator.languages) && navigator.languages.length
      ? navigator.languages
      : [navigator.language || 'en'];
    for (const raw of preferences) {
      const value = String(raw).toLowerCase();
      if (value.startsWith('zh')) {
        const traditional = /tw|hk|mo|hant/.test(value);
        return traditional ? 'zh-Hant' : 'zh';
      }
      const code = value.split('-')[0];
      if (supported.has(code)) return code;
    }
    return '';
  }

  function textFor(ja, en) {
    return uiLanguage() === 'en' ? en : ja;
  }

  const panel = document.createElement('div');
  panel.id = 'rrOnDeviceTranslate';
  panel.setAttribute('translate', 'no');
  panel.innerHTML = `
    <style>
      #rrOnDeviceTranslate{position:fixed;z-index:2147483000;right:12px;top:12px;color:#f4f7fb;font:600 12px/1.35 system-ui,sans-serif}
      #rrOnDeviceTranslate .rrt-toggle{width:42px;height:42px;border:1px solid #596b84;border-radius:50%;background:#101d30;color:inherit;padding:0;font:20px/1 system-ui,sans-serif;box-shadow:0 3px 14px #0006;cursor:pointer}
      #rrOnDeviceTranslate .rrt-controls{display:none;align-items:center;gap:6px;margin-top:6px;padding:7px;background:#101d30;border:1px solid #43536b;border-radius:12px;box-shadow:0 3px 14px #0006;max-width:calc(100vw - 24px)}
      #rrOnDeviceTranslate.isOpen .rrt-controls{display:flex}
      #rrOnDeviceTranslate select,#rrOnDeviceTranslate .rrt-translate{min-height:34px;border:1px solid #596b84;border-radius:8px;background:#17283d;color:inherit;padding:6px 9px;font:inherit}
      #rrOnDeviceTranslate button{background:#ff2bd6;color:#10101a;border:0;font-weight:800;cursor:pointer;white-space:nowrap}
      #rrOnDeviceTranslate .rrt-translate{background:#ff2bd6;color:#10101a;border:0;font-weight:800;cursor:pointer;white-space:nowrap}
      #rrOnDeviceTranslate .rrt-translate:disabled{opacity:.65;cursor:wait}
      #rrOnDeviceTranslate .rrt-status{position:absolute;right:0;top:calc(100% + 5px);width:min(360px,calc(100vw - 24px));padding:8px 10px;border-radius:8px;background:#101d30;border:1px solid #43536b;color:#f4f7fb;font-weight:500}
      #rrOnDeviceTranslate[dir="rtl"]{right:auto;left:12px}
      @media(max-width:520px){#rrOnDeviceTranslate{right:8px;top:8px}#rrOnDeviceTranslate .rrt-controls{gap:4px;padding:5px}#rrOnDeviceTranslate select,#rrOnDeviceTranslate .rrt-translate{min-height:32px;padding:5px 7px;font-size:11px}#rrOnDeviceTranslate .rrt-status{right:0;top:calc(100% + 5px)}}
    </style>
    <button id="rrTranslateToggle" class="rrt-toggle" type="button" aria-expanded="false" aria-label="Translation options">🌐</button>
    <div class="rrt-controls">
      <label for="rrTranslateLanguage" class="rrt-label">🌐</label>
      <select id="rrTranslateLanguage" aria-label="Translation language"></select>
      <button id="rrTranslateButton" class="rrt-translate" type="button"></button>
    </div>
    <span id="rrTranslateStatus" class="rrt-status" hidden role="status" aria-live="polite"></span>
  `;
  document.body.append(panel);

  const select = panel.querySelector('#rrTranslateLanguage');
  const button = panel.querySelector('#rrTranslateButton');
  const toggle = panel.querySelector('#rrTranslateToggle');
  const status = panel.querySelector('#rrTranslateStatus');

  for (const [code, nativeName] of LANGUAGES) {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = nativeName;
    select.append(option);
  }
  if (!supported.has(targetLanguage)) targetLanguage = '';
  const chooseOption = document.createElement('option');
  chooseOption.value = '';
  chooseOption.textContent = textFor('他の言語を選択', 'Choose a language');
  select.append(chooseOption);
  select.insertBefore(chooseOption, select.firstChild);
  select.value = targetLanguage;
  select.setAttribute('aria-label', textFor('翻訳先の言語', 'Translation language'));
  panel.dir = ['ar', 'he'].includes(targetLanguage) ? 'rtl' : 'ltr';

  function setStatus(message) {
    lastUiMessage = message || '';
    status.textContent = lastUiMessage;
    status.hidden = !lastUiMessage;
  }

  function updateButton() {
    button.textContent = active
      ? textFor('原文に戻す', 'Show original')
      : textFor('翻訳する', 'Translate');
    button.setAttribute('aria-label', button.textContent);
  }

  function isExcluded(node) {
    const parent = node.parentElement;
    if (!parent || panel.contains(parent)) return true;
    return Boolean(parent.closest(
      'script,style,noscript,textarea,input,select,option,code,pre,svg,canvas,[translate="no"],[contenteditable="true"]'
    ));
  }

  function visibleTextNodes(root = document.body, viewportOnly = false) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (isExcluded(node) || !node.nodeValue.trim()) continue;
      const element = node.parentElement;
      if (!element || element.getClientRects().length === 0) continue;
      if (viewportOnly) {
        const rect = element.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth) continue;
      }
      nodes.push(node);
    }
    return nodes;
  }

  function cacheKey(value) {
    const source = (document.documentElement.lang || 'ja').toLowerCase().startsWith('en') ? 'en' : 'ja';
    return `${source}>${targetLanguage}:${value}`;
  }

  async function translateValue(value) {
    const key = cacheKey(value);
    if (translationCache.has(key)) return translationCache.get(key);
    const result = await translator.translate(value);
    translationCache.set(key, result);
    return result;
  }

  function rememberAndRender(node, source, translated) {
    if (!originalText.has(node)) originalText.set(node, source);
    lastRenderedText.set(node, translated);
    ownTextWrites.add(node);
    node.nodeValue = translated;
  }

  async function translateNodes(nodes, startIndex = 0) {
    for (let i = startIndex; i < nodes.length; i++) {
      const node = nodes[i];
      if (!node.isConnected || isExcluded(node)) continue;
      const previous = lastRenderedText.get(node);
      let source = originalText.has(node) ? originalText.get(node) : node.nodeValue;
      if (previous && node.nodeValue !== previous) {
        source = node.nodeValue;
        originalText.set(node, source);
      }
      if (!source.trim()) continue;
      try {
        const translated = await translateValue(source);
        if (node.isConnected && node.nodeValue !== translated) rememberAndRender(node, source, translated);
      } catch (error) {
        console.warn('[Runner’s Rings translation] Text was skipped.', error);
      }
      if (i % 8 === 7) {
        setStatus(textFor(`翻訳中… ${i + 1}/${nodes.length}`, `Translating… ${i + 1}/${nodes.length}`));
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  }

  function restoreOriginal() {
    if (observer) observer.disconnect();
    for (const [node, source] of originalText) {
      if (node.isConnected && node.nodeValue === lastRenderedText.get(node)) {
        ownTextWrites.add(node);
        node.nodeValue = source;
      }
    }
    for (const [element, attrs] of translatedAttributes) {
      if (!element.isConnected) continue;
      for (const [name, source] of attrs) {
        const rendered = lastRenderedAttributes.get(element)?.get(name);
        if (rendered !== undefined && element.getAttribute(name) === rendered) element.setAttribute(name, source);
      }
    }
    originalText.clear();
    lastRenderedText.clear();
    translatedAttributes.clear();
    lastRenderedAttributes.clear();
    translationCache.clear();
    translator?.destroy?.();
    translator = null;
    active = false;
    busy = false;
    observer = null;
    setDocumentDirection();
    setStatus('');
    updateButton();
  }

  async function startTranslation() {
    if (busy) return;
    targetLanguage = select.value;
    if (!supported.has(targetLanguage)) {
      setStatus(textFor('翻訳する言語を選んでください。', 'Choose a language to translate into.'));
      return;
    }
    panel.dir = ['ar', 'he'].includes(targetLanguage) ? 'rtl' : 'ltr';
    const sourceLanguage = (document.documentElement.lang || 'ja').toLowerCase().startsWith('en') ? 'en' : 'ja';
    if (sourceLanguage === targetLanguage) {
      setStatus(textFor('日本語・英語は正規表示です。言語を選び直してください。', 'Japanese and English are the official versions. Choose another language.'));
      return;
    }
    if (!('Translator' in self) || typeof Translator.create !== 'function') {
      setStatus(textFor(
        'この端末のサイト内翻訳には対応していません。ブラウザーのメニューから「ページを翻訳」を選んでください。',
        'In-site translation is unavailable on this device. Use your browser menu and choose “Translate page.”'
      ));
      return;
    }

    busy = true;
    button.disabled = true;
    setStatus(textFor('端末内で補助翻訳します。初回はChromeが翻訳モデルをダウンロードする場合があります。', 'Supplemental translation runs on your device. Chrome may download a translation model the first time.'));
    try {
      // Call create() directly from the user's click activation. Waiting for an
      // availability() promise first can consume the transient user activation.
      const translatorPromise = Translator.create({
        sourceLanguage,
        targetLanguage,
        monitor(monitor) {
          monitor.addEventListener('downloadprogress', event => {
            const percent = Math.round((event.loaded || 0) * 100);
            setStatus(textFor(`翻訳モデルを準備中… ${percent}%`, `Preparing translation model… ${percent}%`));
          });
        }
      });
      translator = await translatorPromise;
      active = true;
      setDocumentDirection();
      updateButton();
      if (observer) observer.disconnect();
      observer = new MutationObserver(mutations => {
        const pending = [];
        let rescan = false;
        for (const mutation of mutations) {
          if (mutation.type === 'attributes' && mutation.target === document.documentElement && mutation.attributeName === 'lang') {
            restoreOriginal();
            setStatus(textFor('表示言語が変わりました。必要なら補助翻訳をもう一度開始してください。', 'The page language changed. Start supplemental translation again if needed.'));
            return;
          }
          if (mutation.type === 'characterData') {
            const node = mutation.target;
            if (ownTextWrites.has(node)) {
              ownTextWrites.delete(node);
            } else if (!isExcluded(node)) {
              const previous = lastRenderedText.get(node);
              if (!previous || node.nodeValue !== previous) {
                originalText.set(node, node.nodeValue);
                pending.push(node);
              }
            }
          }
          for (const added of mutation.addedNodes || []) {
            if (added.nodeType === Node.TEXT_NODE) {
              if (!isExcluded(added) && added.nodeValue.trim()) pending.push(added);
            } else if (added.nodeType === Node.ELEMENT_NODE && !panel.contains(added)) {
              pending.push(...visibleTextNodes(added, true));
            }
          }
          if (mutation.type === 'attributes') rescan = true;
        }
        if (pending.length) translateNodes([...new Set(pending)]).catch(console.warn);
        else if (rescan) scheduleVisibleTranslation();
      });
      observer.observe(document.documentElement, { childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-expanded', 'lang'], subtree: true });
      const nodes = visibleTextNodes(document.body, true);
      await translateNodes(nodes);
      setStatus(textFor('補助翻訳を表示中です。正確な案内は日本語・英語をご確認ください。', 'Supplemental machine translation is on. Check Japanese or English for authoritative wording.'));
    } catch (error) {
      console.warn('[Runner’s Rings translation] Translation could not start.', error);
      if (originalText.size) restoreOriginal();
      else {
        translator?.destroy?.();
        translator = null;
        active = false;
      }
      setStatus(textFor(
        'この言語の翻訳を開始できませんでした。ブラウザーの翻訳機能をお試しください。',
        'Could not start translation for this language. Try your browser’s page translation.'
      ));
    } finally {
      busy = false;
      button.disabled = false;
      updateButton();
    }
  }

  select.addEventListener('change', () => {
    if (active) restoreOriginal();
    try { localStorage.setItem(TARGET_LANGUAGE_KEY, select.value); } catch (_) {}
    setStatus(textFor('翻訳する言語を選びました。ボタンを押すと翻訳します。', 'Language selected. Press Translate to begin.'));
  });
  toggle.addEventListener('click', () => {
    const open = panel.classList.toggle('isOpen');
    toggle.setAttribute('aria-expanded', String(open));
  });
  let visibleScanTimer = 0;
  function scheduleVisibleTranslation() {
    if (!active || visibleScanTimer) return;
    visibleScanTimer = window.setTimeout(() => {
      visibleScanTimer = 0;
      const pending = visibleTextNodes(document.body, true).filter(node => !lastRenderedText.has(node));
      if (pending.length) translateNodes(pending).catch(console.warn);
    }, 120);
  }
  window.addEventListener('scroll', scheduleVisibleTranslation, { passive: true });
  window.addEventListener('resize', scheduleVisibleTranslation, { passive: true });
  button.addEventListener('click', () => {
    if (active) restoreOriginal();
    else startTranslation();
  });
  updateButton();
  setStatus(textFor(
    '補助言語を選ぶと、端末内で翻訳します。ページの文章はRunner’s Ringsの翻訳サーバーへ送りません。初回はChromeがモデルをダウンロードする場合があります。',
    'Choose a language for on-device supplemental translation. Page text is not sent to a Runner’s Rings translation server. Chrome may download a model the first time.'
  ));
})();
