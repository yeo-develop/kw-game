// 인쇄용 HTML → PDF (A4 · 쪽 번호). 사용: KW_PLAYWRIGHT=<playwright 경로> node tools/guide/pdf.js <in.html> <out.pdf>
const { chromium } = require(process.env.KW_PLAYWRIGHT || 'playwright');
const path = require('path');
(async () => {
  const [inp, out] = process.argv.slice(2);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('file://' + path.resolve(inp), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const bad = await page.evaluate(() => [...document.images].filter(i => !i.complete || i.naturalWidth === 0).map(i => i.getAttribute('src')));
  await page.pdf({
    path: out, format: 'A4', printBackground: true, displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: '<div style="width:100%;font-size:8px;color:#8a8f99;text-align:center;font-family:sans-serif;">롱잡고알바감 플레이 가이드 · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    margin: { top: '16mm', bottom: '18mm', left: '15mm', right: '15mm' },
  });
  console.log('pdf', out, '깨진 그림', JSON.stringify(bad));
  await browser.close();
})();
