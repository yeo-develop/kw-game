// PROTOTYPE - NOT FOR PRODUCTION
// 게임이 불러오지 않는 개발용 도구. 글이 가장 많은 날(소식 3건 + 리포트 3건 + 긴 숫자)의 주식 · 코인 탭이 넘치지 않는지 본다.
// node tools/worst.js [게임 폴더] [찍을 폴더]
const path = require('path'), fs = require('fs');
const { chromium } = require(process.env.KW_PLAYWRIGHT || '/Users/admin/projects/outsourcing/high-order-front/node_modules/playwright');
const dir = path.resolve(process.argv[2] || path.join(__dirname, '..')), out = path.resolve(process.argv[3] || path.join(dir, 'evidence', 'worst'));
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.join(dir, 'index.html') + '?manual=1&scene=play&seed=5');
  const step = n => page.evaluate(n => window.game.step(n), n);
  await step(30); await page.keyboard.press('Space'); await step(30);
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
  const page2 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page2.on('pageerror', e => errs.push(e.message));
  await page2.goto('file://' + path.join(dir, 'index.html') + '?manual=1&scene=play&seed=5');
  await page2.evaluate(() => window.game.step(30)); await page2.keyboard.press('Space'); await page2.evaluate(() => window.game.step(30));
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
  console.log(JSON.stringify({ errors: errs, report, fx: fxr }, null, 1));
  if (errs.length || Object.values(report).some(v => v.length)) process.exitCode = 1;
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
