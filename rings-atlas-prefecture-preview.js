/* In the standalone Atlas, display municipality cards immediately.
 * The canonical renderer supplies distance order and "remaining" button;
 * show its first five rows here, while leaving home at ten.
 */
(function () {
  'use strict';
  if (!document.documentElement.classList.contains('rrAtlasEmbedded')) return;
  const prefectures = document.getElementById('prefectureSection');
  const cities = document.getElementById('citySection');
  if (prefectures) prefectures.open = false;
  if (cities) cities.open = true;
})();
