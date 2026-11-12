// PROTOTYPE - NOT FOR PRODUCTION
// 게임이 불러오지 않는 개발용 도구. 화면 없는 브라우저(Playwright)는 KW_PLAYWRIGHT 환경 변수로 위치를 줄 수 있다.
// 화면 없는 브라우저로 페이지를 열어 찍는 작은 도구 (게임 폴더 밖에 둠)
// node shot.js <file.html> <out.png> [--size 1280x720] [--query "a=b&c=d"] [--wait 300] [--js "코드"] [--steps "press:Enter;step:30;js:...;click:640,360;shot:/path.png"]
const path = require('path');
const { chromium } = require(process.env.KW_PLAYWRIGHT || '/Users/admin/projects/outsourcing/high-order-front/node_modules/playwright');
(async () => {
  const a = process.argv.slice(2); const file = a[0], out = a[1];
  const opt = k => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : null; };
  const [w, h] = (opt('size') || '1280x720').split('x').map(Number);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  page.on('pageerror', e => errs.push('uncaught: ' + e.message));
  const url = (file.startsWith('http') ? file : 'file://' + path.resolve(file)) + (opt('query') ? '?' + opt('query') : '');
  await page.goto(url); await page.waitForTimeout(Number(opt('wait') || 300));
  if (opt('js')) { const r = await page.evaluate(opt('js')); if (r !== undefined) console.log('js:', JSON.stringify(r)); }
  for (const s of (opt('steps') || '').split(';').filter(Boolean)) {
    const i = s.indexOf(':'); const k = i < 0 ? s : s.slice(0, i), v = i < 0 ? '' : s.slice(i + 1);
    if (k === 'press') await page.keyboard.press(v);
    else if (k === 'wait') await page.waitForTimeout(Number(v));
    else if (k === 'step') await page.evaluate(n => window.game && window.game.step(n), Number(v));
    else if (k === 'click') { const [x, y] = v.split(',').map(Number); await page.mouse.click(x, y); }
    else if (k === 'text') await page.getByText(v, { exact: false }).first().click();
    else if (k === 'js') { const r = await page.evaluate(v); if (r !== undefined) console.log('js:', JSON.stringify(r)); }
    else if (k === 'shot') await page.screenshot({ path: v });
  }
  if (out && out !== '-') await page.screenshot({ path: out });
  console.log(errs.length ? errs.join('\n') : 'errors: none');
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
