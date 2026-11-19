/* Atlas standalone: expose existing regional sections without duplicating cards.
 * The canonical renderer already shows the first five prefectures and provides
 * its own "remaining" control. Reuse it; never create a second Show All button.
 */
(function () {
  'use strict';
  if (!document.documentElement.classList.contains('rrAtlasEmbedded')) return;
  const prefectures = document.getElementById('prefectureSection');
  const cities = document.getElementById('citySection');
  if (prefectures) prefectures.open = true;
  if (cities) cities.open = true;
})();
