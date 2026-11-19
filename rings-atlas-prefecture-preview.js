/* Rings Atlas standalone preview: show five existing prefecture cards at first.
 * Presentation only; no network, persistence, duplicated region data or new filtering.
 */
(function () {
  'use strict';
  if (!document.documentElement.classList.contains('rrAtlasEmbedded')) return;
  const section = document.getElementById('prefectureSection');
  const list = document.getElementById('prefectureList');
  if (!section || !list) return;
  const more = document.createElement('button');
  more.id = 'rrAtlasShowMorePrefectures';
  more.type = 'button';
  more.hidden = true;
  more.setAttribute('aria-controls', 'prefectureList');
  more.setAttribute('aria-expanded', 'false');
  section.appendChild(more);

  let expanded = false;
  function render() {
    const count = list.querySelectorAll(':scope > .prefectureCard').length;
    // Never hide a result when fewer than six are present, including loading/empty.
    list.classList.toggle('rrAtlasPreviewLimited', !expanded && count > 5);
    more.hidden = count <= 5;
    more.setAttribute('aria-expanded', String(expanded));
    const english = document.documentElement.lang === 'en';
    more.textContent = expanded
      ? (english ? 'Show first 5 regions' : '最初の5地域に戻す')
      : (english ? 'Show all regions (' + count + ')' : 'すべての地域を表示（' + count + '件）');
  }
  more.addEventListener('click', () => {
    expanded = !expanded;
    render();
  });
  new MutationObserver(render).observe(list, {childList:true});
  new MutationObserver(render).observe(document.documentElement, {
    attributes:true, attributeFilter:['lang']
  });
  // Open the existing list, rather than manufacturing five summary cards.
  section.open = true;
  render();
})();
