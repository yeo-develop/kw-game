// PROTOTYPE - NOT FOR PRODUCTION
// 게임이 불러오지 않는 개발용 도구. 글이 가장 많은 날(소식 6건 + 리포트 3줄 + 긴 숫자)에 판의 일곱 탭(주식은 장 보기 · 내 보유 · 종목 상세)이 넘치지 않는지,
// 도장 · 효과 줄이기가 되는지, 창이 몰리는 때(퀘스트 여러 개 · 건너뛰기 · 같은 알림)에 한 장으로 모이는지,
// 속보 띠(든 종목 · 안 든 종목 · 퀘스트 창과 몰릴 때 · 청산과 겹칠 때 · 효과 줄이기)와 양날 특성(카드 · 잠긴 행동의 이유), 가장 긴 일당(카드 · 시작 전 화면의 강도 버튼)을 본다.
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
    await pg.evaluate(() => { window.game.state.raw.beats = ['family1', 'family2', 'sign1', 'sign2', 'landlord1', 'landlord2']; }); // 꿈의 장면 창은 여기서 보지 않는다 (사는 곳을 건너뛰는 점검마다 끼어들지 않게 — 본 것으로 해 둔다)
    return pg;
  };
  const page = await fresh();
  const step = n => page.evaluate(n => window.game.step(n), n);
  const report = {};
  // 판(오른쪽 아래)의 일곱 탭 + 주식의 세 화면을 글이 가장 많은 상태로 열어, 칸 밖으로 나가거나 · 말줄임 없이 잘리거나 · 옆 칸과 겹치는 글이 없는지 본다.
  // A = 원룸(종목 일곱을 전부 들고, 소식 여섯 건 + 속보 경보, 리포트 세 줄, 큰 숫자) · B = 호텔(상가 다섯 — 하나는 공실, 주담대 + 마이너스 통장, 물건 전부)
  const SCAN = () => {
    const bad = [], cut = [], B = document.getElementById('board'), P = B.getBoundingClientRect(), St = document.getElementById('quest').getBoundingClientRect();
    const lab = e => ((e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 22) || e.className || e.tagName);
    const road = !!B.querySelector('.road, .rungs, .rung'); // 로드맵은 그림 위에 겹쳐 놓는 것이 많아 겹침 검사는 하지 않는다
    for (const z of document.querySelectorAll('[data-zone]')) { const zr = z.getBoundingClientRect(); for (const e of z.querySelectorAll('button, .chip, .pk, .ic, b, span')) { const r = e.getBoundingClientRect(); if (r.width && (r.right > zr.right + 1 || r.bottom > zr.bottom + 1 || r.left < zr.left - 1)) { bad.push('구역 밖(' + z.dataset.zone + '): ' + lab(e)); break; } } }
    const clipped = e => { for (let q = e.parentElement; q && q !== B; q = q.parentElement) { const o = getComputedStyle(q); if (o.overflowX !== 'visible' || o.overflowY !== 'visible') return true; } return false; };
    for (const e of B.querySelectorAll('*')) {
      const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
      const cs = getComputedStyle(e);
      if (!clipped(e) && (r.bottom > P.bottom + 0.5 || r.right > P.right + 0.5 || r.left < P.left - 0.5 || r.top < P.top - 0.5)) bad.push('판 밖: ' + lab(e) + ' (아래 ' + Math.round(r.bottom - P.bottom) + ' · 오른쪽 ' + Math.round(r.right - P.right) + ')');
      if (e.tagName !== 'CANVAS' && e.tagName !== 'INPUT' && !e.classList.contains('hero') /* 가게의 옷 그림은 일부러 윗몸만 보이게 자른다 */ && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1) && (cs.overflowX !== 'visible' || cs.overflowY !== 'visible')) (cs.textOverflow === 'ellipsis' && e.scrollHeight <= e.clientHeight + 1 ? cut : bad).push((cs.textOverflow === 'ellipsis' ? '말줄임: ' : '잘림: ') + lab(e) + ' (' + e.scrollWidth + ' > ' + e.clientWidth + (e.scrollHeight > e.clientHeight + 1 ? ' · 높이 ' + e.scrollHeight + ' > ' + e.clientHeight : '') + ')');
      if (!road && ((/flex$/.test(cs.display) && cs.flexDirection.indexOf('row') === 0) || /grid$/.test(cs.display))) { // 한 줄에 놓인 칸끼리 겹치면 글이 포개진다 (flex 줄 · grid 줄)
        const kids = [...e.children].filter(k => { const q = k.getBoundingClientRect(); return q.width > 0 && q.height > 0 && getComputedStyle(k).position !== 'absolute'; }).map(k => ({ k, q: k.getBoundingClientRect() })).sort((x, y) => x.q.left - y.q.left);
        for (let i = 1; i < kids.length; i++) { const x = kids[i - 1].q, y = kids[i].q; if (Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top) > 2 && x.right - y.left > 1.5) { bad.push('겹침: ' + lab(kids[i - 1].k) + ' ↔ ' + lab(kids[i].k)); break; } }
      }
    }
    for (const e of B.querySelectorAll('.arow')) { const r = e.getBoundingClientRect(); for (const c of e.querySelectorAll('span, em, i')) { const q = c.getBoundingClientRect(); if (q.width && q.right > r.right + 1) { bad.push('종목 줄 넘침: ' + lab(e)); break; } } }
    for (const e of document.querySelectorAll('#quest .chip')) { const r = e.getBoundingClientRect(); if (r.right > St.right - 10) bad.push('상태창 칩 넘침: ' + e.textContent); }
    for (const c of document.querySelectorAll('#today .card')) { const r = c.getBoundingClientRect(); for (const e of c.querySelectorAll('.nm, .st, .st > span, .skip, .auto')) { const q = e.getBoundingClientRect(); if (q.width && (q.right > r.right + 0.5 || q.left < r.left - 0.5)) { bad.push('오늘 칸 카드 밖: ' + lab(e)); break; } } }
    return { bad: [...new Set(bad)], cut: [...new Set(cut)] };
  };
  const WORST = which => {
    const S = window.game.state.raw, g = window.game, R = window.Rules;
    g.meta.seen.stock = 1; g.meta.seen.coin = 1;
    S.event = null; S.offer = null; S.picks = 0; S.combo = 7; S.buff = { nextJob: 1.5 }; S.quest = 99; S.movedDay = 2; S.hp = 100; S.slot = 1;
    S.perks = { iron: 3, sleep: 3, hustle: 3, hands: 2, lazy: 2, streak: 2, thrift: 2, early: 2, quester: 1, legs: 2, sense: 2, vip: 1, tipster: 1, guts: 1 };
    if (which === 'A') {
      S.tier = 3; S.lease = 'rent'; S.deposit = 2000000; S.cash = 123456789; S.day = 13; S.arrears = 1495000; S.know = 20; S.credit = 655; S.cl = 1650000;
      const mk = (id, asset, dir, src, head) => ({ id, day: S.day, asset, dir, src, truth: true, mag: 0.1, head });
      S.market.news = [mk(901, 'buldak', -1, 'official', '화끈식품 대주주 지분 매각설'), mk(902, 'daejang', 1, 'article', '대장전자, 대형 공급 계약'), mk(903, 'coin', 1, 'rumor', '달나라코인, 대형 거래소 상장설'),
        mk(904, 'battery', 1, 'article', R.HEAD && R.HEAD.battery ? R.HEAD.battery[1][0] : '번쩍배터리, 전고체 시제품 공개'), mk(905, 'bank', -1, 'official', '튼튼은행, 충당금 크게 쌓는다'), mk(906, 'build', 1, 'rumor', '뚝딱건설, 재개발 대단지 수주설')]; // 하루에 많아야 종목마다 하나 = 여섯 건
      S.market.shocks = S.market.shocks.filter(x => x.id !== 990).concat([{ id: 990, day: S.day, slot: 2, asset: 'daejang', pct: -0.12, head: '대장전자 공장 정전' }]); // 공부 5단계의 속보 경보 한 줄 (하루에 속보는 많아야 하나)
      S.market.brief = { day: S.day, madeOn: S.day - 1, assets: ['buldak', 'daejang', 'coin'], items: [{ nid: 901, asset: 'buldak', dir: 1 }, { nid: 902, asset: 'daejang', dir: -1 }, { nid: 903, asset: 'coin', dir: 1 }], ht: null };
      S.market.intel = { day: S.day + 1, madeOn: S.day, assets: ['buldak', 'hantang', 'game'], items: [{ nid: 1, asset: 'buldak', dir: 1 }], ht: { state: 'lean', lean: -1 }, gm: { state: 'lean', lean: 1 } }; // 리포트: 공부 두 종목 + 귀띔 하나. 가장 긴 글은 한탕바이오 · 꿀잼게임즈의 기울기
      for (const id of ['daejang', 'bank', 'buldak', 'battery', 'hantang', 'game', 'build', 'etf', 'gold']) { const u = id === 'hantang' ? 30000 : 12345; S.hold[id] = { units: u, cost: Math.round(u * S.market.px[id] * 1.31), min: u }; }
      S.market.world = [{ id: 9701, type: 'flu', day: S.day - 1, days: 3, warn: false, truth: true, done: 1 }, { id: 9702, type: 'holiday', day: S.day + 1, days: 2, warn: true, truth: true, told: 1, pre: 1 }]; // 2026-11-21: 오늘의 세상 사건(이름이 가장 긴 재난) + 내일 예보 — 오늘 칸 머리줄의 칩 둘 · 뉴스 탭의 두 줄
      S.crLog = [7, 14, 21, 28, 35, 42, 49].map((d, i) => ({ day: d, n: i % 3 === 2 ? -150 : 15, why: i % 3 === 2 ? '통장을 한도 가까이 씀' : '정산을 12번 연속 제때 냄', cat: 'pay' })); S.cr = { pay: -150, debt: -40, age: 130, asset: 200, mix: 120 }; S.crStreak = 12; S.crWeeks = 24; S.rentPaid = 24; S.addr = 1;
      S.market.px.hantang = 3894.4; S.market.ht = { phase: 'pump', left: 2, real: true }; S.market.gm = Object.assign({}, S.market.gm, { phase: 'hype', left: 2 });
    } else {
      S.tier = 8; S.lease = 'own'; S.deposit = 0; S.cash = 98765432100; S.day = 153; S.arrears = 0; S.know = 20; S.credit = 915; S.cl = 2450000000; S.biz = 5; S.homeVal = 6800000000;
      S.re = Object.assign({}, S.re, { idx: 1.934, last: -0.021, hint: 0.7, hist: [1, 1.04, 1.1, 1.08, 1.21, 1.3, 1.28, 1.41, 1.52, 1.6, 1.71, 1.69, 1.8, 1.88, 1.97, 1.934] });
      S.loan = { balance: 2160000000, orig: 2700000000, day: 150, rate: 0.0288 };
      S.props = {}; for (const p of R.PROPS) S.props[p.id] = { cost: 1234567000, day: 100, vacant: p.id === 'office' ? 2 : 0 };
      S.items = {}; for (const it of R.ITEMS) S.items[it.id] = 1; S.wear = 'gold'; S.ate = 0;
      for (const a of R.ASSETS) if (a.kind === 'stock') S.hold[a.id] = { units: 99999, cost: 99999 * S.market.px[a.id] * 1.31, min: 99999 }; // 2026-11-21: 종목 열넷을 전부 (장 보기 · 내 보유의 세 줄 칸)
      S.lev = { dir: -1, lev: 3, put: 2400000000, margin: 2400000000, entry: S.market.px.doge, day: S.day, id: 'doge' };
      S.market.news = ['buldak', 'daejang', 'coin', 'battery', 'bank', 'build', 'air', 'energy', 'insure', 'defense', 'doge'].map((asset, i) => ({ id: 930 + i, day: S.day, asset, dir: i % 2 ? 1 : -1, src: ['official', 'article', 'rumor'][i % 3], truth: true, mag: 0.1, pre: 0.03, head: (R.ASSETS.find(a => a.id === asset) || {}).name + ', 하루 만에 사상 최대 규모 계약 체결설' })); // 소식이 가장 많은 날 (열한 건)
      S.market.world = [{ id: 9703, type: 'ease', day: S.day, days: 1, warn: false, truth: true, done: 1 }, { id: 9704, type: 'holiday', day: S.day + 1, days: 2, warn: true, truth: true, told: 1, pre: 1 }];
      S.crLog = [7, 14, 21, 28, 35, 42, 49].map((d, i) => ({ day: 100 + d, n: i % 3 === 2 ? -150 : 15, why: i % 3 === 2 ? '통장을 한도 가까이 씀' : '정산을 12번 연속 제때 냄', cat: 'pay' })); S.cr = { pay: 300, debt: -40, age: 130, asset: 225, mix: 290 }; S.crStreak = 12; S.crWeeks = 24; S.rentPaid = 24; S.addr = 1; S.title = '재계 인사';
      S.inten = {}; for (const j of R.JOBS) S.inten[j.id] = 3; for (const id in S.jobs) S.jobs[id] = 99;
    }
    g.render();
  };
  const VIEWS = [['A', 'stock', g => { g.run('tab', 'stock'); g.run('sview', 'market'); }], ['A', 'stock-detail', g => { g.run('tab', 'stock'); g.run('sel', 'hantang'); g.run('qty', 'max'); }], ['A', 'stock-mine', g => { g.run('tab', 'stock'); g.run('sview', 'mine'); }],
    ['A', 'info', g => g.run('tab', 'info')], ['A', 'coin', g => g.run('tab', 'coin')], ['A', 'coin-open', g => { g.run('tab', 'coin'); if (!g.state.raw.lev) { g.run('lev', '5'); g.run('share', '1'); g.step(40, false); g.run('long'); g.step(40, false); } g.run('tab', 'coin'); }],
    ['A', 'realty', g => g.run('tab', 'realty')], ['A', 'bank', g => { g.run('tab', 'bank'); g.run('bamt', 'room'); }], ['A', 'shop', g => g.run('tab', 'shop')], ['A', 'road', g => g.run('tab', 'road')],
    ['B', 'B-stock', g => { g.run('tab', 'stock'); g.run('sview', 'market'); }], ['B', 'B-info', g => g.run('tab', 'info')], ['B', 'B-coin', g => g.run('tab', 'coin')], ['B', 'B-jobs-old', g => { g.run('tab', 'road'); g.run('jpage', '-1'); g.run('jpage', '-1'); }],
    ['B', 'B-realty', g => g.run('tab', 'realty')], ['B', 'B-bank', g => { g.run('tab', 'bank'); g.run('bamt', 'room'); }], ['B', 'B-shop', g => g.run('tab', 'shop')], ['B', 'B-stock-mine', g => { g.run('tab', 'stock'); g.run('sview', 'mine'); }], ['B', 'B-stock-detail', g => { g.run('tab', 'stock'); g.run('sel', 'daejang'); g.run('qty', 'max'); }], ['B', 'B-road', g => g.run('tab', 'road')]];
  const cuts = {};
  for (const [which, name, open] of VIEWS) {
    await page.evaluate(([w, fn]) => { (0, eval)('(' + w + ')')(fn.which); (0, eval)('(' + fn.open + ')')(window.game); window.game.render(); }, [WORST.toString(), { which, open: open.toString() }]);
    await step(40);
    const tabs = await page.evaluate(() => ({ on: (document.querySelector('#board .tabs .on') || {}).textContent || '', modal: window.game.state.modal }));
    if (tabs.modal) { await page.evaluate(() => { const g = window.game; for (let i = 0; i < 6 && g.state.modal; i++) { g.press(g.state.modal === 'perk' ? 'Digit1' : 'Space'); g.step(40); } }); await page.evaluate(([w, fn]) => { (0, eval)('(' + fn.open + ')')(window.game); window.game.render(); }, [0, { open: open.toString() }]); await step(20); }
    await page.screenshot({ path: path.join(out, name + '.png') });
    const r = await page.evaluate('(' + SCAN.toString() + ')()');
    report[name] = r.bad; if (r.cut.length) cuts[name] = r.cut;
  }
  report.views = VIEWS.length === Object.keys(report).length ? [] : ['본 화면 수가 다름'];
  const WIN = () => {
    const w = document.querySelector('#veil .win'), bad = [];
    if (!w) return ['창이 안 뜸'];
    const r = w.getBoundingClientRect(), st = document.getElementById('stage').getBoundingClientRect(), lab = e => ((e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 22) || e.className || e.tagName);
    if (r.top < st.top - 0.5 || r.bottom > st.bottom + 0.5 || r.left < st.left - 0.5 || r.right > st.right + 0.5) bad.push('창이 화면 밖: ' + [r.left, r.top, r.right, r.bottom].map(Math.round).join(','));
    for (const e of w.querySelectorAll('*')) {
      const q = e.getBoundingClientRect(), cs = getComputedStyle(e); if (!q.width || !q.height || cs.position === 'absolute') continue;
      if (q.right > r.right + 0.5 || q.bottom > r.bottom + 0.5 || q.left < r.left - 0.5) { bad.push('창 밖: ' + lab(e)); break; }
      if ((e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1) && (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') && !(cs.textOverflow === 'ellipsis' && e.scrollHeight <= e.clientHeight + 1)) bad.push('잘림: ' + lab(e));
    }
    return [...new Set(bad)];
  };
  const wins = [['A', 'win-credit-A', g => g.run('credit')], ['B', 'win-credit-B', g => g.run('credit')], ['B', 'win-study', g => g.run('study')], ['B', 'win-achs', g => g.run('achs')],
    ['B', 'win-world', g => { const S = g.state.raw, R = window.Rules; S.ev.push({ t: 'world', type: 'quake', name: '부동산 규제 완화', icon: 'quake', kind: '재난', head: '중앙은행이 기준금리를 올렸습니다 그리고 새벽에 지진이 났습니다', sum: '편의점 · 카페 일당 −15% · 배달 +20% · 고시원 아래는 밤 회복 −5', days: 3, moved: R.ASSETS.map(a => ({ id: a.id, name: a.name, pct: -0.155 })), re: -0.0296, hp: -6, cost: 987654321000, owe: 123456789000, warn: false }); g.run('wear', S.wear); }]];
  for (const [which, name, open] of wins) {
    await page.evaluate(([w, fn]) => { const g = window.game; for (let i = 0; i < 6 && g.state.modal; i++) { g.press('Space'); g.step(40); } (0, eval)('(' + w + ')')(fn.which); g.state.raw.slot = 1; g.render(); (0, eval)('(' + fn.open + ')')(g); }, [WORST.toString(), { which, open: open.toString() }]);
    await step(40); await page.screenshot({ path: path.join(out, name + '.png') });
    report[name] = await page.evaluate('(' + WIN.toString() + ')()');
    if (name === 'win-credit-B') { const t = await page.evaluate(() => (document.querySelector('#veil .win') || {}).textContent || ''); for (const k of ['신용 보고서', '상환 이력', '부채 수준', '거래 기간', '소득과 자산', '계약과 소비', '등급표', '최근 변동', '최우량', '대출 불가']) if (t.indexOf(k) < 0) report[name].push('신용 보고서에 "' + k + '"가 없음'); }
    await page.evaluate(() => { const g = window.game; for (let i = 0; i < 6 && g.state.modal; i++) { g.press('Space'); g.step(40); } });
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
  if (pops.morning.modal !== 'quest' || pops.morning.rows !== 2 || pops.morning.next !== '든든하게 먹어라') pops.bad.push('두 퀘스트가 한 장에 안 모임: ' + JSON.stringify(pops.morning));
  if (pops.morning.event) pops.bad.push('퀘스트가 끝난 아침에 돌발 사건이 겹침');
  pops.after = await page3.evaluate(() => { const g = window.game; g.press('Space'); g.step(60); const m = g.state.modal; if (m === 'perk') { g.press('Digit1'); g.step(60); } return { then: m, last: g.state.modal }; });
  if (pops.after.then === 'quest' || pops.after.last) pops.bad.push('퀘스트 창 뒤에 창이 더 남음: ' + JSON.stringify(pops.after));
  pops.skip = await page3.evaluate(() => { // 원룸에 늦게 들어간 날: 때가 지나 건너뛴 것 둘(수익 실현 · 세력) + 끝난 것 둘(신용 500점 · 원룸) → 한 장
    const g = window.game, S = g.state.raw; S.quest = 7; S.tier = 3; S.lease = 'rent'; S.deposit = 2000000; S.credit = 520; S.cash = 3000000; /* 내 집 값에 한참 못 미치는 돈: 전세 · 레버리지 퀘스트가 건너뛰어지지 않게 */ S.day = 23; S.movedDay = 22; S.slot = 0; S.hp = 50; S.offer = null; S.picks = 0; S.event = null; S.xp = 0; g.render(); g.run('rest'); g.step(60);
    return { modal: g.state.modal, done: document.querySelectorAll('.qdone > div:not(.off)').length, off: document.querySelectorAll('.qdone > .off').length, next: (document.querySelector('.nextbox b') || {}).textContent || '' };
  });
  await page3.waitForTimeout(400); await page3.screenshot({ path: path.join(out, 'quest-skip.png') });
  if (pops.skip.modal !== 'quest' || pops.skip.done !== 2 || pops.skip.off !== 2 || pops.skip.next !== '전세로 갈아타라') pops.bad.push('건너뛴 퀘스트가 창에 안 적힘: ' + JSON.stringify(pops.skip));
  pops.toast = await page3.evaluate(() => {
    const g = window.game, S = g.state.raw; g.press('Space'); g.step(60); if (g.state.modal === 'perk') { g.press('Digit1'); g.step(60); }
    for (let i = 0; i < 4; i++) g.run('why', '현금이 모자랍니다');
    const same = [...document.querySelectorAll('#toasts .toast')].filter(e => /현금이 모자랍니다/.test(e.textContent)).length;
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
    Object.assign(S, { tier: 3, lease: 'rent', deposit: 2000000, credit: 520, cash: 9000000, day: o.day || 23, movedDay: o.moved || 22, slot: o.slot || 0, hp: 50, offer: null, picks: 0, event: null, xp: 0, quest: o.quest || 99 });
    for (const a of ['daejang', 'buldak', 'hantang']) S.hold[a] = { units: 0, cost: 0, min: 0 };
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
    S.market.shocks.push({ id: 9100, day: S.day, slot: S.slot, asset: 'coin', pct: -0.4, head: '달나라코인 거래소 해킹' }); g.run('rest'); // −40%: 그 칸의 평소 출렁임이 어느 쪽이든 5배 롱은 청산된다
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
  { // 청산 창 한 장 (화면 모음용): 코인 롱 5배가 속보에 청산까지
    const pg = await fresh();
    const seen = await pg.evaluate(() => { const g = window.game, S = g.state.raw; Object.assign(S, { tier: 3, lease: 'rent', deposit: 2000000, cash: 9000000, day: 23, movedDay: 22, slot: 0, hp: 50, offer: null, picks: 0, event: null, xp: 0, quest: 99 }); g.meta.seen.coin = 1;
      g.render(); g.run('tab', 'coin'); g.run('lev', '5'); g.run('share', '0.5'); g.run('long'); g.step(40);
      S.market.shocks.push({ id: 9300, day: S.day, slot: S.slot, asset: 'coin', pct: -0.4, head: '달나라코인 거래소 해킹' }); g.run('rest');
      const seen = []; for (let i = 0; i < 6 && g.state.modal && g.state.modal !== 'liq'; i++) { seen.push(g.state.modal); g.step(40); g.press(g.state.modal === 'perk' ? 'Digit1' : 'Space'); g.step(40); } seen.push(g.state.modal); return seen; });
    await pg.waitForTimeout(450); await pg.screenshot({ path: path.join(out, 'liq.png') }); await pg.close();
    if (seen[seen.length - 1] !== 'liq') (report.liqShot = report.liqShot || []).push('청산 창을 찍지 못함: ' + seen.join(' → ')); }
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
    const out = { perks: Object.assign({}, S.perks), after: [] };
    for (let i = 0; i < 6 && g.state.modal; i++) { out.after.push(g.state.modal); g.press('Space'); g.step(60); } // 특성을 고른 뒤 이어 뜨는 창(꿈의 장면 등)을 닫는다
    g.run('tab', 'stock'); toasts();
    out.pk = (document.querySelector('#me .pk.aug') || {}).title || '';
    g.run('sel', 'daejang'); toasts(); // 종목 상세: "사기"가 잠기고(팔기는 그대로), 누르면 이유
    out.buys = [...document.querySelectorAll('#board .order2 .btn.up')].map(e => e.dataset.do); out.sells = [...document.querySelectorAll('#board .order2 .btn.down')].map(e => e.dataset.do);
    document.querySelector('#board .order2 .btn.up').click(); g.step(2); out.buyClick = toasts();
    g.run('buyq'); g.step(2); out.buyRule = toasts(); g.run('buy', '0.25'); g.step(2); out.buyRule = out.buyRule.concat(toasts()); out.bought = S.stats.bought;
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
    if (!l.buys.length || l.buys.some(d => d !== 'why') || l.sells.join() !== 'sellq' || !/코인 외길 — 대신 이 판 끝까지 주식을 살 수 없다/.test(l.buyClick.join())) ag.bad.push('코인 외길인데 주식 사기가 안 잠기거나 이유가 안 뜸: ' + JSON.stringify(l));
    if (!/코인 외길: 주식을 살 수 없습니다/.test(l.buyRule.join()) || l.bought) ag.bad.push('규칙의 deny 이유가 화면에 안 뜸 (코인 외길 사기): ' + JSON.stringify(l.buyRule));
    if (l.order.some(d => d !== 'why') || !/주식 외길 — 대신 이 판 끝까지 코인을 할 수 없다/.test(l.longClick.join()) || !/주식 외길: 코인을 할 수 없습니다/.test(l.longRule.join()) || l.lev) ag.bad.push('주식 외길인데 롱 · 숏이 안 잠기거나 이유가 안 뜸: ' + JSON.stringify(l));
    if (l.levs.join() !== 'why:1배,why:2배,lev:3배,lev:5배' || !/야수의 심장/.test(l.levClick.join())) ag.bad.push('야수의 심장인데 1 · 2배가 안 잠기거나 이유가 안 뜸: ' + JSON.stringify(l.levs) + JSON.stringify(l.levClick));
    if (!l.rest || !/일중독/.test(l.restClick.join())) ag.bad.push('일중독인데 쉬기가 안 잠기거나 이유가 안 뜸: ' + JSON.stringify(l.restClick)); }
  if (ag.bad.length) report.aug = ag.bad;
  // 가장 긴 일당(재벌 · 숙련 3 · 일머리 3 · 일중독 · 최상 = 10억 단위): 오늘 칸 카드와 시작 전 화면의 강도 버튼 · 창 머리에서 글자가 안 잘림
  const pl = await fresh(), lp = { bad: [] };
  const fit = sel => pl.evaluate(sel => [...document.querySelectorAll(sel)].map(b => { const r = b.getBoundingClientRect(), cs = getComputedStyle(b), bw = parseFloat(cs.borderLeftWidth), bb = parseFloat(cs.borderBottomWidth), kids = [...b.querySelectorAll('.nm, .st, .st > span, .skip, .ich, b, span:not(.lv):not(.key)')].filter(e => e.getBoundingClientRect().width && !e.closest('.lv, .tag'));
    return { t: b.textContent.trim().slice(0, 40), over: kids.filter(e => { const q = e.getBoundingClientRect(); return q.right > r.right - bw + 0.5 || q.left < r.left + bw - 0.5 || q.bottom > r.bottom - bb + 0.5; }).map(e => e.className || e.tagName) }; }), sel); // 글 · 버튼이 틀(테두리) 안쪽에 다 들어오는지
  lp.want = await pl.evaluate(() => { const g = window.game, S = g.state.raw; Object.assign(S, { tier: 8, biz: 5, hp: 100, slot: 2, quest: 99, offer: null, picks: 0, event: null, xp: 0, perks: { hustle: 3, workaholic: 1 }, inten: {} }); for (const j of window.Rules.JOBS) S.inten[j.id] = 3; for (const id in S.jobs) S.jobs[id] = 99; S.market.world = []; g.render(); return window.Rules.acts(S).filter(a => a.kind === 'job').slice(-4).map(a => window.Rules.num(a.levels[3].pay)); }); // 오늘 칸에 보이는 넷(새로 열린 일부터) · 저녁 칸이라 대리도 열려 있다
  await pl.evaluate(() => window.game.step(10)); await pl.screenshot({ path: path.join(out, 'long-pay-cards.png') });
  lp.cards = await fit('#today .card');
  lp.cardPays = await pl.evaluate(() => [...document.querySelectorAll('#today .card .pay')].map(e => e.textContent));
  lp.wantIb = await pl.evaluate(() => window.Rules.num(window.Rules.acts(window.game.state.raw).find(a => a.id === 'advise').levels[3].pay)); // 가장 많이 주는 일(자문)의 최상
  await pl.evaluate(() => { const g = window.game; g.run('job', 'advise'); g.step(30); });
  await pl.waitForTimeout(300); await pl.screenshot({ path: path.join(out, 'long-pay-pre.png') });
  lp.ib = await fit('#veil .ib'); lp.head = await fit('#veil .mg-head'); lp.line = await fit('#veil .mg-line');
  lp.ibPays = await pl.evaluate(() => [...document.querySelectorAll('#veil .ib .p')].map(e => e.textContent));
  if (Math.max(...lp.want.map(s => s.length)) < 13) lp.bad.push('점검이 10억 단위 일당을 못 만듦: ' + lp.want.join(' · '));
  { const short = lp.want.some(t => t.length > 11), v = t => Number(t.replace(/,/g, '')) / 1e8, eok = t => (v(t) >= 10 ? Math.floor(v(t)) : Math.floor(v(t) * 10) / 10) + '억'; // 하나라도 10억이 넘으면 알바 카드 전부 줄임 ("13억" · "7.2억")
    if (!short || lp.cardPays.some((t, i) => t !== eok(lp.want[i]))) lp.bad.push('카드의 일당이 최상의 일당이 아니거나, 한 줄에 줄임 표기와 긴 숫자가 섞임: ' + lp.cardPays.join(' · ') + ' ≠ ' + lp.want.join(' · ')); }
  if (lp.ibPays[3] !== lp.wantIb) lp.bad.push('최상 버튼의 일당이 다름: ' + lp.ibPays[3] + ' ≠ ' + lp.wantIb);
  for (const k of ['cards', 'ib', 'head', 'line']) for (const x of lp[k]) if (x.over.length) lp.bad.push('긴 일당에서 틀 밖으로 나감(' + k + ' · ' + x.over.join() + '): ' + x.t);
  await pl.close();
  if (lp.bad.length) report.longPay = lp.bad;
  console.log(JSON.stringify({ errors: errs, report, cuts, fx: fxr, popups: pops, shock: sh, aug: ag, longPay: lp }, null, 1));
  if (errs.length || Object.values(report).some(v => v.length)) process.exitCode = 1;
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
