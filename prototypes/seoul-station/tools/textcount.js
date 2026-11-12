// PROTOTYPE - NOT FOR PRODUCTION
// 게임이 불러오지 않는 개발용 도구. 같은 상태 네 곳에서 화면에 보이는 글자 수(공백 제외)와 아이콘 수를 센다.
// node tools/textcount.js [게임 폴더] [기준이 되는 옛 게임 폴더]   → 기준 폴더를 주면 줄어든 비율도 보여 준다
const path = require('path');
const { chromium } = require(process.env.KW_PLAYWRIGHT || '/Users/admin/projects/outsourcing/high-order-front/node_modules/playwright');
const dir = path.resolve(process.argv[2] || path.join(__dirname, '..')), base = process.argv[3] ? path.resolve(process.argv[3]) : null;
const STATES = { // 상태를 고친 뒤 탭을 고르고 한 칸 쉬어서 화면 전체를 다시 그리게 한다 (옛 판과 새 판에서 같은 길)
  first: () => { },
  ladder: () => { const S = window.game.state.raw; S.tier = 2; S.deposit = 500000; S.cash = 1830000; S.day = 5; S.movedDay = 3; S.hp = 62; S.quest = 4; window.game.run('tab', 'ladder'); window.game.run('rest'); },
  stock: () => { const S = window.game.state.raw; S.tier = 2; S.deposit = 500000; S.cash = 1830000; S.day = 5; S.movedDay = 3; S.hp = 62; S.quest = 4; window.game.run('tab', 'stock'); window.game.run('rest'); },
  coin: () => { const S = window.game.state.raw; S.tier = 3; S.deposit = 5000000; S.cash = 4200000; S.day = 15; S.movedDay = 12; S.hp = 80; S.quest = 10; window.game.run('tab', 'coin'); window.game.run('rest'); },
};
const COUNT = () => {
  const root = document.getElementById('s-play'); let chars = 0, words = 0;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) {
    const t = n.textContent.replace(/\s+/g, ''); if (!t) continue;
    const el = n.parentElement; if (el.closest('.hide')) continue;
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    chars += t.length; words += n.textContent.trim().split(/\s+/).length;
  }
  return { chars, words, icons: root.querySelectorAll('svg').length };
};
async function measure(folder) {
  const browser = await chromium.launch({ headless: true });
  const out = {};
  for (const name of Object.keys(STATES)) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto('file://' + path.join(folder, 'index.html') + '?manual=1&scene=play&seed=5');
    const step = n => page.evaluate(n => window.game.step(n), n);
    await step(40); await page.keyboard.press('Space'); await step(40);
    await page.evaluate(STATES[name]); await step(40);
    for (let i = 0; i < 6; i++) { // 뜬 창은 닫고(특성은 첫째, 사건은 둘째), 잠깐 떠 있는 글이 사라질 때까지 기다린 뒤 센다
      const modal = await page.evaluate(() => window.game.state.modal); if (!modal) break;
      await page.keyboard.press(modal === 'perk' ? 'Digit1' : modal === 'event' ? 'Digit2' : 'Space'); await step(30); await page.keyboard.press('Space'); await step(30);
    }
    await step(460);
    out[name] = await page.evaluate(COUNT);
    await page.close();
  }
  await browser.close();
  return out;
}
(async () => {
  const now = await measure(dir), old = base ? await measure(base) : null;
  const rows = Object.keys(now).map(k => ({ state: k, chars: now[k].chars, icons: now[k].icons, base: old ? old[k].chars : null, cut: old ? Math.round((1 - now[k].chars / old[k].chars) * 100) : null }));
  console.log(JSON.stringify(rows));
  if (old && rows.some(r => r.cut < 30)) { console.log('실패: 30% 이상 줄지 않은 화면이 있음'); process.exitCode = 1; }
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
