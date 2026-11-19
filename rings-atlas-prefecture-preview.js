/* Rings Atlas only: keep the existing region disclosures open on initial load
 * and after the canonical period renderer relocates/rebuilds their contents.
 * Do not clone user data, fetch, persist, or alter the normal dashboard.
 */
(function () {
  'use strict';
  if (!document.documentElement.classList.contains('rrAtlasEmbedded')) return;
  const atlas = document.getElementById('rrAtlasView');
  const root = document.getElementById('appRoot');
  if (!atlas || !root) return;
  let pending = false;
  function showRegions() {
    pending = false;
    // The canonical login gate and regional view decide private visibility.
    if (atlas.hidden || root.hidden) return;
    for (const id of ['prefectureSection','citySection']) {
      const section = document.getElementById(id);
      if (section && section.isConnected && !section.open) section.open = true;
    }
    // Old cached preview code could leave an extra, conflicting toggle.
    const obsolete = document.getElementById('rrAtlasShowMorePrefectures');
    if (obsolete) obsolete.remove();
  }
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(showRegions);
  }
  // Observe structural changes only: the renderer can move the same <details>
  // to a newly created country-flow container on ALL/year/month changes.
  new MutationObserver(schedule).observe(root, {childList:true, subtree:true});
  new MutationObserver(schedule).observe(atlas, {
    attributes:true, attributeFilter:['hidden']
  });
  window.addEventListener('pageshow', schedule);
  schedule();
})();
