// PROTOTYPE - NOT FOR PRODUCTION
// 게임이 불러오지 않는 개발용 도구. 화면 없는 브라우저(Playwright)는 KW_PLAYWRIGHT 환경 변수로 위치를 줄 수 있다.
// 줄인 글꼴(fonts/DungGeunMo.subset.woff)에 게임 글의 글자가 다 들어 있는지 본다 — 빠진 글자는 브라우저의 다른 글꼴로 나와 픽셀 글자 사이에서 튄다.
// node tools/fontcheck.js [게임 폴더]     빠진 글자가 있으면 그 글자와 나오는 곳을 적고 1 로 끝난다 (fonts/README.md 의 명령으로 글꼴을 다시 만든다)
const path = require('path'), fs = require('fs');
const { chromium } = require(process.env.KW_PLAYWRIGHT || '/Users/admin/projects/outsourcing/high-order-front/node_modules/playwright');
const dir = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const files = fs.readdirSync(dir).filter(f => /\.(js|html)$/.test(f)).map(f => path.join(dir, f));
const chars = new Set();
for (const f of files) for (const ch of fs.readFileSync(f, 'utf8')) if (ch.codePointAt(0) > 0x7e) chars.add(ch);
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage();
  await page.goto('file://' + path.join(dir, 'index.html') + '?manual=1&seed=5'); await page.waitForTimeout(600);
  const miss = await page.evaluate(async list => {
    await document.fonts.ready;
    const fam = getComputedStyle(document.body).fontFamily.split(',')[0].trim();
    const c = document.createElement('canvas'); c.width = 40; c.height = 40; const x = c.getContext('2d', { willReadFrequently: true });
    const draw = (ch, font) => { x.clearRect(0, 0, 40, 40); x.font = '32px ' + font; x.textBaseline = 'alphabetic'; x.fillStyle = '#000'; x.fillText(ch, 2, 30); /* 기준선을 글자 밑줄로: 첫 글꼴의 높이 값에 따라 자리가 달라지지 않게 */ return x.getImageData(0, 0, 40, 40).data.join(''); };
    const out = [];
    for (const ch of list) { if (/\s/.test(ch)) continue; if (draw(ch, fam + ', monospace') === draw(ch, 'monospace')) out.push(ch); } // 게임 글꼴을 앞에 둔 것과 뺀 것이 같으면 그 글자는 게임 글꼴에 없다
    return { fam, out };
  }, [...chars]);
  console.log('글꼴', miss.fam, '· 본 글자', chars.size, '· 글꼴에 없는 글자', miss.out.length, miss.out.join(' '));
  for (const ch of miss.out) { const hits = []; for (const f of files) { const t = fs.readFileSync(f, 'utf8'), i = t.indexOf(ch); if (i >= 0) hits.push(path.basename(f) + ': …' + t.slice(Math.max(0, i - 14), i + 10).replace(/\n/g, ' ') + '…'); } console.log('  ' + ch + ' U+' + ch.codePointAt(0).toString(16), '|', hits.slice(0, 2).join(' | ')); }
  await browser.close(); if (miss.out.length) process.exitCode = 1;
})();
