/* Runner's Rings: central advertising gate. No network requests while disabled. */
(()=>{
  'use strict';
  const enabled = false; // independent audit and deployment approval required
  if (!enabled || window.self !== window.top || !document.body) return;
  if (document.querySelector('.rr-admax-slot')) return;
  const wrap = document.createElement('div');
  wrap.className = 'rr-admax-slot';
  wrap.style.cssText = 'box-sizing:border-box;width:320px;max-width:100%;height:50px;margin:24px auto;overflow:hidden';
  const frame = document.createElement('iframe');
  frame.width = '320';
  frame.height = '50';
  frame.style.cssText = 'display:block;border:0;width:320px;height:50px';
  frame.loading = 'lazy';
  frame.title = 'Advertisement';
  frame.referrerPolicy = 'no-referrer';
  frame.setAttribute('sandbox','allow-scripts');
  // Popup capabilities require provider approval and a separate activation change.
  document.body.appendChild(wrap);
  // Do not load an undersized frame or crop a real ad.
  if (wrap.getBoundingClientRect().width < 320) { wrap.remove(); return; }
  frame.src = 'https://ads.runnersrings.com/frame/sp01';
  wrap.appendChild(frame);
})();
