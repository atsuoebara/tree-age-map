/* Rings Atlas – same-document geographic detail view.
 * Reuses the EXISTING six DOM nodes, not copies or new data requests.
 * Does not read private data, call APIs, or use persistent storage.
 */
(function () {
  'use strict';
  const ids = ['countryHeading','countryList','regionSection','admin2Section','prefectureSection','citySection'];
  const home = document.getElementById('dashboard');
  const atlas = document.getElementById('rrAtlasView');
  const slot = document.getElementById('rrAtlasHomeEnd');
  const content = document.getElementById('rrAtlasContent');
  const openButton = document.getElementById('rrAtlasOpen');
  const closeButton = document.getElementById('rrAtlasClose');
  if (!home || !atlas || !slot || !content || !openButton || !closeButton ||
      ids.some(id => !document.getElementById(id))) return;

  // Only the one existing authenticated index document runs inside the Atlas page.
  const embedded = !!(document.documentElement &&
      document.documentElement.classList.contains('rrAtlasEmbedded'));
  let active = false;
  function authenticated() {
    // Auth continues to be owned by index.html. Merely guard against
    // accidentally exposing the private view when the app root is hidden.
    const root = document.getElementById('appRoot');
    return !!root && !root.hidden && getComputedStyle(root).display !== 'none';
  }
  // The canonical map stays outside #dashboard, but a layout switch can
  // still leave stale Leaflet dimensions on mobile Safari. Reuse the
  // existing Leaflet instance; never create a second map or fetch data.
  function refreshMapLayout() {
    requestAnimationFrame(() => {
      if (typeof map !== 'undefined' && map &&
          typeof map.invalidateSize === 'function') {
        map.invalidateSize({pan:false, animate:false});
      }
    });
  }
  function setAtlasView(next, focus) {
    if (next && !authenticated()) return;
    if (next === active) return;
    const nodes = ids.map(id => document.getElementById(id));
    if (next) {
      nodes.forEach(node => content.appendChild(node));
      home.hidden = true;
      atlas.hidden = false;
      openButton.setAttribute('aria-expanded', 'true');
      active = true;
      refreshMapLayout();
      if (focus) {
        atlas.scrollIntoView({block:'start',behavior:'auto'});
        closeButton.focus({preventScroll:true});
      }
    } else {
      nodes.forEach(node => slot.parentNode.insertBefore(node,slot));
      atlas.hidden = true;
      home.hidden = false;
      openButton.setAttribute('aria-expanded', 'false');
      active = false;
      refreshMapLayout();
      if (focus) {
        home.scrollIntoView({block:'start',behavior:'auto'});
        openButton.focus({preventScroll:true});
      }
    }
  }
  openButton.addEventListener('click', () => setAtlasView(true,true));
  closeButton.addEventListener('click', () => setAtlasView(false,true));
  document.addEventListener('keydown', event => {
    if (!embedded && active && event.key === 'Escape') {event.preventDefault();setAtlasView(false,true);}
  });
  // A private view must never be restored without a fresh authentication
  // decision after Safari bfcache. Return to existing home state.
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    if (active) setAtlasView(false,false);
    // Always re-run the canonical auth lifecycle after bfcache on the separate route.
    if (embedded) window.location.reload();
  });
  // Sign-out handling remains the canonical index.html flow. The observer
  // does not fetch, render, or retain any activity data.
  const root = document.getElementById('appRoot');
  const observer = new MutationObserver(() => {
    if (active && !authenticated()) setAtlasView(false,false);
    else if (embedded && !active && authenticated()) setAtlasView(true,false);
  });
  if (root) observer.observe(root,{attributes:true,attributeFilter:['style','hidden','class']});
  if (embedded && authenticated()) setAtlasView(true,false);
})();
