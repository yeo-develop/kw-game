const { chromium } = require(process.env.KW_PLAYWRIGHT || 'playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage({ viewport: { width: 1312, height: 900 }, deviceScaleFactor: 1 });
  await p.goto('file:///Users/admin/projects/kw-game/docs/mock/goal.html'); await p.waitForTimeout(800);
  const ws = await p.$$('.wrap'); const names = ['g_a', 'g_b', 'g_c'];
  for (let i = 0; i < ws.length; i++) await ws[i].screenshot({ path: '/Users/admin/projects/kw-game/docs/mock/shots/' + names[i] + '.png' });
  await b.close();
})();
