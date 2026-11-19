/* Put the one existing account control beside the Runner's Rings title.
 * Keep the canonical auth lifecycle in index.html; do not duplicate credentials,
 * listeners, profile IDs or user data.
 */
(function () {
  'use strict';
  const header = document.querySelector('header');
  const slot = document.getElementById('rrHeaderAccount');
  const profile = document.getElementById('accountProfileArea');
  const root = document.getElementById('appRoot');
  const auth = document.getElementById('authArea');
  if (!header || !slot || !profile || !root || !auth) return;
  slot.hidden = true;
  slot.appendChild(profile);
  function sync() {
    // The existing authentication routine controls these two roots.
    const signedIn = getComputedStyle(root).display !== 'none' &&
                     getComputedStyle(auth).display === 'none';
    slot.hidden = !signedIn;
    header.classList.toggle('rrHasAccount', signedIn);
  }
  const observer = new MutationObserver(sync);
  for (const element of [root, auth]) {
    observer.observe(element, {
      attributes: true,
      attributeFilter: ['style','hidden','class']
    });
  }
  window.addEventListener('pageshow', sync);
  sync();
})();
