/**
 * Rings Journal static-page generator.
 * Run by .github/workflows/journal-generate.yml.
 * DRY_RUN=true (the workflow default) checks output without writing any files.
 * Only explicitly published rows are included.
 */
import { mkdir, writeFile, readdir, readFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const DRY_RUN = process.env.DRY_RUN !== 'false';
const FIXTURE_PREVIEW = process.env.FIXTURE_PREVIEW === 'true';
const API_URL = (process.env.JOURNAL_SUPABASE_URL || '').replace(/\/+$/, '');
const API_KEY = process.env.JOURNAL_SUPABASE_PUBLISHABLE_KEY || '';
const OUT_DIR = resolve('journal/articles');
const SITE = 'https://runnersrings.com';
const PER_PAGE = 500;

if (!FIXTURE_PREVIEW && !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(API_URL)) {
  throw new Error('JOURNAL_SUPABASE_URL is missing or not a Supabase HTTPS project URL');
}
if (!FIXTURE_PREVIEW && !API_KEY) throw new Error('JOURNAL_SUPABASE_PUBLISHABLE_KEY is missing');

function html(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
// Approved, static affiliate placements for published articles. Never store HTML in journal_posts.
// Isolated by slug and language; blocks are sourced from the audited PR #63 article diffs.
const AFFILIATE_BLOCKS = {
  "journal-20260927-221326-00b55b1a": {
    "ja": "<aside class=\"rr-affiliate-block\" aria-label=\"アフィリエイト商品紹介\" style=\"border:1px solid #8c939d;border-radius:10px;padding:1rem;margin:1.5rem 0;line-height:1.75\"><strong>筆者の使用ウォッチ</strong><p>筆者（Atsuo）が普段使っているのは、Garmin の <a href=\"https://www.amazon.co.jp/dp/B0GZ294HH3?tag=kidthephantom-22\" target=\"_blank\" rel=\"sponsored noopener noreferrer\">Forerunner 170</a> です。この記事の記録画面も、このウォッチで計測したものが元になっています。</p><p>ゼビオ公式通販：<a href=\"https://px.a8.net/svt/ejp?a8mat=4BEHXA+5DHWDU+4ABU+BW8O2&amp;a8ejpredirect=https%3A%2F%2Fwww.supersports.com%2Fja-jp%2Fxebio%2Fproducts%2FA-10924426501%2F\" target=\"_blank\" rel=\"sponsored noopener noreferrer\">Garmin Forerunner 170</a></p><img src=\"https://www14.a8.net/0.gif?a8mat=4BEHXA+5DHWDU+4ABU+BW8O2\" width=\"1\" height=\"1\" alt=\"\" loading=\"lazy\" style=\"border:0\" /><p style=\"font-size:.85rem;margin:.7rem 0 0\">【広告】この記事にはAmazon・A8.netなどのアフィリエイトリンクが含まれます。リンク経由で購入された場合、運営者が紹介料を受け取ることがあります。</p><p style=\"font-size:.8rem;margin:.4rem 0 0\">Amazonのアソシエイトとして、Runner's Rings は適格販売により収入を得ています</p></aside>",
    "en": "<aside class=\"rr-affiliate-block\" aria-label=\"Affiliate product information\" style=\"border:1px solid #8c939d;border-radius:10px;padding:1rem;margin:1.5rem 0;line-height:1.75\"><strong>Watch used by the author</strong><p>Atsuo regularly uses the Garmin <a href=\"https://www.amazon.co.jp/dp/B0GZ294HH3?tag=kidthephantom-22\" target=\"_blank\" rel=\"sponsored noopener noreferrer\">Forerunner 170</a>. The recording screen shown in this article is based on data captured with this watch.</p><p>Xebio official store：<a href=\"https://px.a8.net/svt/ejp?a8mat=4BEHXA+5DHWDU+4ABU+BW8O2&amp;a8ejpredirect=https%3A%2F%2Fwww.supersports.com%2Fja-jp%2Fxebio%2Fproducts%2FA-10924426501%2F\" target=\"_blank\" rel=\"sponsored noopener noreferrer\">Garmin Forerunner 170</a></p><img src=\"https://www14.a8.net/0.gif?a8mat=4BEHXA+5DHWDU+4ABU+BW8O2\" width=\"1\" height=\"1\" alt=\"\" loading=\"lazy\" style=\"border:0\" /><p style=\"font-size:.85rem;margin:.7rem 0 0\">Advertisement / Affiliate Disclosure: This article contains Amazon and A8.net affiliate links. We may earn a commission from qualifying purchases.</p><p style=\"font-size:.8rem;margin:.4rem 0 0\">As an Amazon Associate, Runner's Rings earns from qualifying purchases.</p></aside>"
  },
  "journal-20261018-083832-ab6cebf6": {
    "ja": "<aside class=\"rr-affiliate-block\" aria-label=\"アフィリエイト商品紹介\" style=\"border:1px solid #8c939d;border-radius:10px;padding:1rem;margin:1.5rem 0;line-height:1.75\"><strong>筆者のレース補給</strong><p>参考までに、筆者がレースで携帯しているのは <a href=\"https://www.amazon.co.jp/dp/B0FVSK9LN8?tag=kidthephantom-22\" target=\"_blank\" rel=\"sponsored noopener noreferrer\">オレは摂取す</a> と <a href=\"https://www.amazon.co.jp/dp/B07GN7G7CF?tag=kidthephantom-22\" target=\"_blank\" rel=\"sponsored noopener noreferrer\">WINZONE エナジージェル（パイナップル味）</a> です。ジェルは胃腸との相性に個人差が大きいので、どれを使うにしても本番前に練習で試しておくことが大切です。</p><p>楽天市場：<a href=\"https://rpx.a8.net/svt/ejp?a8mat=4BEFL5+CVSP0Y+2HOM+BWGDT&amp;rakuten=y&amp;a8ejpredirect=https%3A%2F%2Fhb.afl.rakuten.co.jp%2Fhgc%2Fg00qant4.5bg7d3c0.g00qant4.5bg7ed63%2Fa26101370185_4BEFL5_CVSP0Y_2HOM_BWGDT%3Fpc%3Dhttps%253A%252F%252Fitem.rakuten.co.jp%252Ffood-exchange%252F1729358177%252F%26m%3Dhttp%253A%252F%252Fm.rakuten.co.jp%252Ffood-exchange%252Fi%252F10001729%252F%26rafcid%3Dwsc_i_is_5673e9dc-a3ef-4b93-a80e-26542cc9ce37\" target=\"_blank\" rel=\"sponsored noopener noreferrer\">オレは摂取す エナジージェル（選べる2味セット）</a></p><img src=\"https://www19.a8.net/0.gif?a8mat=4BEFL5+CVSP0Y+2HOM+BWGDT\" width=\"1\" height=\"1\" alt=\"\" loading=\"lazy\" style=\"border:0\" /><p style=\"font-size:.85rem;margin:.7rem 0 0\">【広告】この記事にはAmazon・A8.netなどのアフィリエイトリンクが含まれます。リンク経由で購入された場合、運営者が紹介料を受け取ることがあります。</p><p style=\"font-size:.8rem;margin:.4rem 0 0\">Amazonのアソシエイトとして、Runner's Rings は適格販売により収入を得ています</p></aside>",
    "en": "<aside class=\"rr-affiliate-block\" aria-label=\"Affiliate product information\" style=\"border:1px solid #8c939d;border-radius:10px;padding:1rem;margin:1.5rem 0;line-height:1.75\"><strong>Race fuel carried by the author</strong><p>Atsuo carries <a href=\"https://www.amazon.co.jp/dp/B0FVSK9LN8?tag=kidthephantom-22\" target=\"_blank\" rel=\"sponsored noopener noreferrer\">Ore wa Sesshu Su energy gel</a> and <a href=\"https://www.amazon.co.jp/dp/B07GN7G7CF?tag=kidthephantom-22\" target=\"_blank\" rel=\"sponsored noopener noreferrer\">WINZONE Energy Gel (pineapple)</a> during races. Gel tolerance varies from person to person, so test your preferred products during training before race day.</p><p>Rakuten Ichiba：<a href=\"https://rpx.a8.net/svt/ejp?a8mat=4BEFL5+CVSP0Y+2HOM+BWGDT&amp;rakuten=y&amp;a8ejpredirect=https%3A%2F%2Fhb.afl.rakuten.co.jp%2Fhgc%2Fg00qant4.5bg7d3c0.g00qant4.5bg7ed63%2Fa26101370185_4BEFL5_CVSP0Y_2HOM_BWGDT%3Fpc%3Dhttps%253A%252F%252Fitem.rakuten.co.jp%252Ffood-exchange%252F1729358177%252F%26m%3Dhttp%253A%252F%252Fm.rakuten.co.jp%252Ffood-exchange%252Fi%252F10001729%252F%26rafcid%3Dwsc_i_is_5673e9dc-a3ef-4b93-a80e-26542cc9ce37\" target=\"_blank\" rel=\"sponsored noopener noreferrer\">Ore wa Sesshu Su energy gel (two-flavor set)</a></p><img src=\"https://www19.a8.net/0.gif?a8mat=4BEFL5+CVSP0Y+2HOM+BWGDT\" width=\"1\" height=\"1\" alt=\"\" loading=\"lazy\" style=\"border:0\" /><p style=\"font-size:.85rem;margin:.7rem 0 0\">Advertisement / Affiliate Disclosure: This article contains Amazon and A8.net affiliate links. We may earn a commission from qualifying purchases.</p><p style=\"font-size:.8rem;margin:.4rem 0 0\">As an Amazon Associate, Runner's Rings earns from qualifying purchases.</p></aside>"
  },
  "journal-20261103-160001-899a9d1d": {
    "ja": "<aside class=\"rr-affiliate-block\" aria-label=\"アフィリエイト商品紹介\" style=\"border:1px solid #8c939d;border-radius:10px;padding:1rem;margin:1.5rem 0;line-height:1.75\"><strong>使用ギア</strong><ul><li>ウォッチ：<a href=\"https://www.amazon.co.jp/dp/B0GZ294HH3?tag=kidthephantom-22\" target=\"_blank\" rel=\"sponsored noopener noreferrer\">Garmin Forerunner 170</a></li><li>シューズ：ASICS メタスピードエッジ TOKYO（Green Gecko/Black、1013A163.300） <a href=\"https://px.a8.net/svt/ejp?a8mat=4BEHXA+5DHWDU+4ABU+BW8O2&amp;a8ejpredirect=https%3A%2F%2Fwww.supersports.com%2Fja-jp%2Fxebio%2Fproducts%2FA-10897630501%2F\" target=\"_blank\" rel=\"sponsored noopener noreferrer\">ゼビオ公式通販</a></li><li>ジェル：<a href=\"https://www.amazon.co.jp/dp/B0FVSK9LN8?tag=kidthephantom-22\" target=\"_blank\" rel=\"sponsored noopener noreferrer\">オレは摂取す</a>／<a href=\"https://www.amazon.co.jp/dp/B07GN7G7CF?tag=kidthephantom-22\" target=\"_blank\" rel=\"sponsored noopener noreferrer\">WINZONE エナジージェル（パイナップル味）</a></li><li>ゼビオ公式・ウォッチ：<a href=\"https://px.a8.net/svt/ejp?a8mat=4BEHXA+5DHWDU+4ABU+BW8O2&amp;a8ejpredirect=https%3A%2F%2Fwww.supersports.com%2Fja-jp%2Fxebio%2Fproducts%2FA-10924426501%2F\" target=\"_blank\" rel=\"sponsored noopener noreferrer\">Garmin Forerunner 170</a></li><li>楽天市場・ジェル：<a href=\"https://rpx.a8.net/svt/ejp?a8mat=4BEFL5+CVSP0Y+2HOM+BWGDT&amp;rakuten=y&amp;a8ejpredirect=https%3A%2F%2Fhb.afl.rakuten.co.jp%2Fhgc%2Fg00qant4.5bg7d3c0.g00qant4.5bg7ed63%2Fa26101370185_4BEFL5_CVSP0Y_2HOM_BWGDT%3Fpc%3Dhttps%253A%252F%252Fitem.rakuten.co.jp%252Ffood-exchange%252F1729358177%252F%26m%3Dhttp%253A%252F%252Fm.rakuten.co.jp%252Ffood-exchange%252Fi%252F10001729%252F%26rafcid%3Dwsc_i_is_5673e9dc-a3ef-4b93-a80e-26542cc9ce37\" target=\"_blank\" rel=\"sponsored noopener noreferrer\">オレは摂取す（選べる2味セット）</a></li></ul><img src=\"https://www14.a8.net/0.gif?a8mat=4BEHXA+5DHWDU+4ABU+BW8O2\" width=\"1\" height=\"1\" alt=\"\" loading=\"lazy\" style=\"border:0\" /><img src=\"https://www19.a8.net/0.gif?a8mat=4BEFL5+CVSP0Y+2HOM+BWGDT\" width=\"1\" height=\"1\" alt=\"\" loading=\"lazy\" style=\"border:0\" /><p style=\"font-size:.85rem;margin:.7rem 0 0\">【広告】この記事にはAmazon・A8.netなどのアフィリエイトリンクが含まれます。リンク経由で購入された場合、運営者が紹介料を受け取ることがあります。</p><p style=\"font-size:.8rem;margin:.4rem 0 0\">Amazonのアソシエイトとして、Runner's Rings は適格販売により収入を得ています</p></aside>",
    "en": "<aside class=\"rr-affiliate-block\" aria-label=\"Affiliate product information\" style=\"border:1px solid #8c939d;border-radius:10px;padding:1rem;margin:1.5rem 0;line-height:1.75\"><strong>Gear used</strong><ul><li>Watch: <a href=\"https://www.amazon.co.jp/dp/B0GZ294HH3?tag=kidthephantom-22\" target=\"_blank\" rel=\"sponsored noopener noreferrer\">Garmin Forerunner 170</a></li><li>Shoes: ASICS METASPEED EDGE TOKYO (Green Gecko/Black, 1013A163.300) <a href=\"https://px.a8.net/svt/ejp?a8mat=4BEHXA+5DHWDU+4ABU+BW8O2&amp;a8ejpredirect=https%3A%2F%2Fwww.supersports.com%2Fja-jp%2Fxebio%2Fproducts%2FA-10897630501%2F\" target=\"_blank\" rel=\"sponsored noopener noreferrer\">Xebio official store</a></li><li>Gels: <a href=\"https://www.amazon.co.jp/dp/B0FVSK9LN8?tag=kidthephantom-22\" target=\"_blank\" rel=\"sponsored noopener noreferrer\">Ore wa Sesshu Su</a> / <a href=\"https://www.amazon.co.jp/dp/B07GN7G7CF?tag=kidthephantom-22\" target=\"_blank\" rel=\"sponsored noopener noreferrer\">WINZONE Energy Gel (pineapple)</a></li><li>Xebio watch：<a href=\"https://px.a8.net/svt/ejp?a8mat=4BEHXA+5DHWDU+4ABU+BW8O2&amp;a8ejpredirect=https%3A%2F%2Fwww.supersports.com%2Fja-jp%2Fxebio%2Fproducts%2FA-10924426501%2F\" target=\"_blank\" rel=\"sponsored noopener noreferrer\">Garmin Forerunner 170</a></li><li>Rakuten gel：<a href=\"https://rpx.a8.net/svt/ejp?a8mat=4BEFL5+CVSP0Y+2HOM+BWGDT&amp;rakuten=y&amp;a8ejpredirect=https%3A%2F%2Fhb.afl.rakuten.co.jp%2Fhgc%2Fg00qant4.5bg7d3c0.g00qant4.5bg7ed63%2Fa26101370185_4BEFL5_CVSP0Y_2HOM_BWGDT%3Fpc%3Dhttps%253A%252F%252Fitem.rakuten.co.jp%252Ffood-exchange%252F1729358177%252F%26m%3Dhttp%253A%252F%252Fm.rakuten.co.jp%252Ffood-exchange%252Fi%252F10001729%252F%26rafcid%3Dwsc_i_is_5673e9dc-a3ef-4b93-a80e-26542cc9ce37\" target=\"_blank\" rel=\"sponsored noopener noreferrer\">Ore wa Sesshu Su (two-flavor set)</a></li></ul><img src=\"https://www14.a8.net/0.gif?a8mat=4BEHXA+5DHWDU+4ABU+BW8O2\" width=\"1\" height=\"1\" alt=\"\" loading=\"lazy\" style=\"border:0\" /><img src=\"https://www19.a8.net/0.gif?a8mat=4BEFL5+CVSP0Y+2HOM+BWGDT\" width=\"1\" height=\"1\" alt=\"\" loading=\"lazy\" style=\"border:0\" /><p style=\"font-size:.85rem;margin:.7rem 0 0\">Advertisement / Affiliate Disclosure: This article contains Amazon and A8.net affiliate links. We may earn a commission from qualifying purchases.</p><p style=\"font-size:.8rem;margin:.4rem 0 0\">As an Amazon Associate, Runner's Rings earns from qualifying purchases.</p></aside>"
  },
  "journal-20261113-142540-82c20494": {
    "ja": "<aside class=\"rr-affiliate-block\" aria-label=\"アフィリエイト商品紹介\" style=\"border:1px solid #8c939d;border-radius:10px;padding:1rem;margin:1.5rem 0;line-height:1.75\"><strong>筆者の使用アイテム</strong><p>この記事で使っているのは、セメダインの靴用補修剤 <a href=\"https://www.amazon.co.jp/dp/B00371H43K?tag=kidthephantom-22\" target=\"_blank\" rel=\"sponsored noopener noreferrer\">シューズドクターN（HC-003）</a> です。踵の外側が擦り減った靴底の補修に、筆者が実際に使っています。</p><p style=\"font-size:.85rem;margin:.7rem 0 0\">【広告】この記事にはAmazonのアフィリエイトリンクが含まれます。リンク経由で購入された場合、運営者が紹介料を受け取ることがあります。</p><p style=\"font-size:.8rem;margin:.4rem 0 0\">Amazonのアソシエイトとして、Runner's Rings は適格販売により収入を得ています</p></aside>",
    "en": "<aside class=\"rr-affiliate-block\" aria-label=\"Affiliate product information\" style=\"border:1px solid #8c939d;border-radius:10px;padding:1rem;margin:1.5rem 0;line-height:1.75\"><strong>What the author uses</strong><p>The repair compound in this article is Cemedine <a href=\"https://www.amazon.co.jp/dp/B00371H43K?tag=kidthephantom-22\" target=\"_blank\" rel=\"sponsored noopener noreferrer\">Shoe Doctor N (HC-003)</a>, which Atsuo actually uses to repair the worn outer heel of his running shoes.</p><p style=\"font-size:.85rem;margin:.7rem 0 0\">Advertisement / Affiliate Disclosure: This article contains an Amazon affiliate link. We may earn a commission from qualifying purchases.</p><p style=\"font-size:.8rem;margin:.4rem 0 0\">As an Amazon Associate, Runner's Rings earns from qualifying purchases.</p></aside>"
  }
};
const AFFILIATE_ANCHORS = {
  "journal-20260927-221326-00b55b1a": {
    "ja": "なお、機種によって利用できるGPS設定や機能は異なります。",
    "en": "Available GPS features and settings vary between devices."
  },
  "journal-20261018-083832-ab6cebf6": {
    "ja": "それもトレーニングの一部です。",
    "en": "It is a strategy that the runner can tolerate and consistently follow."
  }
};
// Only approved support destinations become links; all other text stays HTML-escaped.
function supportLinks(escaped) {
  const pattern = /https:\/\/(?:buymeacoffee\.com\/runnersrings|ofuse\.me\/runnersrings|buy\.stripe\.com\/[A-Za-z0-9]+)/g;
  return escaped.replace(pattern, (url) =>
    `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
}

function articleBodyWithAffiliate(slug, language, body) {
  const escaped = supportLinks(html(body));
  const block = AFFILIATE_BLOCKS[slug]?.[language];
  if (!block) return `<div class="body">${escaped}</div>`;
  const anchor = AFFILIATE_ANCHORS[slug]?.[language];
  if (!anchor) return `<div class="body">${escaped}</div>\n      ${block}`;
  const token = html(anchor);
  const start = escaped.indexOf(token);
  if (start < 0 || escaped.indexOf(token, start + token.length) >= 0) {
    throw new Error(`Affiliate anchor missing or ambiguous: ${slug}/${language}`);
  }
  const split = start + token.length;
  return `<div class="body">${escaped.slice(0, split)}</div>\n      ${block}\n      <div class="body">${escaped.slice(split)}</div>`;
}

function absoluteImage(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || u.origin !== API_URL ||
      !u.pathname.startsWith('/storage/v1/object/public/journal-images/')) return null;
    return u.toString();
  } catch { return null; }
}
function articlePage(post) {
  const slug = post.slug;
  const permalink = `${SITE}/journal/articles/${encodeURIComponent(slug)}/`;
  const titleJa = String(post.title_ja || post.title_en || 'Journal');
  const titleEn = String(post.title_en || post.title_ja || 'Journal');
  const summaryJa = String(post.summary_ja || post.summary_en || '');
  const summaryEn = String(post.summary_en || post.summary_ja || '');
  const bodyJa = String(post.body_ja || post.body_en || '');
  const bodyEn = String(post.body_en || post.body_ja || '');
  const img = absoluteImage(post.image_url);
  const dateObj = new Date(post.published_at);
  if (!Number.isFinite(dateObj.getTime())) throw new Error(`Invalid published_at for ${slug}`);
  const pubDate = dateObj.toISOString().slice(0, 10);
  const ogImage = img ? `\n  <meta property="og:image" content="${html(img)}">\n  <meta name="twitter:image" content="${html(img)}">\n  <meta name="twitter:card" content="summary_large_image">` :
    '  <meta name="twitter:card" content="summary">';
  const visibleImage = img ? `<img class="hero" src="${html(img)}" alt="" loading="lazy">` : '';
  const article = (language, title, summary, body) => `
    <article data-lang="${language}" ${language === 'en' ? 'hidden' : ''}>
      <div class="category">${html(post.category || 'Journal')}</div>
      <time datetime="${pubDate}">${pubDate}</time>
      <h1>${html(title)}</h1>
      ${visibleImage}
      ${summary ? `<p class="summary">${html(summary)}</p>` : ''}
      ${articleBodyWithAffiliate(slug, language, body)}
      <div class="share">
        <button type="button" class="copy">${language === 'ja' ? 'リンクをコピー' : 'Copy link'}</button>
        <button type="button" class="native-share" hidden>${language === 'ja' ? '共有' : 'Share'}</button>
        <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&amp;url=${encodeURIComponent(permalink)}" target="_blank" rel="noopener noreferrer">${language === 'ja' ? 'Xで共有' : 'Share to X'}</a>
      </div><p class="feedback" aria-live="polite"></p>
      <p class="rr-creator-link">${language === 'ja' ? '作っている人' : 'Made by'}：<a href="https://www.instagram.com/atsuoebarun/" target="_blank" rel="noopener noreferrer" aria-label="${language === 'ja' ? 'Atsuo Ebaraの個人Instagram' : 'Atsuo Ebara personal Instagram'}">Atsuo Ebara · Instagram</a><span>${language === 'ja' ? '（個人アカウント）' : ' (personal account)'}</span></p>
      <a class="back" href="/journal.html">${language === 'ja' ? 'Journal一覧へ戻る' : 'Back to Journal'}</a>
    </article>`;
  const jsonLd = JSON.stringify({"@context":"https://schema.org","@type":"BlogPosting","headline":titleJa,"description":summaryJa.slice(0,200),"inLanguage":"ja","datePublished":dateObj.toISOString(),"url":permalink,"mainEntityOfPage":{"@type":"WebPage","@id":permalink},"isPartOf":{"@type":"Blog","name":"Rings Journal","url":"https://runnersrings.com/journal.html"},...(img?{"image":img}:{})}).replace(/</g,'\\u003c');
  return `<!doctype html>
<!-- RR_JOURNAL_GENERATED_PAGE -->
<html lang="ja">
<head>
  <!-- Google Analytics -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-CX6V4G2ML5"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-CX6V4G2ML5');
  </script>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${html(summaryJa.slice(0, 160))}">
  <title>${html(titleJa)} | Rings Journal</title>
  <link rel="canonical" href="${html(permalink)}">
  <link rel="icon" href="/icon.PNG" type="image/png">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Rings Journal">
  <meta property="og:locale" content="ja_JP">
  <meta property="og:url" content="${html(permalink)}">
  <meta property="og:title" content="${html(titleJa)}">
  <meta property="og:description" content="${html(summaryJa.slice(0, 200))}">${ogImage}
  <meta property="article:published_time" content="${html(dateObj.toISOString())}">
  <script type="application/ld+json">${jsonLd}</script>
  <style>
  *{box-sizing:border-box}html,body{margin:0;background:#0b1422;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{min-height:100vh;background:radial-gradient(circle at 85% 5%,rgba(255,43,214,.12),transparent 26%),#0b1422}
  header{background:#0f1d2f;padding:18px 16px;border-bottom:1px solid #28364a}.inner{max-width:760px;margin:auto;display:flex;justify-content:space-between;gap:12px;align-items:center}
  header strong{font-size:19px}button{cursor:pointer;background:#25384e;color:white;border:1px solid #61738a;border-radius:20px;padding:9px 13px;touch-action:manipulation;-webkit-tap-highlight-color:transparent}button.active{background:#ff2bd6;border-color:#ff2bd6}
  main{max-width:760px;margin:auto;padding:35px 16px 65px}article h1{font-size:clamp(23px,5vw,32px);line-height:1.5}.category{font-size:12px;color:#eaff00;font-weight:bold}time{display:block;margin-top:10px;color:#9eacc0;font-size:12px}.summary{font-size:16px;line-height:1.8;color:#d6e0ee}.body{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.95;font-size:15px;color:#c4d0e0;margin:24px 0 38px}.hero{display:block;margin:20px auto;max-width:100%;max-height:600px;object-fit:contain;border-radius:12px}
  .share{display:flex;flex-wrap:wrap;gap:10px}.share a{color:#fff;border:1px solid #61738a;background:#25384e;border-radius:20px;padding:10px 13px;text-decoration:none;font-size:13px;font-weight:bold;touch-action:manipulation;-webkit-tap-highlight-color:transparent}.feedback{min-height:1em;color:#eaff00;font-size:12px}.rr-creator-link{font-size:12px;line-height:1.7;color:#9ba8b9;margin:16px 0 4px}.rr-creator-link a{color:#cbd5e1;text-underline-offset:3px;overflow-wrap:anywhere}.rr-creator-link a:hover{color:#ff2bd6}.back{display:inline-block;color:#fff;text-decoration:none;background:#ff2bd6;border-radius:25px;padding:11px 20px;margin-top:14px;font-size:13px;font-weight:bold}footer{text-align:center;color:#9ba8b9;border-top:1px solid #2b3543;padding:20px;font-size:12px}
  </style>
</head>
<body>
  <header><div class="inner"><strong>Rings Journal</strong><nav><button type="button" id="ja" class="active">日本語</button> <button type="button" id="en">EN</button></nav></div></header>
  <main>${article('ja',titleJa,summaryJa,bodyJa)}${article('en',titleEn,summaryEn,bodyEn)}</main>
  <footer>© 2026 Runner's Rings</footer>
  <script>
  (()=>{
    'use strict';
    const permalink=${JSON.stringify(permalink)};
    const labels={ja:'URLをコピーしました',en:'Link copied'};
    const copyFallback=(text)=>{
      const area=document.createElement('textarea');
      area.value=text;
      area.setAttribute('readonly','');
      area.style.position='fixed';
      area.style.left='-9999px';
      area.style.top='0';
      document.body.appendChild(area);
      area.focus();
      area.select();
      area.setSelectionRange(0,area.value.length);
      let ok=false;
      try{ok=document.execCommand('copy');}catch(_){ok=false;}
      area.remove();
      return ok;
    };
    const copyText=async(text)=>{
      if(navigator.clipboard&&window.isSecureContext){
        try{await navigator.clipboard.writeText(text);return true;}catch(_){}
      }
      return copyFallback(text);
    };
    let lang=localStorage.getItem('runners-rings-language')==='en'?'en':'ja';
    const show=()=>{
      document.documentElement.lang=lang;
      document.querySelectorAll('article[data-lang]').forEach(a=>a.hidden=a.dataset.lang!==lang);
      ['ja','en'].forEach(s=>document.getElementById(s).classList.toggle('active',s===lang));
    };
    ['ja','en'].forEach(s=>document.getElementById(s).addEventListener('click',()=>{lang=s;localStorage.setItem('runners-rings-language',s);show();}));
    document.querySelectorAll('article').forEach(a=>{
      const feedback=a.querySelector('.feedback');
      a.querySelector('.copy').addEventListener('click',async()=>{
        const ok=await copyText(permalink);
        if(ok){feedback.textContent=labels[a.dataset.lang];return;}
        window.prompt(a.dataset.lang==='ja'?'記事URLをコピーしてください':'Copy article URL',permalink);
      });
      if(navigator.share){
        const btn=a.querySelector('.native-share');
        btn.hidden=false;
        btn.addEventListener('click',async()=>{
          try{await navigator.share({title:a.querySelector('h1').textContent,url:permalink});}
          catch(e){if(e.name!=='AbortError')feedback.textContent=a.dataset.lang==='ja'?'共有できませんでした':'Share failed';}
        });
      }
    });
    show();
  })();
  </script>
  <script defer src="/rr-ondevice-translate.js"></script>
</body>
</html>\n`;
}

async function fetchPublished() {
  const all = [];
  for (let offset = 0; ; offset += PER_PAGE) {
    const qs = new URLSearchParams({
      select: 'slug,title_ja,title_en,summary_ja,summary_en,body_ja,body_en,image_url,category,published_at',
      status: 'eq.published', order: 'published_at.desc', limit: String(PER_PAGE), offset: String(offset)
    });
    const response = await fetch(`${API_URL}/rest/v1/journal_posts?${qs}`, {
      headers: { apikey: API_KEY, Authorization: `Bearer ${API_KEY}`, Accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`Supabase query failed: HTTP ${response.status}`);
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error('Supabase did not return an array');
    all.push(...batch);
    if (batch.length < PER_PAGE) break;
    if (all.length > 10000) throw new Error('Unexpectedly many articles; stopping safely');
  }
  return all;
}

// Fixture mode never queries Supabase. It generates an explicitly fictional article
// into a separate preview folder and is never committed to the public site.
const posts = FIXTURE_PREVIEW ? [{
  slug: 'fictional-journal-preview',
  title_ja: '【架空テスト】ランニング日記',
  title_en: '[Fictional test] Running journal',
  summary_ja: '公開されない記事別OGP検証用の架空記事です。',
  summary_en: 'Fictional article for private per-article OGP testing.',
  body_ja: 'これはテスト用の架空記事です。実在のランナーとは関係ありません。',
  body_en: 'This is a fictional test article and does not describe a real runner.',
  image_url: null, category: 'Test', published_at: '2026-09-26T00:00:00Z'
}] : await fetchPublished();
// Validate the entire response before changing public files.
const seen = new Set();
for (const post of posts) {
  const slug = String(post.slug ?? '');
  if (!/^[a-z0-9][a-z0-9_-]{0,119}$/i.test(slug)) throw new Error(`Unsafe or missing article slug: ${slug}`);
  if (seen.has(slug)) throw new Error(`Duplicate slug: ${slug}`);
  if (!Number.isFinite(new Date(post.published_at).getTime())) throw new Error(`Invalid date: ${slug}`);
  seen.add(slug);
}
if (!FIXTURE_PREVIEW && !DRY_RUN) {
  // Delete ONLY directories containing our own generated-page marker. Never touch other files.
  await mkdir(OUT_DIR, { recursive: true });
  for (const entry of await readdir(OUT_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || seen.has(entry.name)) continue;
    const page = join(OUT_DIR, entry.name, 'index.html');
    const contents = await readFile(page, 'utf8').catch(() => '');
    if (contents.includes('<!-- RR_JOURNAL_GENERATED_PAGE -->') || ((contents.includes("Rings Journal") || contents.includes("Runner's Rings Journal")) && contents.includes(`<link rel="canonical" href="${SITE}/journal/articles/${encodeURIComponent(entry.name)}/">`) && contents.includes("document.querySelectorAll('article')"))) {
      await rm(page);
      // Remove empty directory only; unexpected files remain untouched.
      await (await import('node:fs/promises')).rmdir(join(OUT_DIR, entry.name)).catch(() => {});
      console.log(`Removed unpublished article page: ${entry.name}`);
    }
  }
}

for (const post of posts) {
  const slug = String(post.slug ?? '');
  const contents = articlePage(post);
  if (!DRY_RUN) {
    const directory = FIXTURE_PREVIEW ? resolve('journal-preview-artifact', slug) : join(OUT_DIR, slug);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'index.html'), contents, 'utf8');
  }
  console.log(`${DRY_RUN ? '[DRY RUN] Validated' : 'Generated'}: ${slug}`);
}

// Keep sitemap in sync with published Journal rows whenever pages are generated.
// Retain static/core entries and replace only generated article entries.
if (!DRY_RUN && !FIXTURE_PREVIEW) {
  const sitemapPath = resolve('sitemap.xml');
  const previous = await readFile(sitemapPath, 'utf8');
  const coreUrls = [...previous.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map(match => match[1])
    .filter(url => !url.startsWith(SITE + '/journal/articles/'));
  // Rings People is a public editorial hub: retain its URL even if
  // the checked-in sitemap was accidentally generated from an older version.
  coreUrls.push(SITE + '/rings-people.html');
  // Published date is the reliable date currently available from Journal rows.
  // Do not claim that a page changed today merely because the job ran.
  const articleEntries = posts.map(post => {
    const loc = SITE + '/journal/articles/' + encodeURIComponent(post.slug) + '/';
    const date = new Date(post.published_at);
    if (!Number.isFinite(date.getTime())) throw new Error('Invalid published_at for ' + post.slug);
    return { loc, lastmod: date.toISOString().slice(0, 10) };
  });
  const escapeXml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    [...new Set(coreUrls)].map(loc => '  <url><loc>' + escapeXml(loc) + '</loc></url>')
      .concat(articleEntries.map(({ loc, lastmod }) =>
        '  <url><loc>' + escapeXml(loc) + '</loc><lastmod>' + lastmod + '</lastmod></url>'))
      .join('\n') + '\n</urlset>\n';
  await writeFile(sitemapPath, xml, 'utf8');
  console.log('Updated sitemap: ' + articleEntries.length + ' published Journal pages.');
}
console.log(`Journal pages: ${posts.length}. ${DRY_RUN ? 'No files written.' : FIXTURE_PREVIEW ? 'Private fixture artifact generated.' : 'Files generated in journal/articles/.'}`);
