import fs from 'node:fs';

const files = ['ranking.html','territory.html','journal.html','gps-art.html'];
const todayCard = `    <a class="featureNavCard todayLink" href="./today.html">\n      <span class="featureNavName">🩵 Rings Today</span>\n      <span class="featureNavText" data-lang="ja">その日、世界のどこが走られたかを見る</span>\n      <span class="featureNavText" data-lang="en">See where the world ran that day</span>\n    </a>\n`;
const todayCss = ".featureNavCard.todayLink{border-color:#78eaff;background:linear-gradient(135deg,rgba(120,234,255,.34),#12374a 52%,#203a55)}\n";

for (const file of files) {
  let s = fs.readFileSync(file, 'utf8');
  const before = s;

  if (!s.includes('.featureNavCard.todayLink{')) {
    const cssAnchor = '.featureNavCard.artLink{';
    const i = s.indexOf(cssAnchor);
    if (i < 0) throw new Error(`${file}: artLink CSS anchor not found`);
    s = s.slice(0, i) + todayCss + s.slice(i);
  }

  if (!s.includes('href="./today.html"')) {
    const htmlAnchor = '<a class="featureNavCard artLink';
    const i = s.indexOf(htmlAnchor);
    if (i < 0) throw new Error(`${file}: artLink HTML anchor not found`);
    const lineStart = s.lastIndexOf('\n', i) + 1;
    s = s.slice(0, lineStart) + todayCard + s.slice(lineStart);
  }

  if (s !== before) {
    fs.writeFileSync(file, s);
    console.log(`updated ${file}`);
  } else {
    console.log(`no change ${file}`);
  }
}
