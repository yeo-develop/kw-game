// PROTOTYPE - NOT FOR PRODUCTION
// 게임이 불러오지 않는 개발용 도구. 글이 가장 많은 날(소식 3건 + 리포트 3건 + 긴 숫자)의 주식 · 코인 탭이 넘치지 않는지,
// 도장 · 효과 줄이기가 되는지, 창이 몰리는 때(퀘스트 여러 개 · 건너뛰기 · 같은 알림)에 한 장으로 모이는지,
// 속보 띠(든 종목 · 안 든 종목 · 퀘스트 창과 몰릴 때 · 청산과 겹칠 때 · 효과 줄이기)와 양날 특성(카드 · 잠긴 행동의 이유)을 본다.
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
      S.tier = 3; S.cash = 123456789; S.hp = 100; S.day = 13; S.slot = 1; S.arrears = 1495000; S.movedDay = 2;
      const mk = (id, asset, dir, src, head) => ({ id, day: S.day, asset, dir, src, truth: true, mag: 0.1, head });
      S.market.news = [mk(901, 'buldak', -1, 'official', '화끈식품 대주주 지분 매각설'), mk(902, 'daejang', 1, 'article', '대장전자, 대형 공급 계약'), mk(903, 'coin', 1, 'rumor', '달나라코인, 대형 거래소 상장설')];
      S.market.brief = { day: S.day, madeOn: S.day - 1, assets: ['buldak', 'daejang', 'coin'], items: [{ nid: 901, asset: 'buldak', dir: 1 }, { nid: 902, asset: 'daejang', dir: -1 }, { nid: 903, asset: 'coin', dir: 1 }], ht: null };
      S.market.intel = { day: S.day + 1, madeOn: S.day, assets: ['buldak', 'hantang'], items: [{ nid: 1, asset: 'buldak', dir: 1 }], ht: { state: 'lean', lean: -1 } }; // 하루에 리포트는 많아야 두 종목(공부 하나 + 단골의 귀띔 하나). 가장 긴 글: 한탕바이오의 기울기
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
      for (const e of document.querySelectorAll('#board .arow')) { const r = e.getBoundingClientRect(); for (const c of e.querySelectorAll('span, em, i')) { const q = c.getBoundingClientRect(); if (q.width && q.right > r.right + 1) { bad.push('종목 줄 넘침: ' + e.textContent.trim().slice(0, 24)); break; } } }
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
    const drop = () => { S.tier = 2; S.quest = 99; S.offer = null; S.picks = 0; S.event = null; S.xp = 0; S.slot = 0; S.hp = 50; S.hold.hantang = { units: 1000, cost: 3000000 }; S.market.ht = { phase: 'dump', left: 2, drop: 0.4 }; /* 폭락 크기는 규칙이 매집 뒤 오른 만큼으로 정한다 — 점검은 크게 떨어지는 칸을 직접 준다 */ g.render(); g.run('tab', 'stock'); g.run('rest'); };
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
    const g = window.game, S = g.state.raw; S.quest = 7; S.tier = 3; S.cash = 9000000; S.day = 23; S.movedDay = 22; S.slot = 0; S.hp = 50; S.offer = null; S.picks = 0; S.event = null; S.xp = 0; g.render(); g.run('rest'); g.step(60);
    return { modal: g.state.modal, done: document.querySelectorAll('.qdone > div:not(.off)').length, off: document.querySelectorAll('.qdone > .off').length, next: (document.querySelector('.nextbox b') || {}).textContent || '' };
  });
  await page3.waitForTimeout(400); await page3.screenshot({ path: path.join(out, 'quest-skip.png') });
  if (pops.skip.modal !== 'quest' || pops.skip.done !== 2 || pops.skip.off !== 2 || pops.skip.next !== '내 집을 사라') pops.bad.push('건너뛴 퀘스트가 창에 안 적힘: ' + JSON.stringify(pops.skip));
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
  // 속보 띠: 든 종목(손익을 크게 · 도장 없이 · 흔들림 한 번) / 안 든 종목(차분하게) / 퀘스트 창과 한 칸에 몰릴 때(줄을 서서 하나씩) / 효과 줄이기(흔들림 없음)
  const sh = { bad: [] };
  const page4 = await fresh();
  const shock = (pg, o) => pg.evaluate(o => {
    const g = window.game, S = g.state.raw;
    g.meta.fxOff = !!o.calm; document.getElementById('s-play').classList.remove('shake'); document.querySelectorAll('.stamp').forEach(e => e.remove());
    Object.assign(S, { tier: 3, cash: 9000000, day: o.day || 23, movedDay: o.moved || 22, slot: o.slot || 0, hp: 50, offer: null, picks: 0, event: null, xp: 0, quest: o.quest || 99 });
    for (const a of ['daejang', 'buldak', 'hantang']) S.hold[a] = { units: 0, cost: 0 };
    if (o.held) S.hold[o.asset] = { units: 3000, cost: 3000 * S.market.px[o.asset] };
    S.market.shocks.push({ id: 9000 + (o.slot || 0), day: S.day, slot: S.slot, asset: o.asset, pct: o.pct, head: o.head });
    g.render(); g.run('rest');
    const seen = [], wins = [];
    for (let i = 0; i < 8 && g.state.modal; i++) {
      const m = g.state.modal; seen.push(m); wins.push(document.querySelectorAll('#veil .win').length);
      if (m === 'shock' && !seen.slice(0, -1).includes('shock')) Object.assign(o, { text: document.querySelector('#veil .win.shock').textContent, cls: document.querySelector('#veil .win.shock').className, shake: document.getElementById('s-play').classList.contains('shake'), stamp: !!document.querySelector('.stamp'), top: document.querySelector('#veil .win.shock').getBoundingClientRect().top, queue: g.state.queue.slice() });
      g.step(40); g.press(m === 'perk' ? 'Digit1' : m === 'event' ? 'Digit2' : 'Space'); g.step(40); if (g.state.modal === 'event') { g.press('Space'); g.step(40); }
    }
    g.meta.fxOff = false;
    return Object.assign(o, { seen, wins });
  }, o);
  sh.held = await shock(page4, { asset: 'daejang', pct: -0.12, head: '대장전자 회장 사생활 폭로', held: true });
  if (!sh.held.text || !/속보/.test(sh.held.text) || !/대장전자 회장 사생활 폭로/.test(sh.held.text) || !/−12%/.test(sh.held.text) || !/내 대장전자/.test(sh.held.text) || !/−[0-9,]+원/.test(sh.held.text) || !/down/.test(sh.held.cls)) sh.bad.push('든 종목 속보 띠(머리글 · 종목 · % · 내 손익)가 다름: ' + JSON.stringify(sh.held).slice(0, 300));
  if (sh.held.stamp) sh.bad.push('든 종목 속보인데 도장이 같이 찍힘 (한 번만 연출)');
  if (!sh.held.shake) sh.bad.push('든 종목이 속보로 떨어졌는데 흔들림이 없음');
  if (sh.held.top > 200) sh.bad.push('속보 띠가 화면 위쪽이 아님: top ' + sh.held.top);
  await page4.waitForTimeout(100);
  const p5 = await fresh();
  await p5.evaluate(() => { const g = window.game, S = g.state.raw; S.tier = 3; S.quest = 99; g.render(); });
  sh.calmShot = await shock(p5, { asset: 'buldak', pct: 0.18, head: '화끈식품 먹방 영상 1억 뷰', held: false });
  if (!sh.calmShot.text || !/든 것 없음/.test(sh.calmShot.text) || !/calm/.test(sh.calmShot.cls) || sh.calmShot.shake) sh.bad.push('안 든 종목 속보가 차분하지 않음: ' + JSON.stringify(sh.calmShot).slice(0, 240));
  const p6 = await fresh(); // 퀘스트 창과 한 칸에: 원룸에 늦게 들어간 날(끝난 것 둘 + 건너뛴 것 둘) + 속보
  sh.mixed = await shock(p6, { asset: 'daejang', pct: -0.12, head: '대장전자 공장 정전', held: true, quest: 7 });
  if (!(sh.mixed.seen.includes('shock') && sh.mixed.seen.includes('quest')) || sh.mixed.wins.some(n => n !== 1) || sh.mixed.seen.filter(m => m === 'shock').length !== 1 || sh.mixed.seen.filter(m => m === 'quest').length !== 1) sh.bad.push('속보와 퀘스트 창이 몰릴 때 하나씩 차례로 뜨지 않음: ' + JSON.stringify({ seen: sh.mixed.seen, wins: sh.mixed.wins, queue: sh.mixed.queue }));
  const p7 = await fresh();
  sh.calm = await shock(p7, { asset: 'daejang', pct: -0.12, head: '대장전자 공장 정전', held: true, calm: true });
  if (sh.calm.shake || sh.calm.stamp || !sh.calm.text) sh.bad.push('효과 줄이기인데 속보에 흔들림 · 도장이 있음');
  // 흔들림이 겹치지 않게: 코인 포지션이 속보로 청산까지 가면 흔들림은 청산 쪽 한 번
  const p8 = await fresh();
  sh.liq = await p8.evaluate(() => {
    const g = window.game, S = g.state.raw; let shakes = 0; const el = document.getElementById('s-play'), add = el.classList.add.bind(el.classList); el.classList.add = (...c) => { if (c.includes('shake')) shakes++; return add(...c); };
    Object.assign(S, { tier: 3, cash: 9000000, day: 23, movedDay: 22, slot: 0, hp: 50, offer: null, picks: 0, event: null, xp: 0, quest: 99 }); g.meta.seen.coin = 1;
    g.render(); g.run('tab', 'coin'); g.run('lev', '5'); g.run('share', '0.5'); g.run('long'); g.step(40);
    S.market.shocks.push({ id: 9100, day: S.day, slot: S.slot, asset: 'coin', pct: -0.25, head: '달나라코인 거래소 해킹' }); g.run('rest');
    const seen = []; for (let i = 0; i < 6 && g.state.modal; i++) { seen.push(g.state.modal); g.step(40); g.press(g.state.modal === 'perk' ? 'Digit1' : 'Space'); g.step(40); }
    return { seen, shakes };
  });
  if (sh.liq.seen[0] !== 'shock' || sh.liq.seen[1] !== 'liq' || sh.liq.shakes !== 1) sh.bad.push('코인 속보 → 청산: 속보 띠 다음 청산 창, 흔들림 한 번이 아님: ' + JSON.stringify(sh.liq));
  await page4.close(); await p5.close(); await p7.close(); await p8.close();
  await p6.screenshot({ path: path.join(out, 'shock-after-mixed.png') }); await p6.close();
  if (sh.bad.length) report.shock = sh.bad;
  // 속보 띠 화면 두 장 (든 것 · 안 든 것)
  for (const [nm, o] of [['shock-held', { asset: 'daejang', pct: -0.12, head: '대장전자 회장 사생활 폭로', held: true }], ['shock-calm', { asset: 'buldak', pct: 0.18, head: '화끈식품 먹방 영상 1억 뷰', held: false }]]) {
    const pg = await fresh();
    await pg.evaluate(o => { const g = window.game, S = g.state.raw; Object.assign(S, { tier: 3, cash: 9000000, day: 23, movedDay: 22, slot: 0, hp: 50, offer: null, picks: 0, event: null, xp: 0, quest: 99 }); if (o.held) S.hold[o.asset] = { units: 3000, cost: 3000 * S.market.px[o.asset] }; S.market.shocks.push({ id: 9200, day: S.day, slot: 0, asset: o.asset, pct: o.pct, head: o.head }); g.render(); g.run('rest'); g.step(40); }, o);
    await pg.waitForTimeout(450); await pg.screenshot({ path: path.join(out, nm + '.png') }); await pg.close();
  }
  // 양날 특성: 카드(딱지 · 얻는 것 · "대신:" 줄) · '나' 구역 표시(설명에 대신) · 막힌 행동은 잠기고 누르면 이유 (규칙의 deny 도 알림으로 뜸)
  const ag = { bad: [] };
  const p9 = await fresh();
  ag.card = await p9.evaluate(() => { const g = window.game, S = g.state.raw; Object.assign(S, { tier: 3, cash: 9000000, day: 15, movedDay: 12, quest: 99, offer: ['iron', 'coinonly', 'hustle'], picks: 1, lv: 3, event: null }); g.render(); g.run('rest'); g.step(60);
    const cs = [...document.querySelectorAll('#veil .pcard')].map(c => ({ aug: c.classList.contains('aug'), tag: (c.querySelector('.edge') || {}).textContent || '', gain: (c.querySelector('.gain') || {}).textContent || '', con: (c.querySelector('.con') || {}).textContent || '', border: getComputedStyle(c).borderTopColor }));
    return { modal: g.state.modal, cs }; });
  await p9.waitForTimeout(450); await p9.screenshot({ path: path.join(out, 'aug-card.png') });
  { const c = ag.card.cs, a = c.find(x => x.aug), n = c.find(x => !x.aug);
    if (ag.card.modal !== 'perk' || !a || a.tag !== '양날' || !/코인 이익/.test(a.gain) || !/^대신: 이 판 끝까지 주식을 살 수 없다/.test(a.con) || !n || n.tag || n.con || a.border === n.border) ag.bad.push('양날 카드가 다른 카드와 달라 보이지 않거나 딱지 · 얻는 것 · 대신 줄이 없음: ' + JSON.stringify(ag.card)); }
  ag.locks = await p9.evaluate(() => {
    const g = window.game, S = g.state.raw, toasts = () => { const t = [...document.querySelectorAll('#toasts .toast')].map(e => e.textContent); document.querySelectorAll('#toasts .toast').forEach(e => e.remove()); return t; };
    g.press('Digit2'); g.step(60); g.meta.seen.coin = 1; g.meta.seen.stock = 1;
    const out = { perks: Object.assign({}, S.perks) };
    g.run('tab', 'stock'); toasts();
    out.pk = (document.querySelector('#me .pk.aug') || {}).title || '';
    out.buys = [...document.querySelectorAll('#board .buys button')].map(e => e.dataset.do);
    document.querySelector('#board .buys button').click(); g.step(2); out.buyClick = toasts();
    g.run('buy', '0.25'); g.step(2); out.buyRule = toasts(); out.bought = S.stats.bought;
    S.perks = { stockonly: 1, beast: 1, workaholic: 1 }; S.slot = 1; S.hp = 100; g.render(); g.run('tab', 'coin'); toasts();
    out.order = [...document.querySelectorAll('#board .order button')].map(e => e.dataset.do);
    document.querySelector('#board .order button').click(); g.step(2); out.longClick = toasts();
    g.run('long'); g.step(2); out.longRule = toasts(); out.lev = !!S.lev;
    out.levs = [...document.querySelector('#board .levform .seg.pick').children].map(e => e.dataset.do + ':' + e.textContent);
    document.querySelector('#board .levform .seg.pick button').click(); g.step(2); out.levClick = toasts();
    const rest = document.querySelector('#today .card[data-arg="일중독: 할 수 있는 알바가 있으면 쉬지 않는다"]'); out.rest = !!rest; if (rest) rest.click(); g.step(2); out.restClick = toasts();
    return out; });
  await p9.waitForTimeout(300); await p9.screenshot({ path: path.join(out, 'aug-locked.png') }); await p9.close();
  { const l = ag.locks;
    if (!/양날/.test(l.pk) || !/대신: 이 판 끝까지 주식을 살 수 없다/.test(l.pk)) ag.bad.push("'나' 구역의 양날 특성 설명에 대신이 없음: " + l.pk);
    if (l.buys.some(d => d !== 'why') || !/코인 외길 — 대신 이 판 끝까지 주식을 살 수 없다/.test(l.buyClick.join())) ag.bad.push('코인 외길인데 주식 사기가 안 잠기거나 이유가 안 뜸: ' + JSON.stringify(l));
    if (!/코인 외길: 주식을 살 수 없습니다/.test(l.buyRule.join()) || l.bought) ag.bad.push('규칙의 deny 이유가 화면에 안 뜸 (코인 외길 사기): ' + JSON.stringify(l.buyRule));
    if (l.order.some(d => d !== 'why') || !/주식 외길 — 대신 이 판 끝까지 코인을 할 수 없다/.test(l.longClick.join()) || !/주식 외길: 코인을 할 수 없습니다/.test(l.longRule.join()) || l.lev) ag.bad.push('주식 외길인데 롱 · 숏이 안 잠기거나 이유가 안 뜸: ' + JSON.stringify(l));
    if (l.levs.join() !== 'why:1배,why:2배,lev:3배,lev:5배' || !/야수의 심장/.test(l.levClick.join())) ag.bad.push('야수의 심장인데 1 · 2배가 안 잠기거나 이유가 안 뜸: ' + JSON.stringify(l.levs) + JSON.stringify(l.levClick));
    if (!l.rest || !/일중독/.test(l.restClick.join())) ag.bad.push('일중독인데 쉬기가 안 잠기거나 이유가 안 뜸: ' + JSON.stringify(l.restClick)); }
  if (ag.bad.length) report.aug = ag.bad;
  console.log(JSON.stringify({ errors: errs, report, fx: fxr, popups: pops, shock: sh, aug: ag }, null, 1));
  if (errs.length || Object.values(report).some(v => v.length)) process.exitCode = 1;
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
