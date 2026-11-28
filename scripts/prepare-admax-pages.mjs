import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
const tag = '<script defer src="/rr-admax.js"></script>';
const roots = ['index.html','about-runners-rings.html','contact.html','developer-message.html','faq.html','gps-art.html','how-to.html','journal.html','my-today.html','partners.html','privacy.html','ranking.html','region-rings.html','ring-tools.html','rings-atlas.html','rings-people.html','sample.html','team.html','terms.html','territory.html','timelapse.html','today.html','tree.html','en/index.html','en/start.html',...Array.from({length:12},(_,i)=>'journal-'+String(i+1).padStart(3,'0')+'.html')];
const files = [...roots];
for (const entry of await readdir('journal/articles',{withFileTypes:true})) {
  if (entry.isDirectory()) files.push(join('journal/articles',entry.name,'index.html'));
}
const apply = process.argv.includes('--apply');
for (const file of files) {
  const old = await readFile(file,'utf8');
  const count = old.split(tag).length-1;
  if (count > 1 || (old.match(/<\/body\s*>/gi)||[]).length!==1) throw new Error('Unexpected markup: '+file);
  if (!count && apply) await writeFile(file,old.replace(/<\/body\s*>/i,tag+'\n$&'),'utf8');
}
console.log((apply?'Applied':'Checked')+' disabled loader scope: '+files.length+' pages');
