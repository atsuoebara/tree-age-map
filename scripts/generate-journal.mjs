/**
 * Runner's Rings Journal static-page generator.
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
      <div class="body">${html(body)}</div>
      <div class="share">
        <button type="button" class="copy">${language === 'ja' ? 'リンクをコピー' : 'Copy link'}</button>
        <button type="button" class="native-share" hidden>${language === 'ja' ? '共有' : 'Share'}</button>
        <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&amp;url=${encodeURIComponent(permalink)}" target="_blank" rel="noopener noreferrer">${language === 'ja' ? 'Xで共有' : 'Share to X'}</a>
      </div><p class="feedback" aria-live="polite"></p>
      <a class="back" href="/journal.html">${language === 'ja' ? 'Journal一覧へ戻る' : 'Back to Journal'}</a>
    </article>`;
  return `<!doctype html>
<!-- RR_JOURNAL_GENERATED_PAGE -->
<html lang="ja">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${html(summaryJa.slice(0, 160))}">
  <title>${html(titleJa)} | Runner's Rings Journal</title>
  <link rel="canonical" href="${html(permalink)}">
  <link rel="icon" href="/icon.PNG" type="image/png">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Runner's Rings Journal">
  <meta property="og:locale" content="ja_JP">
  <meta property="og:url" content="${html(permalink)}">
  <meta property="og:title" content="${html(titleJa)}">
  <meta property="og:description" content="${html(summaryJa.slice(0, 200))}">${ogImage}
  <meta property="article:published_time" content="${html(dateObj.toISOString())}">
  <style>
  *{box-sizing:border-box}html,body{margin:0;background:#0b1422;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{min-height:100vh;background:radial-gradient(circle at 85% 5%,rgba(255,43,214,.12),transparent 26%),#0b1422}
  header{background:#0f1d2f;padding:18px 16px;border-bottom:1px solid #28364a}.inner{max-width:760px;margin:auto;display:flex;justify-content:space-between;gap:12px;align-items:center}
  header strong{font-size:19px}button{cursor:pointer;background:#25384e;color:white;border:1px solid #61738a;border-radius:20px;padding:9px 13px}button.active{background:#ff2bd6;border-color:#ff2bd6}
  main{max-width:760px;margin:auto;padding:35px 16px 65px}article h1{font-size:clamp(23px,5vw,32px);line-height:1.5}.category{font-size:12px;color:#eaff00;font-weight:bold}time{display:block;margin-top:10px;color:#9eacc0;font-size:12px}.summary{font-size:16px;line-height:1.8;color:#d6e0ee}.body{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.95;font-size:15px;color:#c4d0e0;margin:24px 0 38px}.hero{display:block;margin:20px auto;max-width:100%;max-height:600px;object-fit:contain;border-radius:12px}
  .share{display:flex;flex-wrap:wrap;gap:10px}.share a{color:#fff;border:1px solid #61738a;background:#25384e;border-radius:20px;padding:10px 13px;text-decoration:none;font-size:13px;font-weight:bold}.feedback{min-height:1em;color:#eaff00;font-size:12px}.back{display:inline-block;color:#fff;text-decoration:none;background:#ff2bd6;border-radius:25px;padding:11px 20px;margin-top:14px;font-size:13px;font-weight:bold}footer{text-align:center;color:#9ba8b9;border-top:1px solid #2b3543;padding:20px;font-size:12px}
  </style>
</head>
<body>
  <header><div class="inner"><strong>Runner's Rings Journal</strong><nav><button type="button" id="ja" class="active">日本語</button> <button type="button" id="en">EN</button></nav></div></header>
  <main>${article('ja',titleJa,summaryJa,bodyJa)}${article('en',titleEn,summaryEn,bodyEn)}</main>
  <footer>© 2026 Runner's Rings</footer>
  <script>
  (()=>{
    'use strict';
    const permalink=${JSON.stringify(permalink)};
    const labels={ja:'URLをコピーしました',en:'Link copied'};
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
        try{if(!navigator.clipboard)throw new Error('No clipboard');await navigator.clipboard.writeText(permalink);feedback.textContent=labels[a.dataset.lang];}
        catch{window.prompt('Copy article URL',permalink);}
      });
      if(navigator.share){const btn=a.querySelector('.native-share');btn.hidden=false;btn.addEventListener('click',async()=>{try{await navigator.share({title:a.querySelector('h1').textContent,url:permalink});}catch(e){if(e.name!=='AbortError')feedback.textContent='Share failed';}});}
    });
    show();
  })();
  </script>
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
    if (contents.includes('<!-- RR_JOURNAL_GENERATED_PAGE -->') || (contents.includes("Runner's Rings Journal") && contents.includes(`<link rel="canonical" href="${SITE}/journal/articles/${encodeURIComponent(entry.name)}/">`) && contents.includes("document.querySelectorAll('article')"))) {
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
console.log(`Journal pages: ${posts.length}. ${DRY_RUN ? 'No files written.' : FIXTURE_PREVIEW ? 'Private fixture artifact generated.' : 'Files generated in journal/articles/.'}`);