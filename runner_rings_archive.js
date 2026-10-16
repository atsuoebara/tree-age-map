/* Runner's Rings shared lightweight navigation additions. */
(() => {
  function addRingsTodayLinks() {
    if (!document.getElementById('ringsTodayDashboardLink')) {
      const territoryAnchor = document.querySelector('#appRoot .dashboardFeatureGroup a[href="./territory.html"]');
      const territoryGroup = territoryAnchor?.closest('.dashboardFeatureGroup');
      if (territoryGroup) {
        const link = document.createElement('a');
        link.id = 'ringsTodayDashboardLink';
        link.href = './today.html';
        link.style.cssText = 'display:block;margin:0 0 18px;padding:18px 20px;border:3px solid #78eaff;border-radius:16px;background:linear-gradient(135deg,rgba(120,234,255,.34),#12374a 52%,#203a55);color:#fff;text-decoration:none;font-size:18px;font-weight:900;line-height:1.55';
        link.innerHTML = '🩵 Rings Today <span style="display:block;margin-top:2px;font-size:14px;font-weight:600"><span data-lang="ja">今日、世界のどこが走られた？ →</span><span data-lang="en">Where did runners go today? →</span></span>';
        territoryGroup.insertAdjacentElement('afterend', link);
      }
    }

    if (!document.getElementById('ringsTodayPublicLink')) {
      const publicTerritory = document.querySelector('#authArea .authPublicLink[href="./territory.html"]');
      if (publicTerritory) {
        const link = document.createElement('a');
        link.id = 'ringsTodayPublicLink';
        link.className = 'authPublicLink';
        link.href = './today.html';
        link.style.cssText = 'border:2px solid #78eaff;background:linear-gradient(135deg,#12374a,#203a55);color:#fff;font-weight:800';
        link.innerHTML = '🩵 Rings Today｜<span data-lang="ja">今日、世界のどこが走られた？ →</span><span data-lang="en">Where did runners go today? →</span>';
        publicTerritory.insertAdjacentElement('afterend', link);
      }
    }

    if (!document.querySelector('footer a[href="./today.html"]')) {
      const territoryFooter = document.querySelector('footer a[href="./territory.html"]');
      if (territoryFooter) {
        const link = document.createElement('a');
        link.href = './today.html';
        link.textContent = 'Rings Today';
        territoryFooter.insertAdjacentElement('afterend', link);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addRingsTodayLinks, { once: true });
  } else {
    addRingsTodayLinks();
  }
})();
