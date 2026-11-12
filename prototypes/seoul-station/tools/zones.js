// PROTOTYPE - NOT FOR PRODUCTION
// 게임이 불러오지 않는 개발용 도구. play 화면의 구역 다섯 개가 서로 겹치지 않고, 화면 안에 있고, 간격이 8px 이상이고,
// 구역마다 아이콘이 붙은 머리줄이 있는지, 창 크기가 달라도 같은 비율인지 본다.
// node tools/zones.js [게임 폴더]
const path = require('path');
const { chromium } = require(process.env.KW_PLAYWRIGHT || '/Users/admin/projects/outsourcing/high-order-front/node_modules/playwright');
const dir = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const NEED = ['hud', 'me', 'quest', 'today', 'board'];
(async () => {
  const browser = await chromium.launch({ headless: true });
  const bad = [], seen = {};
  for (const [w, h] of [[1280, 720], [800, 450], [1920, 1080]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto('file://' + path.join(dir, 'index.html') + '?manual=1&scene=play&seed=5');
    await page.evaluate(() => window.game.step(40)); await page.keyboard.press('Space'); await page.evaluate(() => window.game.step(40));
    for (const state of ['first', 'late']) {
      if (state === 'late') await page.evaluate(() => { const S = window.game.state.raw; S.tier = 3; S.deposit = 5000000; S.cash = 4200000; S.day = 15; S.movedDay = 12; S.slot = 3; window.game.render(); window.game.run('tab', 'coin'); });
      const z = await page.evaluate(() => {
        const st = document.getElementById('stage').getBoundingClientRect(), k = st.width / 1280;
        return Array.from(document.querySelectorAll('[data-zone]')).map(e => { const r = e.getBoundingClientRect(), zh = e.querySelector('.zh'); return { id: e.dataset.zone, x0: (r.left - st.left) / k, y0: (r.top - st.top) / k, x1: (r.right - st.left) / k, y1: (r.bottom - st.top) / k, head: !!zh, icon: !!(zh && zh.querySelector('svg')), same: getComputedStyle(e).borderTopWidth + '/' + getComputedStyle(e).borderTopStyle }; });
      });
      const tag = w + '×' + h + ' ' + state;
      if (w === 1280) for (const tab of ['ladder', 'stock', 'coin']) { // 글 대신 들어간 아이콘마다 뜻을 알 길이 있는가: 자기나 바깥 요소의 title, 아니면 바로 옆의 한글 이름
        const lost = await page.evaluate(tab => {
          if (window.game.state.raw.tier >= 3 || tab === 'ladder') window.game.run('tab', tab);
          return Array.from(document.querySelectorAll('#s-play .ic, #s-play .slots span, #s-play .opens span, #s-play .pk')).filter(e => e.getBoundingClientRect().width > 0 && !e.closest('[title]') && !/[가-힣]/.test((e.parentElement.textContent || ''))).map(e => (e.closest('[data-zone]') || {}).dataset.zone + ':' + e.parentElement.className);
        }, tab);
        for (const l of lost) bad.push(tag + ' ' + tab + ': 설명 없는 아이콘 ' + l);
      }
      for (const id of NEED) if (!z.some(a => a.id === id)) bad.push(tag + ': 구역 없음 ' + id);
      for (const a of z) {
        if (a.x0 < -0.5 || a.y0 < -0.5 || a.x1 > 1280.5 || a.y1 > 720.5) bad.push(tag + ': 화면 밖 ' + a.id);
        if (!a.head || !a.icon) bad.push(tag + ': 아이콘 머리줄 없음 ' + a.id);
        if (a.same !== z[0].same) bad.push(tag + ': 틀이 다름 ' + a.id);
        for (const b of z) {
          if (a.id >= b.id) continue;
          const dx = Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1), dy = Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1); // 음수면 그 축에서 겹침
          if (dx < 0 && dy < 0) bad.push(tag + ': 겹침 ' + a.id + ' × ' + b.id);
          else if (Math.max(dx, dy) < 7.5) bad.push(tag + ': 간격 ' + Math.max(dx, dy).toFixed(1) + 'px ' + a.id + ' × ' + b.id);
        }
        const key = a.id + ' ' + state, box = [a.x0, a.y0, a.x1, a.y1].map(v => Math.round(v));
        if (!seen[key]) seen[key] = box; else if (seen[key].some((v, i) => Math.abs(v - box[i]) > 1)) bad.push(tag + ': 비율이 달라짐 ' + a.id + ' ' + box + ' ≠ ' + seen[key]);
      }
    }
    await page.close();
  }
  await browser.close();
  console.log(JSON.stringify({ zones: Object.keys(seen).filter(k => k.endsWith('first')).map(k => k.split(' ')[0] + ' ' + seen[k].join(',')), bad }, null, 1));
  if (bad.length) process.exitCode = 1;
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
