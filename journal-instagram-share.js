/* Runner's Rings Journal: Instagram-friendly image sharing. No logo or image editing. */
(function () {
  'use strict';
  const ja = (lang, a, b) => lang === 'ja' ? a : b;
  function button(label) { const b=document.createElement('button'); b.type='button'; b.textContent=label; return b; }
  function imageUrl(src) {
    try { const u = new URL(src, location.href); return u.protocol==='https:' || (u.origin===location.origin && u.protocol==='http:') ? u.href : null; } catch (_) { return null; }
  }
  function attach(row, options) {
    const {url, image, lang, status} = options;
    const img = imageUrl(image);
    const control = button(ja(lang,'Instagram用に共有','Share for Instagram'));
    const copy = button(ja(lang,'記事URLをコピー','Copy article URL'));
    copy.addEventListener('click', async () => {
      try {
        if (!navigator.clipboard || !window.isSecureContext) throw new Error('clipboard unavailable');
        await navigator.clipboard.writeText(url);
        status.textContent=ja(lang,'記事URLをコピーしました。Instagramのリンクスタンプに貼ってね。','Article URL copied. Add it with Instagram’s link sticker.');
      } catch (_) { window.prompt(ja(lang,'記事URLをコピー','Copy article URL'),url); }
    });
    row.append(control,copy);
    if (!img) {
      control.disabled=true;
      control.title=ja(lang,'この記事には共有用画像がありません','This article has no shareable image');
      return;
    }
    const save = document.createElement('a');
    save.href=img; save.target='_blank'; save.rel='noopener noreferrer';
    save.textContent=ja(lang,'画像を開く・保存','Open / save image');
    row.append(save);
    let busy=false;
    control.addEventListener('click',async () => {
      if (busy) return;
      busy=true;control.disabled=true;
      try {
        // Existing journal images are reused without cropping or modifying the embedded logo.
        const response=await fetch(img,{mode:'cors'});
        if (!response.ok) throw new Error('Image fetch failed');
        const blob=await response.blob();
        const mime = blob.type === 'image/png' ? 'image/png' : blob.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
        const file=new File([blob],'runners-rings-journal.'+(mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg'),{type:mime});
        if (!navigator.share || !navigator.canShare || !navigator.canShare({files:[file]})) throw new Error('File share unavailable');
        await navigator.share({files:[file]});
        status.textContent=ja(lang,'画像を共有しました。記事リンクは「記事URLをコピー」から取得できます。','Image shared. Use Copy article URL for the story link.');
      } catch (error) {
        if (error && error.name==='AbortError') return;
        status.textContent=ja(lang,'画像共有に対応していません。「画像を開く・保存」から保存し、Instagramで選択してください。','Image sharing is unavailable here. Open/save the image, then select it in Instagram.');
      } finally { busy=false;control.disabled=false; }
    });
  }
  window.RRJournalInstagram={attach};
})();
