// 배포된 웹 빌드를 머리 없는 크로미움(따로 만든 프로필 = 사용자의 브라우저 저장과 무관)으로 열어 두고,
// 로컬 HTTP 로 명령을 받아 클릭·키·스크린샷을 수행한다. 콘솔 에러·페이지 에러는 전부 모아 /errors 로 돌려준다.
// 사용: KW_PLAYWRIGHT=<playwright 경로> node tools/screens/capture.js <url> <port> <작업 폴더>
// 전체 화면 캡처: 주소 끝에 ?kwShots=1 → 게임이 화면을 차례로 띄우며 콘솔에 "[shot] 이름" 을 찍고, 여기서 그 순간을 <작업 폴더>/이름.png 로 저장. 진행은 /status, 끝내기는 /quit
const path = require('path');
const http = require('http');
// Playwright 는 이 저장소에 없음 → 설치된 곳을 KW_PLAYWRIGHT 로 알려 줌 (예: KW_PLAYWRIGHT=/path/to/node_modules/playwright)
const { chromium } = require(process.env.KW_PLAYWRIGHT || 'playwright');

const [url, portArg, dirArg] = process.argv.slice(2);
const port = parseInt(portArg || '8765', 10);
const dir = dirArg || __dirname;
const errors = []; const logs = [];

(async () => {
  const ctx = await chromium.launchPersistentContext(path.join(dir, 'profile'), {
    headless: true,
    viewport: { width: 1280, height: 720 },
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'],
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  page.on('console', m => { const t = m.text(); if (m.type() === 'error') errors.push(t.slice(0, 600)); logs.push(`[${m.type()}] ${t.slice(0, 300)}`); if (logs.length > 400) logs.shift(); });
  // 캡처 모드(?kwShots=1): 게임이 콘솔에 "[shot] 이름" 을 찍으면 그 순간 화면을 저장 (게임은 0.8초쯤 멈춰 있음)
  const shots = []; const skips = []; let shotsDone = false; let chain = Promise.resolve();
  page.on('console', m => {
    const t = m.text(); const k = /^\[shot\] (.+)$/.exec(t); if (!k) return;
    const v = k[1].trim();
    if (v === 'done') { shotsDone = true; return; }
    if (v.startsWith('skip ')) { skips.push(v.slice(5)); return; }
    if (!/^[a-z0-9_]+$/.test(v)) { skips.push('(이름 아님) ' + v.slice(0, 120)); return; }
    chain = chain.then(() => page.screenshot({ path: path.join(dir, v + '.png') }).then(() => { shots.push(v); }).catch(e => { skips.push(v + ': ' + String(e).slice(0, 80)); }));
  });
  page.on('pageerror', e => errors.push('PAGEERROR ' + String(e).slice(0, 600)));
  page.on('response', r => { if (r.status() >= 400) errors.push('HTTP ' + r.status() + ' ' + r.url().slice(0, 200)); });
  page.on('requestfailed', r => errors.push('REQFAILED ' + r.url().slice(0, 200) + ' ' + (r.failure() ? r.failure().errorText : '')));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x'); const q = u.searchParams; let out = 'ok';
    try {
      if (u.pathname === '/shot') { await page.screenshot({ path: path.join(dir, q.get('name') || 'shot.png') }); }
      else if (u.pathname === '/click') { await page.mouse.click(parseFloat(q.get('x')), parseFloat(q.get('y'))); }
      else if (u.pathname === '/key') { await page.keyboard.press(q.get('k')); }
      else if (u.pathname === '/wheel') { await page.mouse.move(parseFloat(q.get('x')), parseFloat(q.get('y'))); await page.mouse.wheel(0, parseFloat(q.get('dy') || '300')); }
      else if (u.pathname === '/wait') { await page.waitForTimeout(parseInt(q.get('ms') || '1000', 10)); }
      else if (u.pathname === '/errors') { out = JSON.stringify(errors, null, 1); }
      else if (u.pathname === '/logs') { out = logs.slice(-(parseInt(q.get('n') || '40', 10))).join('\n'); }
      else if (u.pathname === '/eval') { out = JSON.stringify(await page.evaluate(q.get('js'))); }
      else if (u.pathname === '/status') { out = JSON.stringify({ done: shotsDone, n: shots.length, last: shots[shots.length - 1] || null, skips }); }
      else if (u.pathname === '/quit') { res.end('bye'); await ctx.close(); process.exit(0); }
      else out = 'unknown';
    } catch (e) { out = 'ERR ' + String(e).slice(0, 300); }
    res.end(out);
  });
  server.listen(port, '127.0.0.1', () => console.log('ready ' + port));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
