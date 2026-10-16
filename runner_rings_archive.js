/* Runner's Rings shared lightweight navigation and onboarding additions. */
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

  function enhanceImportGuides() {
    document.querySelectorAll('.setupGuideOptions').forEach((options, index) => {
      if (options.dataset.rrRecommended === '1') return;
      options.dataset.rrRecommended = '1';

      const guide = document.createElement('div');
      guide.className = 'rrImportRecommendation';
      guide.style.cssText = 'margin:0 0 12px;padding:14px;border:2px solid #78eaff;border-radius:14px;background:linear-gradient(135deg,rgba(120,234,255,.12),rgba(255,43,214,.08));color:#fff;line-height:1.55';
      guide.innerHTML = `
        <div style="font-size:14px;font-weight:900;margin-bottom:9px">⌚ まず、使っているウォッチから選んでください</div>
        <div style="display:grid;gap:8px;font-size:12px">
          <div><strong style="color:#78eaff">COROS</strong><br>→ <strong>COROS連携がおすすめ</strong>。COROSから直接取り込みます。</div>
          <div><strong style="color:#78eaff">Garmin・Apple Watch・Suunto・Polar・その他</strong><br>→ <strong>Strava連携がおすすめ</strong>。まずStravaへ同期してRunner's Ringsとつなぎます。</div>
          <div><strong style="color:#78eaff">過去のランもまとめて取り込みたい</strong><br>→ <strong>Intervals.icuがおすすめ</strong>。昔の記録を追加するときに便利です。</div>
          <div><strong style="color:#78eaff">Garmin Connect IQ</strong><br>→ 対応機種向けの方法です。Garminの基本案内はStrava連携です。</div>
        </div>
        <div style="margin-top:9px;padding-top:9px;border-top:1px solid rgba(255,255,255,.12);font-size:11px;color:#b9c6d6">※ 同じランの重複を避けるため、普段使う自動連携は基本的に1つを選んでください。</div>
      `;
      options.insertAdjacentElement('beforebegin', guide);

      const cards = [...options.querySelectorAll('.setupGuideOption')];
      const updateCard = (match, title, description) => {
        const card = cards.find(el => el.querySelector('strong')?.textContent.includes(match));
        if (!card) return;
        const strong = card.querySelector('strong');
        const span = card.querySelector('span');
        if (strong) strong.textContent = title;
        if (span) span.textContent = description;
      };
      updateCard('Strava', 'Strava｜Garminなどにおすすめ', 'Garmin・Apple Watch・Suunto・Polarなど。普段の自動連携はこちらが基本です。');
      updateCard('Intervals.icu', 'Intervals.icu｜過去データにおすすめ', '昔のランニング履歴をまとめて追加したい場合におすすめです。');
      updateCard('COROS', 'COROS｜COROSユーザーにおすすめ', 'COROSを使っている方は、Runner\'s Ringsへ直接取り込みます。');
      updateCard('Garmin Connect IQ', 'Garmin Connect IQ｜対応機種向け', '対応ウォッチから直接送信できます。Garminの基本案内はStravaです。');
      updateCard('FIT・GPX・TCX・ZIP', 'FIT・GPX・TCX・ZIP｜ファイルを持っている方', '手元のランニングファイルを直接取り込みます。');

      if (index === 0) guide.id = 'rrImportRecommendationAuth';
    });
  }

  function boot() {
    addRingsTodayLinks();
    enhanceImportGuides();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
