// PROTOTYPE - NOT FOR PRODUCTION
// 게임이 불러오지 않는 개발용 도구. 화면 없는 브라우저(Playwright)는 KW_PLAYWRIGHT 환경 변수로 위치를 줄 수 있다.
// 한 판을 화면으로 끝까지 몰아 보는 점검 (게임 폴더 밖). 창 없이 돌고, 화면 몇 장을 찍고, 글자 넘침 · 겹침 · 작은 글자 · 콘솔 오류를 모은다.
// node check.js <게임 폴더> <찍을 폴더> [seed] [style: study|alba|gamble]
const path = require('path'), fs = require('fs');
const { chromium } = require(process.env.KW_PLAYWRIGHT || '/Users/admin/projects/outsourcing/high-order-front/node_modules/playwright');
const dir = path.resolve(process.argv[2] || path.join(__dirname, '..')), out = process.argv[3] || path.join(dir, 'evidence', 'check'), seed = process.argv[4] || '5', style = process.argv[5] || 'study';
fs.mkdirSync(out, { recursive: true });
const LINT = () => {
  const stage = document.getElementById('stage'), sr = stage.getBoundingClientRect(), k = sr.width / 1280, bad = [], leaves = [];
  const w = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const t = n.textContent.trim(); if (!t) continue;
    const el = n.parentElement; if (el.closest('.hide') || el.closest('#fx') || el.closest('#toast')) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
    const r = document.createRange(); r.selectNodeContents(n);
    const rs = [...r.getClientRects()].filter(b => b.width > 0.5 && b.height > 0.5); if (!rs.length) continue;
    const b = { x0: Math.min(...rs.map(q => q.left)), y0: Math.min(...rs.map(q => q.top)), x1: Math.max(...rs.map(q => q.right)), y1: Math.max(...rs.map(q => q.bottom)) };
    const top = document.elementFromPoint((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
    if (!top || !(top === el || el.contains(top) || top.contains(el))) continue; // 다른 것에 가려진 글자는 보지 않음
    const fs = parseFloat(cs.fontSize);
    if (fs < 13.99) bad.push('작은 글자 ' + fs + 'px: ' + t.slice(0, 24));
    if (b.x0 < sr.left - 1 || b.y0 < sr.top - 1 || b.x1 > sr.right + 1 || b.y1 > sr.bottom + 1) bad.push('화면 밖: ' + t.slice(0, 24));
    for (let p = el; p && p !== stage; p = p.parentElement) { // 잘림: overflow hidden 조상 밖으로 나간 글자
      const ps = getComputedStyle(p); if (ps.overflow === 'visible' && ps.overflowX === 'visible') continue;
      const pr = p.getBoundingClientRect();
      if (b.x1 > pr.right + 2 || b.y1 > pr.bottom + 2 || b.x0 < pr.left - 2 || b.y0 < pr.top - 2) { if (!(ps.textOverflow === 'ellipsis' || ps.webkitLineClamp !== 'none')) bad.push('잘림(' + (p.id || p.className) + '): ' + t.slice(0, 24)); break; }
    }
    const box = el.closest('#status,#acts,#panel,#top,#scene,.win,.e-box,.t-box');
    if (box) { const br = box.getBoundingClientRect(); if (b.x1 > br.right + 1 || b.y1 > br.bottom + 1 || b.x0 < br.left - 1 || b.y0 < br.top - 1) bad.push('칸 밖(' + (box.id || box.className) + '): ' + t.slice(0, 24)); }
    leaves.push({ el, b, t });
  }
  for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
    const A = leaves[i], B = leaves[j]; if (A.el === B.el || A.el.contains(B.el) || B.el.contains(A.el)) continue;
    const ix = Math.min(A.b.x1, B.b.x1) - Math.max(A.b.x0, B.b.x0), iy = Math.min(A.b.y1, B.b.y1) - Math.max(A.b.y0, B.b.y0);
    if (ix <= 0 || iy <= 0) continue;
    const small = Math.min((A.b.x1 - A.b.x0) * (A.b.y1 - A.b.y0), (B.b.x1 - B.b.x0) * (B.b.y1 - B.b.y0));
    if (ix * iy > small * 0.25) bad.push('겹침: "' + A.t.slice(0, 16) + '" × "' + B.t.slice(0, 16) + '"');
  }
  // 버튼이 화면 밖이거나 서로 겹치는지
  const btns = [...stage.querySelectorAll('button,[data-do]')].filter(e => !e.closest('.hide') && e.offsetParent !== null);
  for (const e of btns) { const r = e.getBoundingClientRect(); if (r.right > sr.right + 1 || r.bottom > sr.bottom + 1 || r.left < sr.left - 1 || r.top < sr.top - 1) bad.push('버튼 화면 밖: ' + (e.textContent || '').trim().slice(0, 16)); }
  return [...new Set(bad)];
};
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [], lint = {}, shots = [];
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  page.on('pageerror', e => errs.push('uncaught: ' + e.message));
  await page.goto('file://' + path.resolve(dir, 'index.html') + '?manual=1&seed=' + seed);
  const G = (fn, arg) => page.evaluate(fn, arg);
  const step = n => G(n => window.game.step(n), n);
  const st = () => G(() => { const s = window.game.state; return { scene: window.game.scene, day: s.day, slot: s.slot, cash: s.cash, worth: s.worth, hp: s.hp, tier: s.tier, quest: s.quest, modal: s.modal, ended: s.ended, price: s.housePrice }; });
  const seen = new Set();
  async function shot(name, once = true) {
    if (once && seen.has(name)) return; seen.add(name);
    await page.waitForTimeout(420); // 뜨는 연출이 끝난 뒤에 찍음
    const p = path.join(out, name + '.png'); await page.screenshot({ path: p }); shots.push(p);
    const l = await G(LINT); if (l.length) lint[name] = l;
  }
  if (process.env.BOOST) await G(k => { for (const n of ['pay_flyer', 'pay_loading', 'pay_store', 'pay_delivery']) window.CONFIG[n].value *= k; }, Number(process.env.BOOST)); // 점검용: 뒤쪽 화면까지 빨리 가려고 일당만 올림
  await shot('01_title');
  await page.click('[data-do="new"]'); await step(20);
  await shot('02_intro');
  let guard = 0, mgShot = 0;
  const M = 10000;
  while (guard++ < 4000) {
    const s = await st();
    if (s.scene !== 'play') break;
    if (s.modal === 'mg') {
      // 미니게임: 일정 간격으로 그 게임의 키를 눌러 봄 (사람 흉내는 아님 — 끝까지 가는지만)
      const info = await G(() => { const m = document.querySelectorAll('[data-mg]'); return [...m].map(b => b.dataset.mg); });
      for (let i = 0; i < 40; i++) {
        const done = await G(() => !!document.querySelector('.mg-res')); if (done) break;
        if (info.length) await G(c => window.game.press(c), info[(i * 7 + guard) % info.length]);
        await step(16);
        if (i === 12 && mgShot < 4) { const id = await G(() => document.querySelector('.mg-head b').textContent); await shot('mg_' + (++mgShot) + '_' + id.replace(/\s/g, '')); }
      }
      await shot('03_mg_result');
      await step(30); await G(() => window.game.press('Space')); await step(20);
      continue;
    }
    if (s.modal) {
      await shot('pop_' + s.modal + (s.modal === 'quest' ? '_' + s.quest : ''), s.modal !== 'quest' || s.quest < 4);
      await step(20); await G(() => window.game.press('Space')); await step(20);
      continue;
    }
    // 창이 없을 때: 화면 점검 한 번씩
    if (s.day === 1 && s.slot === 0) await shot('04_play_day1');
    if (s.tier === 1) await shot('05_sauna');
    if (s.tier === 2) await shot('06_gosiwon_ladder');
    // 주거 올리기
    if (s.tier === 2 && s.worth >= 800 * M && s.cash < 700 * M && style !== 'alba' && !(await G(() => !!document.querySelector('[data-do="move"]')))) { // 원룸 보증금을 만들려고 주식을 정리
      await G(() => { const g = window.game, S = g.state.raw; for (const a of ['daejang', 'buldak', 'hantang']) if (S.hold[a].units > 0) { g.run('tab', 'stock'); g.run('sel', a); g.run('sell', '1'); } g.run('tab', 'ladder'); });
      continue;
    }
    const mv = await G(() => { const b = document.querySelector('[data-do="move"]'); return b ? Number(b.dataset.arg) : 0; });
    const reserve = mv === 3 ? 250 * M : mv === 2 ? 5 * M : 0;
    if (mv && style !== 'stay') {
      const need = await G(t => { const R = window.Rules, S = window.game.state.raw; return R.moveInfo(S, t).need; }, mv);
      if (s.cash >= need + reserve) { await page.click('[data-do="move"]'); await step(20); if (mv >= 2) { await shot('07_confirm_move' + mv); await G(() => window.game.press('Space')); await step(20); } continue; }
    }
    if (s.worth >= s.price) { await G(() => window.game.run('tab', 'ladder')); await shot('20_house_ready'); await page.click('[data-do="house"]'); await step(20); await shot('21_confirm_house'); await G(() => window.game.press('Space')); await step(20); continue; }
    // 투자 (공부형: 리포트 · 공시 · 기사를 따름)
    if (s.tier >= 2 && style !== 'alba') {
      await G(({ style, M }) => {
        const R = window.Rules, S = window.game.state.raw, g = window.game;
        const b = R.bill(S), keep = (b ? b.amt : 0) + 10 * M;
        if (S.slot === 0 && !S._traded) {
          S._traded = S.day;
          const news = R.todayNews(S), sig = n => (n.report ? n.report * 2 : n.src === 'official' ? n.dir * 1.5 : n.src === 'article' ? n.dir : 0);
          const nb = news.find(n => n.asset === 'buldak'), nc = news.find(n => n.asset === 'coin');
          const bs = nb ? sig(nb) : 0, cs = nc ? sig(nc) : 0;
          if (S.hold.buldak.units > 0 && bs <= 0) { g.run('tab', 'stock'); g.run('sel', 'buldak'); g.run('sell', '1'); }
          if (S.lev) { g.run('tab', 'coin'); g.run('close'); }
          if (S.tier >= 3 && (cs !== 0 || style === 'gamble') && S.cash > keep + 30 * M) { g.run('tab', 'coin'); g.run('lev', style === 'gamble' ? '5' : '5'); g.run('share', style === 'gamble' ? '1' : '0.5'); g.run(cs >= 0 ? 'long' : 'short'); }
          if (bs > 0 && S.cash > keep + 10 * M) { g.run('tab', 'stock'); g.run('sel', 'buldak'); g.run('buy', String(Math.floor((S.cash - keep) / M) * M)); }
          else if (S.cash > keep + 30 * M && S.hold.buldak.units === 0 && S.tier < 3) { g.run('tab', 'stock'); g.run('sel', 'daejang'); g.run('buy', String(Math.floor((S.cash - keep) * 0.8 / M) * M)); }
        }
        if (S.slot > 0) S._traded = 0;
      }, { style, M });
      if ((await st()).modal) continue;
      if (s.tier === 2) { await G(() => window.game.run('tab', 'stock')); await shot('08_stock'); }
      if (s.tier === 3) { await G(() => window.game.run('tab', 'coin')); await shot('09_coin'); const lev = await G(() => !!window.game.state.raw.lev); if (lev) await shot('10_coin_position'); }
    }
    if (s.slot >= 3) {
      // 고정비 날이면 현금 마련
      await G(M => { const R = window.Rules, S = window.game.state.raw, g = window.game, b = R.bill(S); if (b && b.inDays === 0 && S.cash < b.amt + 3 * M) { for (const a of ['daejang', 'buldak', 'hantang']) if (S.hold[a].units > 0) { g.run('tab', 'stock'); g.run('sel', a); g.run('sell', '1'); } if (S.cash < b.amt + 3 * M && S.lev) { g.run('tab', 'coin'); g.run('close'); } } }, M);
      if ((await st()).modal) continue;
      await shot('11_day_done');
      await page.click('[data-do="endday"]'); await step(20);
      if ((await st()).modal === 'confirm') { await shot('13_sleep_confirm'); await page.click('#veil [data-do="ok"]'); await step(20); }
      await shot('12_night_day' + (s.day <= 1 ? 1 : s.day % 7 === 0 ? 'bill' : 'n'));
      await G(() => window.game.press('Space')); await step(20);
      continue;
    }
    // 칸 행동: 공부형은 자산이 크면 저녁에 공부, 아니면 가장 돈 되는 알바, 안 되면 쉬기
    const pick = await G(({ style, M }) => { const R = window.Rules, S = window.game.state.raw; const acts = R.acts(S); if (style === 'study' && S.slot === 2 && R.worth(S) > 500 * M && acts.find(a => a.kind === 'study')) return ['study', '']; const j = acts.filter(a => a.kind === 'job' && a.ok).sort((a, b) => b.pay - a.pay)[0]; return j ? [(S.day <= 2 || S.day % 5 === 0) ? 'job' : 'skip', j.id] : ['rest', '']; }, { style, M });
    if (process.env.DBG) console.log('pick', JSON.stringify(pick), JSON.stringify(await st()), await G(() => document.getElementById('veil').className + '|' + document.getElementById('veil').innerHTML.slice(0, 120)));
    if (pick[0] === 'job') await page.click('[data-do="job"][data-arg="' + pick[1] + '"]', { position: { x: 20, y: 60 }, timeout: 3000 });
    else if (pick[0] === 'skip') await page.click('[data-do="skip"][data-arg="' + pick[1] + '"]');
    else await page.click('[data-do="' + pick[0] + '"]');
    await step(20);
  }
  const end = await st();
  await step(20);
  await shot('30_results_' + (end.ended ? end.ended.kind : 'none'));
  await page.goto('file://' + path.resolve(dir, 'index.html') + '?manual=1&scene=figures'); await page.screenshot({ path: path.join(out, 'figures.png') });
  console.log(JSON.stringify({ seed, style, loops: guard, end: end.ended, shots: shots.length, errors: errs.slice(0, 8), lint }, null, 1));
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
