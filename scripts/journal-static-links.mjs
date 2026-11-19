// Regenerate crawlable links using approved published Journal rows.
export function escaped(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
export function indexBlock(kind,lang,posts){
 if(!['journal','people'].includes(kind)||!['ja','en'].includes(lang))throw Error('Invalid index');
 const name=kind==='journal'?(lang==='ja'?'公開済み記事一覧':'Published Journal articles'):(lang==='ja'?'Rings Peopleの公開済みインタビュー':'Published Rings People interviews');
 const start=`<!-- RR_STATIC_${kind.toUpperCase()}_${lang.toUpperCase()}_START -->`;
 const end=`<!-- RR_STATIC_${kind.toUpperCase()}_${lang.toUpperCase()}_END -->`;
 const attr=kind==='people'?` data-static-lang="${lang}"`:'';
 const items=posts.map(p=>{const slug=String(p.slug||'');if(!/^[a-z0-9][a-z0-9_-]{0,119}$/i.test(slug))throw Error('Invalid slug');const title=p['title_'+lang]||p.title_ja||p.title_en||'Journal';return `<li><a href="/journal/articles/${encodeURIComponent(slug)}/">${escaped(title)}</a></li>`;}).join('\n');
 return `${start}\n<nav class="rrStaticIndex"${attr} aria-label="${name}">\n<h3>${name}</h3>\n<ul>\n${items}\n</ul>\n</nav>\n${end}`;
}
export function replaceIndex(source,kind,lang,posts){
 const start=`<!-- RR_STATIC_${kind.toUpperCase()}_${lang.toUpperCase()}_START -->`,end=`<!-- RR_STATIC_${kind.toUpperCase()}_${lang.toUpperCase()}_END -->`;
 const a=source.indexOf(start),b=source.indexOf(end);if(a<0||b<a||source.indexOf(start,a+start.length)!==-1||source.indexOf(end,b+end.length)!==-1)throw Error('Missing/duplicate index markers '+kind+' '+lang);
 return source.slice(0,a)+indexBlock(kind,lang,posts)+source.slice(b+end.length);
}
