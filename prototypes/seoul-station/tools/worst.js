// PROTOTYPE - NOT FOR PRODUCTION
// 게임이 불러오지 않는 개발용 도구. 글이 가장 많은 날(소식 3건 + 리포트 3건 + 긴 숫자)의 주식 · 코인 탭이 넘치지 않는지,
// 도장 · 효과 줄이기가 되는지, 창이 몰리는 때(퀘스트 여러 개 · 건너뛰기 · 같은 알림)에 한 장으로 모이는지 본다.
// node tools/worst.js [게임 폴더] [찍을 폴더]
const path = require('path'), fs = require('fs');
const { chromium } = require(process.env.KW_PLAYWRIGHT || '/Users/admin/projects/outsourcing/high-order-front/node_modules/playwright');
const dir = path.resolve(process.argv[2] || path.join(__dirname, '..')), out = path.resolve(process.argv[3] || path.join(dir, 'evidence', 'worst'));
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true });
  const errs = [];
  const fresh = async () => { // 새 판을 열고 소개 창을 닫은 쪽 (소개 창은 0.6초 동안 누름을 받지 않는다)
    const pg = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    pg.on('pageerror', e => errs.push(e.message));
    await pg.goto('file://' + path.join(dir, 'index.html') + '?manual=1&scene=play&seed=5');
    await pg.evaluate(() => window.game.step(60)); await pg.keyboard.press('Space'); await pg.evaluate(() => window.game.step(60));
    return pg;
  };
  const page = await fresh();
  const step = n => page.evaluate(n => window.game.step(n), n);
  const report = {};
  for (const tab of ['stock', 'coin', 'coin-open']) {
    await page.evaluate(tab => {
      const S = window.game.state.raw, g = window.game;
      S.tier = 3; S.deposit = 5000000; S.cash = 123456789; S.hp = 100; S.day = 13; S.slot = 1; S.arrears = 1495000; S.movedDay = 2;
      const mk = (id, asset, dir, src, head) => ({ id, day: S.day, asset, dir, src, truth: true, mag: 0.1, head });
      S.market.news = [mk(901, 'buldak', -1, 'official', '화끈식품 대주주 지분 매각설'), mk(902, 'daejang', 1, 'article', '대장전자, 대형 공급 계약'), mk(903, 'coin', 1, 'rumor', '달나라코인, 대형 거래소 상장설')];
      S.market.brief = { day: S.day, madeOn: S.day - 1, items: [{ nid: 901, asset: 'buldak', dir: 1 }, { nid: 902, asset: 'daejang', dir: -1 }, { nid: 903, asset: 'coin', dir: 1 }], ht: { phase: 'gather', soon: true } };
      S.market.intel = { day: S.day + 1, madeOn: S.day, items: [{ nid: 1, asset: 'buldak', dir: 1 }, { nid: 2, asset: 'daejang', dir: -1 }, { nid: 3, asset: 'coin', dir: -1 }], ht: { phase: 'gather', soon: false } };
      S.hold.hantang = { units: 30000, cost: 88000000 }; S.market.px.hantang = 3894.4;
      S.event = null; S.offer = null; S.picks = 0; S.combo = 7; S.buff = { nextJob: 1.5 }; S.perks = { iron: 3, sleep: 3, hustle: 3, hands: 2, lazy: 2, streak: 2, thrift: 2, early: 2, quester: 1, legs: 2, sense: 2, vip: 1, tipster: 1, guts: 1 };
      g.render();
      if (tab === 'coin-open' && !S.lev) { g.run('tab', 'coin'); g.run('lev', '5'); g.run('share', '1'); g.step(40, false); g.run('long'); g.step(40, false); }
      g.run('tab', tab === 'stock' ? 'stock' : 'coin'); if (tab === 'stock') g.run('sel', 'hantang');
      g.render();
    }, tab);
    await step(40);
    await page.screenshot({ path: path.join(out, tab + '.png') });
    report[tab] = await page.evaluate(() => {
      const bad = [], P = document.getElementById('board').getBoundingClientRect(), St = document.getElementById('quest').getBoundingClientRect();
      for (const z of document.querySelectorAll('[data-zone]')) { const zr = z.getBoundingClientRect(); for (const e of z.querySelectorAll('button, .chip, .pk, .ic, b, span')) { const r = e.getBoundingClientRect(); if (r.width && (r.right > zr.right + 1 || r.bottom > zr.bottom + 1 || r.left < zr.left - 1)) { bad.push('구역 밖(' + z.dataset.zone + '): ' + ((e.textContent || '').trim().slice(0, 14) || e.className)); break; } } }
      for (const e of document.querySelectorAll('#board button, #board .mine-line, #board .note, #board .nitem, #board .arow')) {
        const r = e.getBoundingClientRect(); if (!r.width) continue;
        if (r.bottom > P.bottom + 0.5 || r.right > P.right + 0.5) bad.push('칸 밖: ' + (e.textContent || '').trim().slice(0, 20) + ' (아래 ' + Math.round(r.bottom - P.bottom) + ' · 오른쪽 ' + Math.round(r.right - P.right) + ')');
      }
      const nb = document.querySelector('.newsbox'); if (nb && nb.scrollHeight > nb.clientHeight + 1) bad.push('소식 칸 안에서 잘림: ' + nb.scrollHeight + ' > ' + nb.clientHeight);
      for (const e of document.querySelectorAll('.nitem, .newsbox h4')) if (e.scrollWidth > e.clientWidth + 1 && !e.querySelector('.tx')) bad.push('소식 줄 넘침: ' + e.textContent.slice(0, 20));
      for (const e of document.querySelectorAll('#quest .chip')) { const r = e.getBoundingClientRect(); if (r.right > St.right - 10) bad.push('상태창 칩 넘침: ' + e.textContent); }
      return bad;
    });
  }
  // 도장: 든 종목이 한 칸에 크게 움직이면 찍힌다. 효과 줄이기를 켜면 폭죽 · 도장이 없다
  const page2 = await fresh();
  const fxr = await page2.evaluate(() => {
    const g = window.game, S = g.state.raw, out = {};
    const drop = () => { S.tier = 2; S.deposit = 500000; S.quest = 99; S.offer = null; S.picks = 0; S.event = null; S.xp = 0; S.slot = 0; S.hp = 50; S.hold.hantang = { units: 1000, cost: 3000000 }; S.market.ht = { phase: 'dump', left: 2 }; g.render(); g.run('tab', 'stock'); g.run('rest'); };
    drop(); out.stamp = !!document.querySelector('.stamp'); out.stampText = (document.querySelector('.stamp') || {}).textContent || ''; out.modal = g.state.modal;
    g.step(40, false); document.querySelectorAll('.stamp').forEach(e => e.remove());
    g.meta.fxOff = true; drop();
    out.stampWhenCalm = !!document.querySelector('.stamp'); out.partsWhenCalm = g.fx.parts; out.off = g.fx.off;
    g.meta.fxOff = false;
    return out;
  });
  await page2.screenshot({ path: path.join(out, 'stamp.png') });
  if (!fxr.stamp) report.stamp = ['크게 움직였는데 도장이 안 찍힘']; if (fxr.stampWhenCalm) report.calm = ['효과 줄이기인데 도장이 찍힘'];
  // 창이 몰리는 때: 한꺼번에 끝난 퀘스트는 한 장, 건너뛴 것은 그 장에 적힘. 같은 알림은 쌓이지 않고, 특성 아이콘을 누르면 설명이 뜬다
  const page3 = await fresh();
  const pops = { bad: [] };
  pops.morning = await page3.evaluate(() => { // 찜질방에서 첫 밤을 넘긴 아침: "오늘을 버텨라" + "지붕 아래에서 자라"
    const g = window.game, S = g.state.raw; S.quest = 1; S.tier = 1; S.cash = 200000; S.slot = 3; g.render(); g.run('endday'); g.step(60); g.press('Space'); g.step(60);
    const rows = document.querySelectorAll('.qdone > div').length, next = (document.querySelector('.nextbox b') || {}).textContent || '';
    return { modal: g.state.modal, rows, next, event: !!S.event };
  });
  await page3.waitForTimeout(400); await page3.screenshot({ path: path.join(out, 'quest-two.png') }); // 창 · 알림이 나타나는 움직임이 끝난 뒤에 찍음
  if (pops.morning.modal !== 'quest' || pops.morning.rows !== 2 || pops.morning.next !== '주소를 만들어라') pops.bad.push('두 퀘스트가 한 장에 안 모임: ' + JSON.stringify(pops.morning));
  if (pops.morning.event) pops.bad.push('퀘스트가 끝난 아침에 돌발 사건이 겹침');
  pops.after = await page3.evaluate(() => { const g = window.game; g.press('Space'); g.step(60); const m = g.state.modal; if (m === 'perk') { g.press('Digit1'); g.step(60); } return { then: m, last: g.state.modal }; });
  if (pops.after.then === 'quest' || pops.after.last) pops.bad.push('퀘스트 창 뒤에 창이 더 남음: ' + JSON.stringify(pops.after));
  pops.skip = await page3.evaluate(() => { // 원룸에 늦게 들어간 날: 끝난 것 둘 + 때가 지나 건너뛴 것 둘 → 한 장
    const g = window.game, S = g.state.raw; S.quest = 7; S.tier = 3; S.deposit = 5000000; S.cash = 4000000; S.day = 23; S.movedDay = 22; S.slot = 0; S.hp = 50; S.offer = null; S.picks = 0; S.event = null; S.xp = 0; g.render(); g.run('rest'); g.step(60);
    return { modal: g.state.modal, done: document.querySelectorAll('.qdone > div:not(.off)').length, off: document.querySelectorAll('.qdone > .off').length, next: (document.querySelector('.nextbox b') || {}).textContent || '' };
  });
  await page3.waitForTimeout(400); await page3.screenshot({ path: path.join(out, 'quest-skip.png') });
  if (pops.skip.modal !== 'quest' || pops.skip.done !== 2 || pops.skip.off !== 2 || pops.skip.next !== '집을 사라') pops.bad.push('건너뛴 퀘스트가 창에 안 적힘: ' + JSON.stringify(pops.skip));
  pops.toast = await page3.evaluate(() => {
    const g = window.game, S = g.state.raw; g.press('Space'); g.step(60); if (g.state.modal === 'perk') { g.press('Digit1'); g.step(60); }
    for (let i = 0; i < 4; i++) g.run('why', '현금이 모자랍니다');
    const same = document.querySelectorAll('#toasts .toast').length;
    S.perks = { iron: 2, lazy: 1 }; g.render(); for (const e of document.querySelectorAll('#me .pk')) e.click(); // '요령'의 설명에는 큰따옴표가 들어 있다
    const tip = Array.from(document.querySelectorAll('#toasts .toast.tip')).map(e => e.textContent).join('|');
    return { modal: g.state.modal, same, tip };
  });
  await page3.waitForTimeout(400); await page3.screenshot({ path: path.join(out, 'toasts.png') });
  if (pops.toast.same !== 1) pops.bad.push('같은 알림이 ' + pops.toast.same + '개 쌓임');
  if (!/강철 체력 ×2 — 최대 체력/.test(pops.toast.tip) || !/요령 — "대충" 배율.*받는다/.test(pops.toast.tip)) pops.bad.push('특성 아이콘을 눌러도 설명이 다 안 뜸: ' + pops.toast.tip);
  if (pops.bad.length) report.popups = pops.bad;
  console.log(JSON.stringify({ errors: errs, report, fx: fxr, popups: pops }, null, 1));
  if (errs.length || Object.values(report).some(v => v.length)) process.exitCode = 1;
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
