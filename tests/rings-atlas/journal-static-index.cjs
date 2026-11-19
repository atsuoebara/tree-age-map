#!/usr/bin/env node
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
const j=fs.readFileSync('journal.html','utf8'),p=fs.readFileSync('rings-people.html','utf8'),xml=fs.readFileSync('sitemap.xml','utf8');
const slugs=[...xml.matchAll(/<loc>https:\/\/runnersrings\.com\/journal\/articles\/([a-zA-Z0-9_-]+)\//g)].map(x=>x[1]);
assert(slugs.length>=73);
function region(doc,kind,lang){
 const a='<!-- RR_STATIC_'+kind+'_'+lang+'_START -->',b='<!-- RR_STATIC_'+kind+'_'+lang+'_END -->';
 assert.equal(doc.split(a).length,2);assert.equal(doc.split(b).length,2);
 return doc.split(a)[1].split(b)[0];
}
const links=s=>[...s.matchAll(/href="\/journal\/articles\/([a-zA-Z0-9_-]+)\/"/g)].map(x=>x[1]);
for(const lang of ['JA','EN']){
 const a=links(region(j,'JOURNAL',lang));assert.deepEqual(a,slugs);assert.equal(new Set(a).size,a.length);
 const b=links(region(p,'PEOPLE',lang));assert(b.length>0);assert(b.every(x=>a.includes(x)));
}
assert(j.includes("nav.hidden=!loading&&!failed"));
assert(p.includes("rrStaticPeople').hidden=state==='ready'"));
const wf=fs.readFileSync('.github/workflows/journal-generate.yml','utf8');
assert(wf.includes('sitemap.xml journal.html rings-people.html'));
const {indexBlock,replaceIndex}=await import('../'.repeat(2)+'scripts/journal-static-links.mjs');
const fixture=[{slug:'sample-a',title_ja:'内容 < &',title_en:'Content < &'}];
const content=indexBlock('journal','ja',fixture);
assert(content.includes('内容 &lt; &amp;'));
assert(replaceIndex(content,'journal','ja',[{...fixture[0],slug:'sample-b'}]).includes('sample-b'));
assert.throws(()=>replaceIndex('no marker','journal','ja',fixture));
assert.throws(()=>indexBlock('journal','ja',[{...fixture[0],slug:'../unsafe'}]));
console.log('PASS: 73 static Journal links in both languages; generator marker validation');
})().catch(e=>{console.error(e);process.exitCode=1;});
