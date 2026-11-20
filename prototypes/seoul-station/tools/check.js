// PROTOTYPE - NOT FOR PRODUCTION
// 게임이 불러오지 않는 개발용 도구. 화면 없는 브라우저(Playwright)는 KW_PLAYWRIGHT 환경 변수로 위치를 줄 수 있다.
// 한 판을 화면으로 내 집(1막 끝)까지 몰아 보는 점검 (게임 폴더 밖). 창 없이 돌고, 화면 몇 장을 찍고, 글자 넘침 · 겹침 · 작은 글자 · 콘솔 오류를 모은다.
// 그 뒤 단계(아파트 · 대출 · 미리 갚기 기준 · 사업 · 공부 종목 · 밤사이 갭 · 압류 · 호텔 선언 · 엔딩 · 가장 긴 숫자 · 로드맵 열 단계 · 사는 곳 그림 아홉)는 판 상태를 만들어 넣어 같은 점검을 한다.
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
    const el = n.parentElement; if (el.closest('.hide') || el.closest('#fx') || el.closest('.stamp')) continue; // 알림(#toasts)도 본다: 한 줄 알림 안에서 글이 잘리면 잡는다 (떠오르는 숫자 · 도장은 지나가는 효과라 뺌)
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
    const r = document.createRange(); r.selectNodeContents(n);
    const rs = [...r.getClientRects()].filter(b => b.width > 0.5 && b.height > 0.5); if (!rs.length) continue;
    const b = { x0: Math.min(...rs.map(q => q.left)), y0: Math.min(...rs.map(q => q.top)), x1: Math.max(...rs.map(q => q.right)), y1: Math.max(...rs.map(q => q.bottom)) };
    const top = document.elementFromPoint((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
    if (!top || !(top === el || el.contains(top) || top.contains(el))) { // 다른 것 밑에 깔린 글자
      // 창 · 안내 · 알림처럼 위에 덮는 것에 가려진 글자는 보지 않는다. 그러나 같은 구역(같은 창) 안의 다른 것 밑에 깔린 글자는 아래의 겹침 검사에 넣는다
      // (예전에는 이것도 건너뛰어서, 상태창의 시스템 한마디가 아래 알림 줄 밑에 깔려 두 줄이 포개진 것을 못 잡았다)
      const BOX = '.zone,.win,.t-box,.e-box', home = el.closest(BOX), over = top && top.closest(BOX);
      if (!home || home !== over) continue;
    }
    const fs = parseFloat(cs.fontSize);
    if (fs < 13.99) bad.push('작은 글자 ' + fs + 'px: ' + t.slice(0, 24));
    if (b.x0 < sr.left - 1 || b.y0 < sr.top - 1 || b.x1 > sr.right + 1 || b.y1 > sr.bottom + 1) bad.push('화면 밖: ' + t.slice(0, 24));
    for (let p = el; p && p !== stage; p = p.parentElement) { // 잘림: overflow hidden 조상 밖으로 나간 글자
      const ps = getComputedStyle(p); if (ps.overflow === 'visible' && ps.overflowX === 'visible') continue;
      const pr = p.getBoundingClientRect();
      if (b.x1 > pr.right + 2 || b.y1 > pr.bottom + 2 || b.x0 < pr.left - 2 || b.y0 < pr.top - 2) { if (!(ps.textOverflow === 'ellipsis' || ps.webkitLineClamp !== 'none')) bad.push('잘림(' + (p.id || p.className) + '): ' + t.slice(0, 24)); break; }
    }
    const box = el.closest('.arow,.opt,.sbtn,#hud,#me,#quest,#today,#board,.win,.e-box,.t-box'); // 종목 줄 · 고를 것 · 종목 단추 안에서 넘친 글도
    if (box) { const br = box.getBoundingClientRect(); if (b.x1 > br.right + 1 || b.y1 > br.bottom + 1 || b.x0 < br.left - 1 || b.y0 < br.top - 1) bad.push('칸 밖(' + (box.id || box.className) + '): ' + t.slice(0, 24)); }
    // 겹침은 보이는 부분끼리 잰다: … 으로 줄인 글(줄 수 제한 · 말줄임)의 가려진 줄은 overflow 로 안 보이므로 그 조상의 칸으로 자른다 (넘침 자체는 위의 잘림 검사가 본다)
    const v = Object.assign({}, b);
    for (let p = el; p && p !== stage; p = p.parentElement) { const ps = getComputedStyle(p); if (ps.overflow === 'visible' && ps.overflowX === 'visible' && ps.overflowY === 'visible') continue; const pr = p.getBoundingClientRect(); v.x0 = Math.max(v.x0, pr.left); v.y0 = Math.max(v.y0, pr.top); v.x1 = Math.min(v.x1, pr.right); v.y1 = Math.min(v.y1, pr.bottom); }
    if (v.x1 - v.x0 < 0.5 || v.y1 - v.y0 < 0.5) continue;
    leaves.push({ el, b: v, t });
  }
  for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
    const A = leaves[i], B = leaves[j]; if (A.el === B.el || A.el.contains(B.el) || B.el.contains(A.el)) continue;
    const ix = Math.min(A.b.x1, B.b.x1) - Math.max(A.b.x0, B.b.x0), iy = Math.min(A.b.y1, B.b.y1) - Math.max(A.b.y0, B.b.y0);
    if (ix <= 0 || iy <= 0) continue;
    const small = Math.min((A.b.x1 - A.b.x0) * (A.b.y1 - A.b.y0), (B.b.x1 - B.b.x0) * (B.b.y1 - B.b.y0));
    if (ix * iy > small * 0.25) bad.push('겹침: "' + A.t.slice(0, 16) + '" × "' + B.t.slice(0, 16) + '"');
  }
  // 로드맵 카드: 안의 줄 · 버튼 · 막대가 카드 아래로 잘리지 않는지 (overflow 로 가려져 위의 글자 점검에 안 잡히는 것)
  for (const r of stage.querySelectorAll('.rung')) {
    if (r.closest('.hide') || !r.offsetParent) continue;
    const rr = r.getBoundingClientRect();
    for (const e of r.querySelectorAll('.rows > *, .foot > *')) { const q = e.getBoundingClientRect(); if (q.height > 0 && q.bottom > rr.bottom + 1) bad.push('잘림(rung ' + ((r.querySelector('.nm') || {}).textContent || '') + '): ' + ((e.textContent || '').trim() || e.className).slice(0, 16)); }
  }
  // 창(테두리째)이 화면 밖으로 나가지 않는지 (글자는 안 잘려도 창 위 · 아래 꺾쇠가 잘리는 것)
  for (const w of stage.querySelectorAll('#veil .win')) { const q = w.getBoundingClientRect(); if (q.height && (q.top < sr.top - 1 || q.bottom > sr.bottom + 1)) bad.push('창이 화면 밖: ' + ((w.querySelector('h2') || {}).textContent || w.className).slice(0, 16)); }
  // 버튼이 화면 밖이거나 서로 겹치는지
  const btns = [...stage.querySelectorAll('button,[data-do]')].filter(e => !e.closest('.hide') && e.offsetParent !== null);
  for (const e of btns) { const r = e.getBoundingClientRect(); if (r.right > sr.right + 1 || r.bottom > sr.bottom + 1 || r.left < sr.left - 1 || r.top < sr.top - 1) bad.push('버튼 화면 밖: ' + (e.textContent || '').trim().slice(0, 16)); }
  return [...new Set(bad)];
};
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [], lint = {}, shots = [], log = [];
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  page.on('pageerror', e => errs.push('uncaught: ' + e.message));
  await page.goto('file://' + path.resolve(dir, 'index.html') + '?manual=1&seed=' + seed);
  // 화면 안에서 셈하다 난 오류(없는 칸을 읽음 등)는 그 자리에서 멈추지 않고 적어 둔 뒤 빈 값으로 이어 간다 — 한 번 돌려 어긋난 곳을 전부 보려고. 적힌 오류는 실패로 센다
  const BLANK = new Proxy(function () { }, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : k === 'toJSON' ? () => '(오류)' : k === Symbol.iterator ? function* () { } : BLANK), apply: () => BLANK });
  const G = (fn, arg) => page.evaluate(fn, arg).catch(e => { errs.push('점검 중 오류: ' + String(e.message).split('\n')[0].slice(0, 160) + ' @ ' + ((new Error().stack || '').split('\n').find(l => /check\.js:\d+/.test(l) && !/G \(/.test(l)) || '').trim().slice(-22)); return BLANK; });
  const click = (sel, o) => page.click(sel, Object.assign({ timeout: 2500 }, o || {})).catch(() => { errs.push('누를 것이 없거나 가려짐: ' + sel + ' @ ' + ((new Error().stack || '').split('\n').find(l => /check\.js:\d+/.test(l) && !/click \(/.test(l)) || '').trim().slice(-22)); }); // 없는 버튼도 멈추지 않고 적어 둔다
  const step = n => G(n => { const g = window.game; g.step(n); const left = g.state.guard || 0; if (left) g.step(left + 1); }, n); // 누름이 막힌 동안(창이 막 뜬 직후)은 마저 기다린다
  const st = () => G(() => { const s = window.game.state; return { scene: window.game.scene, day: s.day, slot: s.slot, cash: s.cash, worth: s.worth, hp: s.hp, tier: s.tier, quest: s.quest, modal: s.modal, ended: s.ended, act1: s.act1, price: s.housePrice }; });
  const QI = id => G(id => { const R = window.Rules, s = R.create(1); for (let i = 0; i < 60; i++) { s.quest = i; const v = R.questView(s); if (!v) return -1; if (v.id === id) return i; } return -1; }, id); // 그 퀘스트가 몇 번째인지
  const seen = new Set();
  async function shot(name, once = true) {
    if (once && seen.has(name)) return; seen.add(name);
    await page.waitForTimeout(420); // 뜨는 연출이 끝난 뒤에 찍음
    const p = path.join(out, name + '.png'); await page.screenshot({ path: p }); shots.push(p);
    const l = await G(LINT); if (l.length) lint[name] = l;
  }
  const BOOST = Number(process.env.BOOST || 2); // 손이 없는 봇(미니게임은 아무 키나 눌러 "실수", 나머지는 "대충")이라 일당을 올려 준다 — 고정비를 내며 화면을 끝까지 지나가려는 것이고, 균형은 tools/sim.js 가 손 모형으로 잰다
  await G(k => { for (const n of ['pay_flyer', 'pay_loading', 'pay_store', 'pay_delivery']) window.CONFIG[n].value *= k; }, BOOST);
  await shot('01_title');
  await click('[data-do="new"]'); await step(20);
  await shot('02_intro');
  let guard = 0, mgShot = 0, fxSeen = 0, perks = 0, evts = 0, dens = 0;
  const rollBad = [], forcedMain = [];
  let lastKey = '', stuck = 0;
  const hudCheck = async tag => { // 숫자 굴림이 끝난 뒤 위쪽 띠의 현금 · 순자산 = 판 상태
    await step(130); // 숫자 굴림은 바뀐 크기에 따라 길어진다 (가장 길 때 1.6초쯤)
    const r = await G(() => { const R = window.Rules, S = window.game.state.raw; return { cash: document.getElementById('cash').textContent, want: R.won(S.cash), worth: document.getElementById('worth').textContent, wantW: R.won(R.worth(S)) }; });
    if (r.cash !== r.want || r.worth !== r.wantW) rollBad.push(tag + ': 위쪽 띠 ' + r.cash + ' / ' + r.worth + ' ≠ 판 ' + r.want + ' / ' + r.wantW);
  };
  const M = 10000;
  while (guard++ < 4000) {
    const s = await st();
    if (s.scene !== 'play' || (s.act1 && !s.modal)) break; // 내 집(1막 끝)까지 몰고, 1막 끝 창 · 그 뒤 창을 닫으면 끝
    if (s.modal === 'mg' && await G(() => window.game.state.pre)) { // 시작 전 화면: 기억한 강도 그대로 시작 (판은 강도와 무관하게 중의 봇)
      if (mgShot < 1) await shot('03_mg_pre');
      await G(() => window.game.press('Space')); await step(4);
      if (await G(() => window.game.state.pre)) { forcedMain.push('시작 전 화면에서 Space 로 시작되지 않음'); break; }
    }
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
      await step(40); // 일당은 0 에서 굴러 올라간다 (0.6초)
      { const t = await G(() => { const e = document.getElementById('mgpay'); return e ? e.textContent : null; }); if (!t || !/^\+[0-9,]+원$/.test(t) || t === '+0원') rollBad.push('미니게임 일당이 굴림 뒤 숫자가 아님: ' + t); }
      await step(30); await G(() => window.game.press('Space')); await step(20);
      continue;
    }
    { const k = s.day + ':' + s.slot + ':' + s.modal + ':' + s.tier; if (k === lastKey) { if (++stuck > 60) { forcedMain.push('판이 ' + k + ' 에서 멈춤 (같은 상태로 60번)'); break; } } else { lastKey = k; stuck = 0; } }
    if (s.modal === 'study') { // 공부: 종목 고르기 (화끈식품). 3단계부터는 두 종목을 고르고 Enter
      await shot('pop_study'); await G(() => window.game.press('Digit2')); await step(20);
      if ((await st()).modal === 'study') { await G(() => window.game.press('Digit1')); await step(4); await shot('pop_study_two'); await G(() => window.game.press('Enter')); await step(20); if ((await st()).modal === 'study') { forcedMain.push('공부 창에서 두 종목을 고르고 Enter 를 눌렀는데 닫히지 않음'); await G(() => window.game.press('Space')); await step(20); } }
      continue; }
    if (s.modal === 'quest') fxSeen = Math.max(fxSeen, await G(() => window.game.fx.parts));
    if (s.modal === 'perk') { await shot('pop_perk'); await step(20); await G(() => window.game.press('Digit1')); await step(20); perks++; continue; } // 특성: 첫째 카드
    if (s.modal === 'den') { // 도박장: 가장 작은 판돈으로 홀에 두 판 걸고 나온다 (다섯 판을 채우면 규칙이 닫음)
      await shot('pop_den');
      const d = await G(() => { const g = window.game.state; return { fin: !!(g.den && g.den.fin), round: g.raw.den ? g.raw.den.round : 0, cash: g.raw.cash }; });
      if (d.fin) { await shot('pop_den_done'); await G(() => window.game.press('Space')); await step(30); dens++; continue; }
      if (d.round >= 2 || d.cash < 10000) { await G(() => window.game.press('Space')); await step(30); continue; }
      await G(() => window.game.press('Digit1')); await step(4); await G(() => window.game.press('ArrowLeft')); await step(80);
      await shot('pop_den_roll'); continue;
    }
    if (s.modal === 'event') { // 돌발 사건: 돈이 되면 첫째, 아니면 둘째 → 결과 확인
      await shot('pop_event'); await step(20);
      await G(() => { const b = document.querySelector('[data-do="ev"][data-arg="a"]'); window.game.press(b && !b.disabled ? 'Digit1' : 'Digit2'); }); await step(25);
      await shot('pop_event_result'); await G(() => window.game.press('Space')); await step(20); evts++; continue;
    }
    if (s.modal) {
      await shot('pop_' + s.modal + (s.modal === 'quest' ? '_' + s.quest : ''), s.modal !== 'quest' || s.quest < 4);
      await step(20); await G(() => window.game.press('Space')); await step(20);
      continue;
    }
    // 창이 없을 때: 화면 점검 한 번씩
    if (s.day === 1 && s.slot === 0) { await shot('04_play_day1'); await hudCheck('1일째'); }
    if (s.tier === 1) await shot('05_sauna');
    if (s.tier >= 1 && !seen.has('05b_shop') && s.cash >= 30000) { // 가게: 한 번 사 먹는다 (퀘스트 "든든하게 먹어라")
      await click('#board .tabs [data-arg="shop"]'); await step(10); await shot('05b_shop');
      await click('#board [data-do="eat"]'); await step(20); await shot('05c_shop_ate');
      if (!(await G(() => window.game.state.raw.stats.meals === 1 && !document.querySelector('#board [data-do="eat"]')))) forcedMain.push('가게에서 사 먹었는데 먹은 것으로 안 남거나 오늘 또 먹을 수 있음');
      await G(() => window.game.run('tab', 'road')); await step(5); continue; }
    if (s.tier === 2 && !seen.has('06_gosiwon')) { await shot('06_gosiwon'); await G(() => window.game.run('roadmap')); await step(20); await shot('06b_roadmap_modal'); await G(() => window.game.press('Space')); await step(20); await hudCheck('고시원'); continue; } // 투자가 열리면 로드맵은 '나' 구역 머리의 버튼으로 여는 창
    // 주거 올리기: 다음 단계에 들어갈 수 있으면(보증금 · 밀린 돈 · 살던 곳 정산을 낼 현금) — 퀘스트 버튼이 있으면 그것을, 없으면 로드맵 창을 연다. 현금은 모자라지만 주식을 팔면 되면 먼저 판다 (보증금은 현금으로 건다)
    const mv = await G(() => { const R = window.Rules, S = window.game.state.raw, t = S.tier + 1; if (t > 3) return 0; const i = R.moveInfo(S, t); if (i.ok) return t; const hv = R.holdings(S).total.value; return t >= 2 && hv > 0 && i.have + hv * 0.98 >= i.need + 100000 ? -t : 0; });
    if (mv < 0 && style !== 'stay') { await G(() => { const g = window.game, S = g.state.raw; for (const a of ['daejang', 'buldak', 'hantang']) if (S.hold[a].units > 0) { g.run('tab', 'stock'); g.run('sel', a); g.run('sell', '1'); } }); await step(10); log.push(s.day + '일째: 보증금을 마련하려고 주식을 팔았다 (' + (-mv) + '단계로)'); continue; }
    if (mv > 0 && style !== 'stay' && (mv < 2 || s.cash >= 5 * M)) {
      const inQuest = await G(t => !!document.querySelector('#quest [data-do="move"][data-arg="' + t + '"]'), mv);
      if (inQuest) await click('#quest [data-do="move"]');
      else if (mv === 1) await click('#board [data-do="move"]');
      else { await G(() => window.game.run('roadmap')); await step(20); await shot('07_roadmap_move' + mv); await click('#veil [data-do="move"]'); }
      await step(20);
      if (mv >= 2) { await shot('07_confirm_move' + mv); await G(() => window.game.press('Enter')); await step(20); }
      continue;
    }
    { // 내 집: 현금으로만. 순자산이 값 + 일요일 몫을 넘으면 주식 · 코인을 팔아 현금으로 만들고, 위쪽 띠의 "내 집 사기" → 확인 창 → Enter
      const home = await G(() => { const R = window.Rules, S = window.game.state.raw; if (S.tier !== 3) return 0; const i = R.homeInfo(S, 4), b = R.bill(S); return i.ok ? 2 : R.worth(S) >= i.full + (b ? b.amt : 0) + 300000 ? 1 : 0; });
      if (home === 1) { await G(() => { const g = window.game, S = g.state.raw; for (const a of ['daejang', 'buldak', 'hantang']) if (S.hold[a].units > 0) { g.run('tab', 'stock'); g.run('sel', a); g.run('sell', '1'); } if (S.lev) { g.run('tab', 'coin'); g.run('close'); } }); await step(10); if (!(await G(() => window.Rules.homeInfo(window.game.state.raw, 4).ok))) { /* 아직 모자라면 계속 번다 */ } else continue; }
      if (home === 2) {
        await shot('20_house_ready');
        if (!(await G(() => !!document.querySelector('#hud [data-do="house"]')))) forcedMain.push('내 집을 살 수 있는데 위쪽 띠에 사기 버튼이 없음');
        await click('#hud [data-do="house"]'); await step(20); await shot('21_buy_home');
        const o = await G(() => ({ modal: window.game.state.modal, opts: document.querySelectorAll('#veil .opt').length, t: document.querySelector('#veil .win').textContent }));
        if (o.modal !== 'buy' || o.opts !== 1 || !/현금으로/.test(o.t) || !/1막 끝/.test(o.t)) forcedMain.push('내 집 사는 창이 "현금으로" 하나가 아님: ' + JSON.stringify(o).slice(0, 160));
        await G(() => window.game.press('Enter')); await step(20);
        const a = await G(() => ({ modal: window.game.state.modal, tier: window.game.state.tier, card: (document.querySelector('#veil .e-card pre') || {}).textContent || '' }));
        if (a.modal !== 'act1' || a.tier !== 4 || !/1막 끝/.test(a.card)) forcedMain.push('내 집을 샀는데 1막 끝 창(결과 카드)이 안 뜸: ' + JSON.stringify(a));
        await shot('22_act1');
        continue;
      }
    }
    // 투자 (공부형: 리포트 · 공시 · 기사를 따름)
    if (s.tier >= 1 && style !== 'alba') { // 주식은 찜질방부터
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
      if (s.tier === 1 && await G(() => window.Rules.holdings(window.game.state.raw).total.cost > 0)) { await G(() => { window.game.run('tab', 'stock'); window.game.run('sview', 'market'); }); await shot('08a_stock_sauna'); }
      if (s.tier === 2 && !seen.has('08c_stock_detail')) { // 주식의 세 화면 · 뉴스·공부 · 은행 (고시원에서 한 번씩)
        await G(() => { const g = window.game; g.run('tab', 'stock'); g.run('sel', 'daejang'); }); await step(5); await shot('08c_stock_detail');
        await G(() => window.game.run('sview', 'mine')); await step(5); await shot('08d_stock_mine');
        await G(() => window.game.run('tab', 'info')); await step(5); await shot('08e_info');
        await G(() => window.game.run('tab', 'bank')); await step(5); await shot('08f_bank');
        await G(() => { const g = window.game; g.run('tab', 'stock'); g.run('sview', 'market'); }); await step(5); }
      if (s.tier === 3 && !seen.has('09b_realty')) { await G(() => window.game.run('tab', 'realty')); await step(5); await shot('09b_realty'); }
      if (s.tier === 2) { await G(() => { window.game.run('tab', 'stock'); window.game.run('sview', 'market'); }); await shot('08_stock'); const held = await G(() => window.Rules.holdings(window.game.state.raw).total.cost > 0); if (held) { await shot('08b_stock_holding'); await hudCheck('주식을 든 날'); } }
      if (s.tier === 3) { await G(() => window.game.run('tab', 'coin')); await shot('09_coin'); const lev = await G(() => !!window.game.state.raw.lev); if (lev) { await shot('10_coin_position'); await G(() => window.game.run('tab', 'stock')); await shot('10b_stock_with_coin'); } }
    }
    if (s.slot >= 3) {
      // 고정비 날이면 현금 마련
      await G(M => { const R = window.Rules, S = window.game.state.raw, g = window.game, b = R.bill(S); if (b && b.inDays === 0 && S.cash < b.amt + 3 * M) { for (const a of ['daejang', 'buldak', 'hantang']) if (S.hold[a].units > 0) { g.run('tab', 'stock'); g.run('sel', a); g.run('sell', '1'); } if (S.cash < b.amt + 3 * M && S.lev) { g.run('tab', 'coin'); g.run('close'); } } }, M);
      if ((await st()).modal) continue;
      await shot('11_day_done');
      await click('[data-do="endday"]'); await step(20);
      if ((await st()).modal === 'confirm') { await shot('13_sleep_confirm'); await click('#veil [data-do="ok"]'); await step(20); }
      await shot('12_night_day' + (s.day <= 1 ? 1 : s.day % 7 === 0 ? 'bill' : 'n'));
      await step(120); // 밤 정산의 합계는 0 에서 굴러 올라간다 (큰 금액일수록 길게)
      { const t = await G(() => { const R = window.Rules, n = window.game.state.raw.last, a = document.getElementById('nightin'), b = document.getElementById('nightout'); return a && b ? [a.textContent, '+' + R.won(n.labor), b.textContent, (n.spent ? '−' : '') + R.won(n.spent)] /* 쓴 돈이 없으면 "−0원"이 아니라 "0원" */ : null; }); if (!t || t[0] !== t[1] || t[2] !== t[3]) rollBad.push(s.day + '일 밤 정산 합계가 굴림 뒤 값과 다름: ' + JSON.stringify(t)); }
      await G(() => window.game.press('Space')); await step(20);
      continue;
    }
    // 칸 행동: 공부형은 자산이 크면 저녁에 공부, 아니면 가장 돈 되는 알바, 안 되면 쉬기
    const pick = await G(({ style, M }) => { const R = window.Rules, S = window.game.state.raw; const acts = R.acts(S); if (style === 'study' && S.slot === 2 && R.worth(S) > 500 * M && acts.find(a => a.kind === 'study' && a.ok)) return ['study', '']; const j = acts.filter(a => a.kind === 'job' && a.ok).sort((a, b) => b.pay - a.pay)[0]; return j ? [(S.day <= 2 || S.day % 5 === 0) ? 'job' : 'skip', j.id] : ['rest', '']; }, { style, M });
    if (process.env.DBG) console.log('pick', JSON.stringify(pick), JSON.stringify(await st()), await G(() => document.getElementById('veil').className + '|' + document.getElementById('veil').innerHTML.slice(0, 120)));
    if (pick[0] === 'job') await click('[data-do="job"][data-arg="' + pick[1] + '"]', { position: { x: 20, y: 60 }, timeout: 3000 });
    else if (pick[0] === 'skip') await click('[data-do="skip"][data-arg="' + pick[1] + '"]');
    else await click('[data-do="' + pick[0] + '"]');
    await step(20);
  }
  const end = await st();
  await step(20);
  if (!end.act1) forcedMain.push('화면으로 몰아서 내 집(1막 끝)까지 가지 못함: ' + JSON.stringify(end));
  await shot('30_after_act1');
  // ── 일부러 만든 화면: 판이 우연히 안 지나간 곳도 한 번씩 (같은 넘침 · 작은 글자 점검) ──
  const forced = [];
  const fresh = async () => { await page.goto('file://' + path.resolve(dir, 'index.html') + '?manual=1&scene=play&seed=' + seed); await step(60); await G(() => window.game.press('Space')); await step(40); await G(() => { window.game.state.raw.beats = ['family1', 'family2', 'sign1', 'sign2', 'landlord1', 'landlord2']; }); }; // 일부러 만든 화면에서는 꿈의 장면 창이 끼어들지 않게 본 것으로 해 둔다 (장면 창은 J 에서 따로 본다)
  await fresh();
  await G(() => { const S = window.game.state.raw; S.day = 2; S.cash = 40000; S.quest = 2; window.game.render(); }); await step(10); await shot('40_roadmap_board_next'); // 찜질방 옮기기 버튼이 켜진 로드맵 판
  if (!(await G(() => !!document.querySelector('#board .rung.next [data-do="move"]') && !!document.querySelector('#quest [data-do="move"]')))) forced.push('로드맵 판 · 상태창에 찜질방 옮기기 버튼이 없음');
  if (await G(() => !!document.querySelector('#hud .wk'))) forced.push('고정비가 없는데(고시원 전) 위쪽 띠에 일곱 칸 띠가 보임 — "7일 기한"으로 읽힘');
  { const r = await G(() => ({ n: document.querySelectorAll('#board .rung').length, far: document.querySelectorAll('#board .rung.far').length, names: [...document.querySelectorAll('#board .rung .nm')].map(e => e.textContent), vals: document.querySelector('#board .ladder').textContent }));
    if (r.n !== 10 || r.names[9] !== '한국 최고 부자' || r.far < 7) forced.push('로드맵 판이 열 단계(먼 단계는 흐리게)가 아님: ' + JSON.stringify(r).slice(0, 200));
    const C = await G(() => { const c = window.CONFIG, n = window.Rules.num; return [n(c.price_home.value), n(c.price_apt.value), n(c.price_hotel.value), n(c.top_worth.value), '예치금 ' + n(c.gosiwon_dep.value), '보증금 ' + n(c.oneroom_dep.value)]; });
    for (const v of C.concat(['가게', '재벌'])) if (r.vals.indexOf(v) < 0) forced.push('로드맵 판에 ' + v + '이(가) 안 보임'); } // 값의 사다리 · 고시원 예치금 · 원룸 보증금(2026-11-19 보증금 부활)
  await G(qi => { const S = window.game.state.raw, R = window.Rules; S.tier = 1; S.quest = qi; S.cash = 120000; S.day = 6; window.game.render(); }, await QI('address')); await step(10); await shot('41_roadmap_board_short'); // 고시원 예치금에 못 미침: 이유 · 막대
  if (!(await G(() => { const b = document.querySelector('#quest [data-do="why"]'); return !!b && /모자랍니다/.test(b.dataset.arg); }))) forced.push('상태창의 옮기기 버튼이 못 할 때 이유(moveInfo.why)를 안 줌');
  if (!(await G(() => { const e = document.querySelector('#board .rung.next'); return /예치금 500,000/.test(e.textContent) && /돌려받는/.test([...e.querySelectorAll('[title]')].map(q => q.title).join()) && /380,000 더/.test(e.textContent); }))) forced.push('로드맵 고시원 칸에 예치금 · "돌려받는 돈"(설명) · 모자란 만큼이 없음');
  await G(() => window.game.run('roadmap')); await step(20);
  if (!(await G(() => /돌려받는 돈/.test(document.querySelector('#veil .road-note').textContent) && /예치금 500,000/.test(document.querySelector('#veil .rung.next').textContent) && /전세 650만·주 90만/.test(document.querySelector('#veil .ladder').textContent)))) forced.push('로드맵 창에 "보증금은 돌려받는 돈" 머리글 · 고시원 예치금 · 원룸의 전세 줄이 안 보임');
  await shot('41a_roadmap_modal_short');
  await G(() => window.game.press('Space')); await step(20);
  await G(() => { const S = window.game.state.raw; S.cash = window.CONFIG.gosiwon_dep.value + 20000; window.game.render(); }); await step(10); await shot('41b_roadmap_board_gosiwon_ok'); // 고시원 기준을 넘음: 카드 안의 "옮기기"가 잘리지 않아야 (lint 의 잘림(rung))
  { const r = await G(() => { const n = document.querySelector('#board .rung.next'), b = n && n.querySelector('[data-do="move"]'); if (!b) return { btn: false }; const q = b.getBoundingClientRect(), k = n.getBoundingClientRect(); return { btn: true, inside: q.bottom <= k.bottom + 1 && q.top >= k.top - 1 }; });
    if (!r.btn || !r.inside) forced.push('고시원 기준을 넘었는데 로드맵 카드의 "옮기기"가 없거나 카드 밖으로 잘림: ' + JSON.stringify(r)); }
  // 긴 숫자 · 주간 띠 · 알림 줄(일요일: 오늘 밤 고정비) · 보유 줄 + 합계 + 코인 · 남은 날 대신 N일째
  await G(qi => { const g = window.game, S = g.state.raw; S.tier = 3; S.lease = 'rent'; S.deposit = 2000000; S.quest = qi; S.day = 21; S.movedDay = 15; S.cash = 37980000; S.combo = 10; S.arrears = 8000000; S.hold.hantang = { units: 1000, cost: 11000000, min: 0 }; S.hold.daejang = { units: 20, cost: 1000000, min: 0 }; S.offer = null; S.picks = 0; g.meta.seen.stock = 1; g.meta.seen.coin = 1; g.render(); g.run('tab', 'coin'); g.run('lev', '5'); g.run('share', '0.25'); g.run('long'); g.step(40); g.run('tab', 'stock'); g.run('sview', 'market'); }, await QI('house'));
  await step(60); await shot('42_long_numbers_stock'); await hudCheck('긴 숫자');
  const f42 = await G(() => ({ notes: [...document.querySelectorAll('#quest .note.bill')].map(e => e.className + ':' + e.textContent), wk: document.querySelectorAll('#hud .wk > i, #hud .wk > .bill').length, wkl: (document.querySelector('#hud .wk .wkl') || {}).textContent || '', wkt: (document.querySelector('#hud .wk') || {}).title || '', bill: !!document.querySelector('#hud .wk .bill.now'), rows: [...document.querySelectorAll('#board .arow .l2 > .mine')].map(e => e.textContent), chg: [...document.querySelectorAll('#board .arow .chg')].map(e => e.textContent), sum: (document.querySelector('#board .hsum') || {}).textContent || '', mineN: (document.querySelector('#board .svtabs [data-arg="mine"] i') || {}).textContent || '', house: !!document.querySelector('#hud [data-do="house"]'), can: window.Rules.homeInfo(window.game.state.raw, 4).ok, hud: document.getElementById('hud').textContent, due: window.Rules.bill(window.game.state.raw).amt }));
  if (f42.wk !== 7 || !f42.bill || !/^−1,060만$/.test(f42.wkl) || f42.due !== 10600000) forced.push('주간 띠가 일곱 칸이 아니거나 일요일 칸이 오늘로 안 보이거나 끝에 이번 정산 금액(고정비 2,600,000 + 밀린 8,000,000 = −1,060만)이 없음: ' + JSON.stringify(f42).slice(0, 300));
  if (!f42.notes.some(n => /today/.test(n) && /오늘 밤 고정비/.test(n)) || f42.notes.some(n => /집값/.test(n))) forced.push('일요일 알림 줄이 다름: ' + f42.notes.join(' | '));
  if (f42.rows.length !== 9 || !/배당주/.test(f42.rows[1]) || !/주.*%/.test(f42.rows[0]) || !/%/.test(f42.rows[4]) || !/지수/.test(f42.rows[7]) || f42.mineN !== '3' || !/보유 합계/.test(f42.sum)) forced.push('장 보기의 종목 아홉 칸(원룸: 세 줄 칸 — 가진 것은 수량 · 손익, 안 가진 것은 갈래) · 보유 합계 · "내 보유 3"(주식 둘 + 코인)이 다름: ' + JSON.stringify(f42).slice(0, 400));
  if (!/^20주 [+−]?[0-9.]+%$/.test(f42.rows[0]) || !/^1,000주 [+−]?[0-9.]+%$/.test(f42.rows[4]) || f42.chg.some(t => t && !/^오늘 [+−]?[0-9]/.test(t))) forced.push('종목 줄의 % 둘에 이름표(세 줄 칸: 내 손익은 "N주" 뒤에 · 시세는 "오늘" 뒤에)가 없음: ' + JSON.stringify({ rows: f42.rows, chg: f42.chg }));
  if (f42.house !== f42.can) forced.push('위쪽 띠의 내 집 사기 버튼이 살 수 있는지(homeInfo.ok)와 다름: ' + JSON.stringify({ house: f42.house, can: f42.can }));
  if (!/21일째/.test(f42.hud) || /남은/.test(f42.hud)) forced.push('위쪽 띠에 "N일째"가 없거나 "남은"이 남아 있음: ' + f42.hud);
  { // 종목을 누르면 상세: 차트 + 수량(−10 · −1 · 직접 적기 · +1 · +10 · 25% · 50% · 최대 · 보유) + 사기 · 팔기. 버튼에 적힌 금액 = 실제로 오가는 돈
    await G(() => { const g = window.game; g.run('sel', 'daejang'); g.step(5); }); await shot('42b_stock_detail');
    const d0 = await G(() => { const g = window.game, S = g.state.raw, R = window.Rules, q = id => document.querySelector('#board [data-do="qty"][data-arg="' + id + '"]'); return { qty: (document.getElementById('qty') || {}).value, steps: ['-10', '-1', '+1', '+10', 'q25', 'q50', 'max', 'all'].filter(id => !!q(id)).length, chart: !!document.getElementById('chart'), max: R.maxUnits(S, 'daejang'), buy: !!document.querySelector('#board [data-do="buyq"]'), sell: !!document.querySelector('#board [data-do="sellq"]') }; });
    if (d0.qty !== '1' || d0.steps !== 8 || !d0.chart || !d0.buy || !d0.sell || !(d0.max > 100)) forced.push('종목 상세에 차트 · 수량 고르기(여덟 버튼 + 적는 칸) · 사기 · 팔기가 없음: ' + JSON.stringify(d0));
    const d1 = await G(() => { const g = window.game, S = g.state.raw, R = window.Rules; g.run('qty', 'q25'); const q = Number(document.getElementById('qty').value), shown = Number(document.getElementById('buyamt').textContent.replace(/[^0-9]/g, '')), c0 = S.cash, u0 = S.hold.daejang.units; g.run('buyq'); g.step(5); return { q, want: Math.floor(R.maxUnits(Object.assign({}, S, { cash: c0 }), 'daejang') / 4), shown, paid: c0 - S.cash, got: S.hold.daejang.units - u0 }; });
    if (!(d1.q > 1) || d1.got !== d1.q || d1.paid !== d1.shown) forced.push('수량을 25%로 고르고 산 것이 고른 수량 · 버튼의 금액과 다름: ' + JSON.stringify(d1));
    const d2 = await G(() => { const g = window.game, S = g.state.raw; for (let i = 0; i < 8 && g.state.modal; i++) { g.press(g.state.modal === 'perk' ? 'Digit1' : 'Space'); g.step(40); } g.run('qty', 'all'); const q = Number(document.getElementById('qty').value), shown = Number(document.getElementById('sellamt').textContent.replace(/[^0-9]/g, '')), c0 = S.cash, u0 = S.hold.daejang.units; g.run('qty', '=7'); const q7 = Number(document.getElementById('qty').value), shown7 = Number(document.getElementById('sellamt').textContent.replace(/[^0-9]/g, '')); g.run('sellq'); g.step(5); return { q, u0, q7, shown7, got: S.cash - c0, left: S.hold.daejang.units }; });
    if (d2.q !== d2.u0 || d2.q7 !== 7 || d2.left !== d2.u0 - 7 || d2.got !== d2.shown7) forced.push('"보유"가 가진 수량이 아니거나, 7주를 판 것이 수량 · 버튼의 금액과 다름: ' + JSON.stringify(d2));
    await G(() => { const g = window.game; for (let i = 0; i < 8 && g.state.modal; i++) { g.press(g.state.modal === 'perk' ? 'Digit1' : 'Space'); g.step(40); } g.run('sview', 'mine'); g.step(5); }); await shot('42c_stock_mine');
    const d3 = await G(() => ({ cells: [...document.querySelectorAll('#board .mlist.own .arow')].map(e => e.textContent.replace(/\s+/g, ' ').slice(0, 40)) }));
    if (d3.cells.length !== 3 || !d3.cells.some(t => /달나라코인.*롱 5배/.test(t))) forced.push('내 보유에 가진 주식 둘 + 코인 포지션이 안 보임: ' + JSON.stringify(d3));
    await G(() => { const g = window.game; g.run('sview', 'market'); g.step(3); }); }
  await G(() => { const S = window.game.state.raw; S.day = 20; window.game.render(); }); await step(10);
  if (!(await G(() => [...document.querySelectorAll('#quest .note.bill')].some(e => /tomorrow/.test(e.className) && /내일 밤 고정비/.test(e.textContent))))) forced.push('토요일에 "내일 밤 고정비" 알림이 없음');
  await G(() => { const S = window.game.state.raw; S.day = 17; window.game.render(); }); await step(10);
  if (await G(() => document.querySelectorAll('#quest .note.bill').length)) forced.push('고정비 이틀 전인데 알림이 뜸');
  await G(() => { const S = window.game.state.raw; S.cash = 90000000; window.game.render(); }); await step(60); await shot('43_house_button'); await hudCheck('내 집 사기');
  if (!(await G(() => !!document.querySelector('#hud [data-do="house"]') && !!document.querySelector('#quest [data-do="house"]')))) forced.push('현금이 내 집 값을 넘었는데 위쪽 띠 · 상태창에 내 집 사기 버튼이 없음');
  await G(() => window.game.run('roadmap')); await step(20); await shot('44_roadmap_modal_late');
  if (!(await G(() => !!document.querySelector('#veil .rung [data-do="house"]') && document.querySelectorAll('#veil .rung').length === 10))) forced.push('로드맵 창에 열 단계 · 내 집 사기 버튼이 없음');
  await G(() => window.game.press('Space')); await step(20);
  // 도박장 다섯 판: 판돈 → 홀/짝 → 구름 → 결과 → (이기면 따블) → 다섯 판이면 합계를 보여 주고 닫힘
  await fresh();
  await G(() => { const g = window.game, S = g.state.raw; S.tier = 2; S.day = 9; S.movedDay = 8; S.cash = 2000000; S.quest = 99; S.offer = null; S.picks = 0; S.xp = 0; S.event = 'den'; g.render(); g.run('rest'); g.step(40); g.press('Digit1'); g.step(40); g.press('Space'); g.step(40); });
  if ((await st()).modal !== 'den') forced.push('친구의 전화에서 "간다"를 골랐는데 도박장 창이 안 뜸');
  await shot('45_den_open');
  if (!(await G(() => !!document.querySelector('.den-dice.covered .cover') && !document.querySelector('.den-dice .die')))) forced.push('굴리기 전인데 주사위 눈이 보임 (컵이 덮고 있어야)');
  if (!(await G(() => /1\.9배 · 자릿세 5%/.test(document.querySelector('.win.den').textContent)))) forced.push('도박장 창에 "맞히면 1.9배 · 자릿세 5%"가 없음');
  let rounds = 0, doubled = 0;
  const raw = n => G(n => window.game.step(n), n); // 막음을 기다리지 않는 걸음 (구르는 동안을 보려고)
  for (let i = 0; i < 8 && (await st()).modal === 'den'; i++) {
    const d = await G(() => window.game.state.den);
    if (d.fin) break;
    const can = await G(() => !!document.querySelector('[data-do="dendouble"]'));
    if (can && !doubled) { // 따블: Enter 는 방금 받은 돈을 판돈으로 고르기만 하고, 홀 · 짝은 새로 고른다
      const want = await G(() => window.Rules.denView(window.game.state.raw).doubleAmt);
      const prev = await G(() => window.game.state.den.amt);
      await G(() => window.game.press('Enter')); await raw(2);
      const sel = await G(() => ({ amt: window.game.state.den.amt, rolling: window.game.state.den.rolling, chip: (document.querySelector('.den-bets .dbl') || {}).textContent || '' }));
      sel.prev = prev;
      if (sel.amt !== want || sel.rolling || !/따블/.test(sel.chip)) forced.push('따블을 누르면 받은 돈이 판돈으로 골라지고(굴리지 않고) 홀 · 짝을 새로 골라야 함: ' + JSON.stringify(sel));
      await G(() => window.game.press('ArrowRight')); doubled++; await raw(10 + 90);
      const back = await G(() => window.game.state.den); // 따블을 굴린 뒤 다음 판돈은 따블 전의 판돈 (가장 큰 판돈으로 바뀌지 않게)
      if (!back || back.rolling || !back.res) { forced.push('도박장: 따블을 굴린 뒤 결과가 없음'); break; }
      if (!back.fin && back.amt !== sel.prev) forced.push('따블 뒤 다음 판돈이 원래 판돈(' + sel.prev + ')이 아님: ' + back.amt);
      rounds++; continue; }
    else { await G(k => window.game.press(k), 'Digit' + (1 + (i % 3))); await raw(2); await G(k => window.game.press(k), i % 2 ? 'ArrowRight' : 'ArrowLeft'); }
    await raw(10);
    const mid = await G(() => window.game.state.den);
    if (!mid || !mid.rolling) { forced.push('도박장: 걸었는데 주사위가 구르지 않음 (' + i + ')'); break; }
    await G(() => { window.game.press('Space'); window.game.press('Enter'); }); await raw(4); // 구르는 동안의 연타는 버린다
    if (i === 0) await shot('46_den_rolling');
    await raw(90);
    const after = await G(() => window.game.state.den);
    if (!after || after.rolling || !after.res) { forced.push('도박장: 굴린 뒤 결과가 없음 (' + i + ')'); break; }
    rounds++;
    if (i === 0) await shot('47_den_result_' + (after.res.win ? 'win' : 'lose'));
  }
  const fin = await G(() => window.game.state.den);
  if (!fin || !fin.fin || fin.fin.rounds !== 5 || rounds !== 5) forced.push('도박장 다섯 판 뒤 합계가 안 뜸: ' + JSON.stringify({ rounds, fin }));
  else if (await G(() => !!window.game.state.raw.den)) forced.push('다섯 판 뒤에도 규칙의 도박장이 열려 있음');
  await shot('48_den_done');
  await G(() => window.game.press('Space')); await step(40);
  if ((await st()).modal) forced.push('도박장 합계 창이 닫히지 않음: ' + (await st()).modal);
  await hudCheck('도박장 뒤');
  // ── 1막 뒤: 판 상태를 만들어 넣어 화면을 지나간다 (아파트 대출 고르기 · 대출 줄 · 미리 갚기 · 사업 · 자동 수입 · 공부 종목 · 밤사이 갭 · 압류 · 호텔 선언 · 엔딩) ──
  const closeAll = async () => { for (let i = 0; i < 8; i++) { const m = (await st()).modal; if (!m) break; await G(k => window.game.press(k), m === 'perk' ? 'Digit1' : m === 'event' ? 'Digit2' : 'Space'); await step(30); if ((await st()).modal === 'event') { await G(() => window.game.press('Space')); await step(30); } } };
  const W = n => G(n => window.Rules.won(n), n), N = n => G(n => window.Rules.num(n), n);
  await fresh();
  // A. 아파트: 내 집에 살며 현금 25,000,000 · 신용 3등급 · 가게 → 들어가는 창에 넷(전세 · 대출 최대 · 절반 · 없이), 고른 것마다 지금 낼 현금 · 일요일 밤마다 나갈 돈 · 압류 경고 · 살던 집 판 돈
  await G(qi => { const g = window.game, S = g.state.raw, R = window.Rules; S.tier = 4; S.lease = 'own'; S.deposit = 0; S.homeVal = R.homePrice(S, 4); S.act1 = { day: 22, rank: 'A', worth: 16000000, price: S.homeVal }; S.stats.maxTier = 4; S.biz = 1; S.cash = 25000000; S.credit = 720; S.day = 30; S.movedDay = 23; S.quest = qi; S.offer = null; S.picks = 0; S.event = null; S.xp = 0; S.hp = 50; g.render(); }, await QI('apt'));
  await step(20); await closeAll(); await shot('49_home_play');
  await G(() => window.game.run('house')); await step(20); await shot('50_buy_apt');
  { const r = await G(() => { const w = document.querySelector('#veil .win').getBoundingClientRect(), s = document.getElementById('stage').getBoundingClientRect(); return { top: w.top - s.top, bottom: s.bottom - w.bottom }; }); if (!(r.top >= 4 && r.bottom >= 4)) forced.push('아파트에 들어가는 창이 화면보다 높아 위 · 아래가 잘림: ' + JSON.stringify(r)); }
  { const b = await G(() => { const R = window.Rules, S = window.game.state.raw, i = R.homeInfo(S, 5), j = R.homeInfo(S, 5, 'jeonse'); return { modal: window.game.state.modal, opts: [...document.querySelectorAll('#veil .opt')].map(e => e.textContent), t: document.querySelector('#veil .win').textContent, down: R.won(i.down), sell: R.won(i.sell), weekly: R.won(i.fixed + i.weekly), loan: i.loanMax, dep: R.won(j.deposit), jfix: R.won(j.fixed), grade: i.grade, ltv: Math.round(i.ltv * 100) }; });
    if (b.modal !== 'buy' || b.opts.length !== 4) forced.push('아파트에 들어가는 창에 고를 것 넷(전세 · 최대 · 절반 · 없이)이 없음: ' + JSON.stringify(b).slice(0, 300));
    else {
      if (!/^1전세로 들어간다/.test(b.opts[0]) || b.opts[0].indexOf('보증금 ' + b.dep) < 0 || !/나갈 때 돌려받음/.test(b.opts[0]) || b.opts[0].indexOf('일요일 밤마다 고정비 ' + b.jfix) < 0) forced.push('"전세로 들어간다"에 보증금(돌려받음) · 일요일 밤마다 고정비가 없음: ' + b.opts[0]);
      if (!/^2최대로 빌려 산다/.test(b.opts[1]) || b.opts[1].indexOf('현금 ' + b.down + '만 있으면 됨') < 0 || b.opts[1].indexOf('일요일 밤마다') < 0 || b.opts[1].indexOf(b.weekly) < 0) forced.push('"최대로 빌려 산다"에 필요한 현금 · 일요일 밤마다 나갈 돈(고정비 + 원리금)이 없음: ' + b.opts[1]);
      if (!/절반만 빌려/.test(b.opts[2]) || !/대출 없이 산다/.test(b.opts[3]) || !/모자랍니다/.test(b.opts[3])) forced.push('"절반" · "대출 없이"(현금 모자람)가 다름: ' + b.opts.slice(2).join(' | '));
      if (!/두 번 연속 못 내면 압류되어 한 단계 아래로/.test(b.t) || b.t.indexOf(b.sell) < 0) forced.push('들어가는 창에 압류 경고 · 살던 집이 팔려 보태지는 돈이 없음');
      if (b.grade !== 3 || b.t.indexOf('신용 3등급') < 0 || b.t.indexOf('값의 ' + b.ltv + '%') < 0) forced.push('들어가는 창에 신용등급 · 빌릴 수 있는 몫이 없음: ' + JSON.stringify({ grade: b.grade, ltv: b.ltv }));
      if (!/첫 일요일은 산 날만큼\(\d일치\)만: 고른 것이면 [0-9,]+원/.test(b.t) || !/이자 한 주 \d+(\.\d)?%/.test(b.t) || !/지금 벌이는 주 약 [0-9,]+원/.test(b.t)) forced.push('들어가는 창에 "첫 일요일은 산 날만큼(N일치)" · 한 주 이자 · 지금 벌이(주)가 없음');
    }
    await G(() => window.game.press('Digit4')); await step(4); await G(() => window.game.press('Enter')); await step(20);
    if ((await st()).modal !== 'buy' || (await st()).tier !== 4) forced.push('현금이 모자란 "대출 없이"를 고르고 Enter 를 눌렀는데 창이 닫히거나 사짐');
    await G(() => window.game.press('Digit2')); await step(4); await G(() => window.game.press('Enter')); await step(20);
    const after = await G(() => { const S = window.game.state.raw; return { tier: S.tier, lease: S.lease, loan: S.loan && S.loan.balance, modal: window.game.state.modal }; });
    if (after.tier !== 5 || after.loan !== b.loan || after.lease !== 'own') forced.push('"최대로 빌려 산다"로 샀는데 아파트 · 대출이 다름: ' + JSON.stringify(after));
    if (after.modal) await shot('51_tier_apt');
    await closeAll(); }
  // B. 대출 줄 · 미리 갚기 (25%)
  await step(10); await shot('52_loan_row');
  { const r = await G(() => { const R = window.Rules, S = window.game.state.raw, l = R.loanView(S), e = document.querySelector('#me .me-row.loan'); return { row: e ? e.textContent : '', bal: R.num(l.balance), due: R.num(R.bill(S).loan), left: l.left + '회', btn: !!document.querySelector('#me .me-row.loan [data-do="tab"][data-arg="bank"]'), biz: (document.querySelector('#me .me-row.biz') || {}).textContent || '' }; });
    const days = await G(() => window.Rules.bill(window.game.state.raw).days);
    if (r.row.indexOf(r.bal) < 0 || r.row.indexOf(r.due) < 0 || (days < 7 ? r.row.indexOf('이번 ' + r.due + ' (' + days + '일치)') < 0 : r.row.indexOf(r.left) < 0) || !r.btn) forced.push('빚 줄에 잔액 · 이번 일요일 원리금(이사한 주면 "이번 N (M일치)", 아니면 남은 회) · 은행으로 가는 버튼이 없음: ' + JSON.stringify(r));
    if (!/가게/.test(r.biz) || !/×5/.test(r.biz) || !/법인/.test(r.biz)) forced.push('사업 줄에 지금 사업 · 배수 · 다음 단계가 없음: ' + r.biz); }
  await click('#me .me-row.loan [data-do="tab"]'); await step(10); await shot('52b_bank_loan'); // 빚 줄의 "은행" → 은행 탭 (신용 · 마이너스 통장 · 이번 일요일 정산 + 미리 갚기)
  { const k = await G(() => ({ tab: (document.querySelector('#board .tabs .on') || {}).textContent || '', cols: document.querySelectorAll('#board .bank3 .bcol').length, t: (document.querySelector('#board .bank3') || {}).textContent || '', repay: !!document.querySelector('#board [data-do="repay"]') }));
    if (!/은행/.test(k.tab) || k.cols !== 3 || !/3등급/.test(k.t.replace(/\s/g, '')) || !/마이너스 통장/.test(k.t) || !/주담대 원리금/.test(k.t) || !/합계/.test(k.t) || !k.repay) forced.push('은행 탭에 신용등급 · 마이너스 통장 · 이번 일요일 정산(주담대 원리금 · 합계) · 미리 갚기가 없음: ' + JSON.stringify(k).slice(0, 300)); }
  await click('#board [data-do="repay"]'); await step(20); await shot('53_repay');
  { const b0 = await G(() => window.game.state.raw.loan.balance), n = await G(() => document.querySelectorAll('#veil .opt').length), t = await G(() => document.querySelector('#veil .win').textContent);
    if (n !== 3 || !/25%/.test(t) || !/50%/.test(t) || !/전부/.test(t) || !/이번 일요일 원리금/.test(t)) forced.push('미리 갚기 창에 25% · 50% · 전부 · 이번 일요일 원리금이 없음');
    { const q = await G(() => { const R = window.Rules, S = window.game.state.raw, b = R.bill(S); return { days: b.days, due: R.num(b.loan), full: R.num(R.loanView(S).weekly), row: (/(?:이번|주) ([0-9,]+)/.exec(document.querySelector('#me .me-row.loan').textContent) || [])[1], win: document.querySelector('#veil .win').textContent, opt0: document.querySelector('#veil .opt').textContent, modal: (/안 갚으면 ([0-9,]+)/.exec(document.querySelector('#veil .opt').textContent) || [])[1], next: (/이번 일요일 원리금 ([0-9,]+)원/.exec(document.querySelector('#veil .opt').textContent) || [])[1] }; });
      if (q.row !== q.due || q.modal !== q.due) forced.push('이사 직후 대출 줄의 "주 N"과 미리 갚기 창의 "안 갚으면 N"이 이번 일요일에 나갈 돈과 다름: ' + JSON.stringify(q));
      if (q.days >= 7) forced.push('점검이 이사 직후(이번 주를 다 안 산 때)를 못 만듦: ' + JSON.stringify(q));
      if (q.win.indexOf('(' + q.days + '일치') < 0 || q.win.indexOf('한 주 전체로는 ' + q.full) < 0) forced.push('미리 갚기 창에 "이번 일요일 N (M일치)"와 "한 주 전체로는 N"의 관계가 안 보임: ' + q.win.slice(0, 200));
      if (!/남은 회 \d+ → \d+/.test(q.opt0) || !/앞으로 낼 이자 −[0-9,]+원/.test(q.opt0)) forced.push('미리 갚기의 고를 것에 "남은 회 N → M · 앞으로 낼 이자 −N원"이 없음: ' + q.opt0);
      log.push('이사 직후 원리금: 이번 일요일 ' + q.due + ' (' + q.days + '일치) · 한 주 전체 ' + q.full);
      await G(() => window.game.press('Digit1')); await step(4); await G(() => window.game.press('Enter')); await step(20);
      const after = await G(() => window.Rules.num(window.Rules.bill(window.game.state.raw).loan));
      if (after !== q.next) forced.push('25% 갚은 뒤 이번 일요일 원리금이 창에서 본 것과 다름: 창 ' + q.next + ' · 실제 ' + after); }
    const b1 = await G(() => window.game.state.raw.loan ? window.game.state.raw.loan.balance : 0);
    if (b1 !== b0 - Math.floor(b0 * 0.25 / 10000) * 10000) forced.push('25% 미리 갚기 뒤 잔액이 다름: ' + b0 + ' → ' + b1); }
  await closeAll();
  // C. 사업 키우기 (가게 → 법인): 확인 창 → 사업 확장 창. 알바 카드 일당 = 배수가 곱해진 값, 쉬기 · 공부 카드에 "쉬어도 +"
  await G(() => { const S = window.game.state.raw; S.cash = 20000000; S.slot = 0; S.hp = 50; S.did = null; window.game.render(); }); await step(10); // 체력 50: 컨디션 보통(일당에 ±가 붙지 않는 구간)
  await click('#me [data-do="bizup"]'); await step(20); await shot('54_bizup_confirm');
  if ((await st()).modal !== 'confirm' || !(await G(() => /법인/.test(document.querySelector('#veil h3').textContent) && /자산으로 남지 않음/.test(document.querySelector('#veil .win').textContent)))) forced.push('사업 키우기 확인 창이 다름');
  await G(() => window.game.press('Enter')); await step(20);
  if ((await st()).modal === 'biz') await shot('55_biz_pop'); else forced.push('사업을 키웠는데 사업 확장 창이 안 뜸: ' + (await st()).modal);
  await closeAll();
  await step(10); await shot('56_auto_cards');
  // 아파트에서는 알바가 일곱: 전단지는 앞쪽 넷에 있다 (◀ 로 넘긴 뒤 본다)
  { const c = await G(() => { window.game.run('jpage', '-1'); const R = window.Rules, S = window.game.state.raw, a = R.acts(S); return { biz: S.biz, pay: R.num(a.find(x => x.id === 'flyer').pay), base: R.num(Math.round(90000 * Math.pow(5, 2) / 1000) * 1000), card: document.querySelector('#today [data-arg="flyer"] .pay').textContent, rest: (document.querySelector('#today [data-do="rest"] .auto') || {}).textContent || '', study: (document.querySelector('#today [data-do="study"] .auto') || {}).textContent || '', auto: R.num(a.find(x => x.kind === 'rest').auto) }; });
    if (c.biz !== 2 || c.card !== c.pay || c.pay !== c.base) forced.push('법인 뒤 전단지 카드 일당이 ×25 가 아님: ' + JSON.stringify(c));
    if (!/쉬어도/.test(c.rest) || c.rest.indexOf(c.auto) < 0 || c.study.indexOf(c.auto) < 0) forced.push('쉬기 · 공부 카드에 "쉬어도 +자동 수입"이 없음: ' + JSON.stringify(c)); }
  // 자동 수입: 쉬면 사업 매출이 들어오고 떠오른다
  { const c0 = await G(() => window.game.state.raw.cash); await G(() => window.game.run('rest')); await G(() => window.game.step(2)); const f = await G(() => [...document.querySelectorAll('#fx .fly')].map(e => e.textContent));
    const c1 = await G(() => window.game.state.raw.cash); if (c1 <= c0 || !f.some(t => /매출 \+/.test(t))) forced.push('쉬었는데 사업 매출이 안 들어오거나 안 떠오름: ' + JSON.stringify({ c0, c1, f })); }
  await step(40); await closeAll();
  // D. 공부: 종목 고르기 → 고른 종목만 리포트 칸에
  await G(() => { const S = window.game.state.raw; S.slot = 1; S.hp = 100; S.know = 0; S.studied = 0; window.game.render(); }); await step(10);
  await click('#today [data-do="study"]'); await step(20); await shot('57_study_pick');
  { const p = await G(() => ({ modal: window.game.state.modal, n: document.querySelectorAll('#veil .sbtn').length, t: document.querySelector('#veil .win').textContent }));
    const want = await G(() => window.Rules.acts(window.game.state.raw).find(a => a.kind === 'study').assets.length); // 사는 곳에 따라: 원룸 여덟 · 내 집 열하나 · 아파트부터 열셋 (ETF 는 소식이 없어 빠진다)
    if (p.modal !== 'study' || p.n !== want || want < 8 || /ETF/.test(p.t) || !/체력 8/.test(p.t) || !/1단계/.test(p.t) || !/56% 맞음/.test(p.t)) forced.push('공부 종목 고르기 창(종목 ' + want + ' · ETF 없음 · 체력 · 단계 · 맞을 확률)이 다름: ' + JSON.stringify(p).slice(0, 240));
    await G(() => window.game.press('Digit3')); await step(20); await closeAll(); // 셋째 = 화끈식품 (1단계: 한 종목을 고르면 바로 읽는다)
    await G(() => window.game.run('tab', 'info')); await step(5); await shot('57a_info_report');
    const r = await G(() => ({ assets: (window.Rules.intelView(window.game.state.raw) || {}).assets, right: [...document.querySelectorAll('#board .icol.study .nitem')].map(e => e.textContent).join(' | '), know: (document.querySelector('#board .know') || {}).textContent || '', xp: window.game.state.raw.know }));
    if (!r.assets || r.assets.join() !== 'buldak' || !/화끈식품/.test(r.right) || /대장전자|달나라/.test(r.right)) forced.push('공부한 종목만 리포트 칸에 보여야 함: ' + JSON.stringify(r));
    if (r.xp !== 1 || !/투자공부1단계/.test(r.know.replace(/\s/g, '')) || !/1 \/ 2번/.test(r.know) || !/56%/.test(r.know)) forced.push('뉴스·공부 탭의 투자 공부(단계 · 쌓인 횟수 1 / 2 · 리포트 정확도)가 다름: ' + JSON.stringify(r));
    if (!(await G(() => /아침 값에 이미 들어감/.test(document.querySelector('#board .icol.news h4').textContent)))) forced.push('소식 칸에 "아침 값에 이미 들어감"이 없음'); }
  // D2. 리포트 채점: 어제 리포트가 붙은 오늘 소식 → 소식 옆 딱지가 글로 "리포트" → 그 소식의 하루가 끝난 밤 정산에 "리포트 맞음 / 틀림" 한 줄
  await G(() => { const g = window.game, S = g.state.raw; S.slot = 0; S.hp = 100; S.event = null; S.offer = null; S.picks = 0; S.market.news = S.market.news.filter(n => !(n.day === S.day && n.asset === 'buldak')); S.market.news.push({ id: 9801, day: S.day, asset: 'buldak', dir: 1, src: 'article', truth: false, mag: 0.05, head: '화끈식품 신제품 품절 대란', pre: 0 }); S.market.brief = { day: S.day, madeOn: S.day - 1, ht: null, items: [{ nid: 9801, asset: 'buldak', dir: 1, by: 'study' }] }; g.run('tab', 'info'); g.render(); });
  await step(10); await shot('57b_news_report_tag');
  if (!(await G(() => [...document.querySelectorAll('#board .nitem .rep')].some(e => /^리포트/.test(e.textContent))))) forced.push('어제 리포트가 붙은 소식 옆 딱지가 글("리포트")로 안 읽힘');
  await G(() => { const g = window.game, S = g.state.raw; S.slot = 3; S.cash = Math.max(S.cash, 90000000); g.render(); g.run('endday'); }); await step(30);
  if ((await st()).modal === 'confirm') { await G(() => window.game.press('Enter')); await step(30); }
  { const n = await G(() => ({ modal: window.game.state.modal, reps: (document.querySelector('#veil .n-reps') || {}).textContent || '' }));
    if (n.modal !== 'night' || !/리포트 틀림 — 화끈식품, 리포트는 오르는 쪽 · 실제 소식은 내리는 쪽/.test(n.reps)) forced.push('소식의 하루가 끝난 밤 정산에 "리포트 맞음/틀림" 한 줄이 없거나 다름: ' + JSON.stringify(n));
    await shot('57c_night_report'); }
  await G(() => window.game.press('Space')); await step(30); await closeAll();
  // D3. 한탕바이오 거래량 알림: 그날 한탕바이오 줄에 "거래량" 표시 + 눈에 띄는 알림, 그 전에 읽은 "조용합니다" 리포트는 낡았다고
  await G(() => { const g = window.game, S = g.state.raw; S.slot = 0; S.hp = 100; S.market.ht = { phase: 'quiet', left: 1 }; S.market.intel = { day: S.day + 1, madeOn: S.day, assets: ['hantang'], items: [], ht: { state: 'quiet', lean: 0 } }; g.run('tab', 'stock'); g.run('sview', 'market'); g.render(); g.run('rest'); });
  await step(10); await closeAll(); await G(() => window.game.step(3));
  { const h = await G(() => { const g = window.game, vol = !!document.querySelector('#board .arow .vol'), toast = document.getElementById('toasts').textContent; g.run('tab', 'info'); const right = (document.querySelector('#board .icol.study') || {}).textContent || ''; g.run('tab', 'stock'); return { vol, toast, right }; });
    if (!h.vol || !/거래량 급증/.test(h.toast) || !/리포트 뒤에 거래량이 늘었습니다/.test(h.right) || /조용합니다/.test(h.right)) forced.push('한탕바이오 거래량 알림이 줄 표시 · 알림 · 낡은 리포트 고침으로 안 보임: ' + JSON.stringify(h));
    await page.waitForTimeout(300); await page.screenshot({ path: path.join(out, '57d_hantang_alert.png') }); shots.push('57d_hantang_alert'); const l = await G(LINT); if (l.length) lint['57d_hantang_alert'] = l; }
  // E. 밤사이 갭: 화끈식품을 들고 자고 일어났는데 오늘 소식(공시 호재)이 장 전에 값에 들어감 → 아침 알림
  await G(() => { const g = window.game, S = g.state.raw; S.slot = 3; S.hold.buldak = { units: 1000, cost: S.market.px.buldak * 1000 }; S.market.news = S.market.news.filter(n => n.day !== S.day + 1); S.market.news.push({ id: 9901, day: S.day + 1, asset: 'buldak', dir: 1, src: 'official', truth: true, mag: 0.1, head: '화끈식품, 해외 수출 계약 체결', pre: 0.07 }); S.cash = 90000000; g.render(); g.run('endday'); });
  await step(30);
  if ((await st()).modal === 'night') { await G(() => window.game.press('Space')); await G(() => window.game.step(3)); }
  await closeAll(); await G(() => window.game.step(3)); // 아침 창(사건 · 퀘스트)이 있으면 그 뒤에 알림이 뜬다
  if (!(await G(() => { const g = window.game; g.run('tab', 'info'); const a = [...document.querySelectorAll('#board .nitem .gp')].some(e => /밤사이 \+7%/.test(e.textContent)); g.run('sel', 'buldak'); const b = [...document.querySelectorAll('#board .dnews .gp')].some(e => /밤사이 \+7%/.test(e.textContent)); g.run('sview', 'market'); return a && b; }))) forced.push('뉴스·공부 탭의 소식 줄 · 종목 상세에 그날 내내 남는 "밤사이 +N%"가 없음');
  { const t = await G(() => [...document.querySelectorAll('#toasts .toast.gap')].map(e => e.className + ':' + e.textContent).join(' | '));
    if (!/밤사이/.test(t) || !/화끈식품 \+7\.3%/.test(t) || !/내 손익 \+/.test(t) || !/gap up/.test(t)) forced.push('아침에 밤사이 갭 알림(종목 · 비율 · 내 손익)이 눈에 띄게 안 뜸: ' + t); }
  { // 알림은 모두 한 줄(28px)이고, "내 손익"이 알림 안에 다 보이고, 알림이 주인공 얼굴(SCENE_BOX 의 주인공 상자 위 + 9점 아래)을 덮지 않는다
    const a = await G(() => { const sc = document.querySelector('#me .scene'), img = sc && sc.querySelector('img'), sb = window.PxArt && window.PxArt.SCENE_BOX && window.PxArt.SCENE_BOX[window.game.state.tier];
      const face = img && sb ? img.getBoundingClientRect().top + (sb.hero[1] + 9) * 3 : 9999, hx0 = img && sb ? img.getBoundingClientRect().left + sb.hero[0] * 3 : 0, hx1 = img && sb ? img.getBoundingClientRect().left + sb.hero[2] * 3 : 0;
      return [...document.querySelectorAll('#toasts .toast')].map(e => { const r = e.getBoundingClientRect(), pl = e.querySelector('.pl'), q = pl && pl.getBoundingClientRect(), box = e.firstElementChild && e.lastElementChild.getBoundingClientRect();
        return { t: e.textContent, h: r.height, face: r.bottom > face + 0.5 && r.right > hx0 && r.left < hx1, pl: !pl || (q.right <= box.right + 0.5 && q.width > 0) }; }); });
    for (const x of a) { if (x.h !== 28) forced.push('알림이 한 줄(28px)이 아님: ' + JSON.stringify(x)); if (x.face) forced.push('알림이 주인공 얼굴을 덮음: ' + JSON.stringify(x)); if (!x.pl) forced.push('밤사이 알림의 "내 손익"이 잘림: ' + JSON.stringify(x)); } }
  await page.waitForTimeout(300); await page.screenshot({ path: path.join(out, '58_gap.png') }); shots.push('58_gap');
  await closeAll();
  // F. 압류: 아파트에서 지난주에 한 번 밀린 채 일요일 밤 현금이 없음 → 확인 창 → 정산 → 압류 창(숫자)
  await G(() => { const g = window.game, S = g.state.raw, R = window.Rules; S.tier = 5; S.lease = 'own'; S.deposit = 0; S.homeVal = R.homePrice(S, 5); S.loan = { balance: 30000000, orig: 36000000, day: 20, rate: 0.0136 }; S.credit = 350; S.cl = 0; S.cash = 0; S.missed = 1; S.arrears = 13000000; S.day = 35; S.movedDay = 20; S.slot = 3; for (const a of R.ASSETS) if (a.kind === 'stock') S.hold[a.id] = { units: 0, cost: 0, min: 0 }; S.props = {}; S.lev = null; S.offer = null; S.picks = 0; S.event = null; window.__sold = Math.round(S.homeVal * window.CONFIG.foreclose_rate.value / 1000) * 1000; g.render(); }); // 신용 350점(7등급): 마이너스 통장이 없어 정산을 빌려서 메우지 못한다. 팔리는 값은 그 밤(시세가 움직이기 전)의 시세 기준
  await step(10); await G(() => window.game.run('endday')); await step(20); await shot('59_sleep_confirm');
  if (!(await G(() => window.game.state.modal === 'confirm' && /압류/.test(document.querySelector('#veil .win').textContent) && /두 번째/.test(document.querySelector('#veil .win').textContent)))) forced.push('두 번째로 원리금을 못 내는 밤의 확인 창에 압류 경고가 없음');
  await G(() => window.game.press('Enter')); await step(30); await shot('59b_night_foreclose'); await G(() => window.game.press('Space')); await step(30);
  { const f = await G(() => ({ modal: window.game.state.modal, tier: window.game.state.tier, t: (document.querySelector('#veil .win') || {}).textContent || '', sold: window.Rules.won(window.__sold), credit: window.game.state.raw.credit }));
    if (f.modal !== 'foreclose' || f.tier !== 4 || f.t.indexOf('시세의 95%에 팔림 ' + f.sold) < 0 || !/갚은 대출 · 빚/.test(f.t) || !/내 집/.test(f.t) || !/순자산/.test(f.t)) forced.push('압류 창(시세의 95%에 팔린 값 · 갚은 빚 · 어디로 · 순자산)이 다름: ' + JSON.stringify(f).slice(0, 400));
    if (!(f.credit < 350)) forced.push('압류됐는데 신용점수가 안 깎임: ' + f.credit);
    await shot('60_foreclose'); }
  await closeAll();
  // G. 호텔: 순자산이 기준(180억) 아래면 선언 버튼이 없고, 가장 긴 숫자(현금 34,999,999,999원)에서는 위쪽 띠가 넘치지 않고 선언 버튼 → 확인 → 엔딩 결과 화면
  await G(qi => { const g = window.game, S = g.state.raw, R = window.Rules; S.tier = 8; S.lease = 'own'; S.deposit = 0; S.homeVal = R.homePrice(S, 8); S.loan = { balance: 3000000000, orig: 3000000000, day: 70, rate: 0.0136 }; S.credit = 720; S.missed = 0; S.arrears = 0; S.biz = 5; S.cash = 5999999999; S.day = 77; S.movedDay = 71; S.slot = 1; S.combo = 10; S.quest = qi; S.stats.maxTier = 8; S.act1 = S.act1 || { day: 22, rank: 'A', worth: 16000000, price: 11000000 }; g.render(); }, await QI('top')); // 순자산 = 현금 60억 + 호텔 54억 − 대출 30억 = 84억 < 기준 180억
  await step(60); await closeAll(); await shot('61_hotel_goal_long'); await hudCheck('호텔 · 긴 숫자 (선언 전)');
  if (await G(() => !!document.querySelector('#hud [data-do="top"]'))) forced.push('순자산이 기준 아래인데 선언 버튼이 뜸');
  await G(() => { const S = window.game.state.raw; S.cash = 34999999999; window.game.render(); }); await step(60); await shot('62_hotel_declare'); await hudCheck('호텔 · 가장 긴 숫자');
  { const h = await G(() => ({ hud: !!document.querySelector('#hud [data-do="top"]'), quest: !!document.querySelector('#quest [data-do="top"]'), over: document.getElementById('hud').scrollWidth - document.getElementById('hud').clientWidth, cash: document.getElementById('cash').textContent }));
    if (!h.hud || !h.quest) forced.push('호텔에서 순자산이 기준을 넘었는데 위쪽 띠 · 상태창에 선언 버튼이 없음: ' + JSON.stringify(h));
    if (h.over > 0 || h.cash !== '34,999,999,999원') forced.push('가장 긴 숫자에서 위쪽 띠가 넘침: ' + JSON.stringify(h)); }
  await G(() => window.game.run('roadmap')); await step(20); await shot('63_roadmap_10_hotel');
  if (!(await G(() => document.querySelectorAll('#veil .rung').length === 10 && !!document.querySelector('#veil .rung.next [data-do="top"]')))) forced.push('호텔의 로드맵 창에 열 단계 · 선언 버튼이 없음');
  await G(() => window.game.press('Space')); await step(20);
  await click('#hud [data-do="top"]'); await step(20); await shot('64_confirm_top');
  await G(() => window.game.press('Enter')); await step(60);
  { const r = await G(() => ({ scene: window.game.scene, h1: (document.querySelector('.e-box h1') || {}).textContent, card: (document.querySelector('.e-card pre') || {}).textContent || '', rank: (document.querySelector('.e-box .rank') || {}).textContent }));
    if (r.scene !== 'results' || r.h1 !== '한국 최고 부자' || !/한국 최고 부자/.test(r.card) || !r.rank) forced.push('선언 뒤 엔딩 결과 화면이 다름: ' + JSON.stringify(r).slice(0, 200)); }
  await shot('65_results_top');
  // H. 사는 곳 그림 아홉(서울역 ~ 호텔): 픽셀 그림(128×72 를 3배)인지 · 서로 다른지(alt · src) · 사업 · 대출 줄이 둘 다 붙어 그림 칸이 가장 낮을 때도
  //    주인공 · 상태창(window.PxArt.SCENE_BOX 의 점 좌표를 그림의 실제 자리로 옮긴 것)이 그림 칸 안에 다 보이는지 · 보이는 높이와 그림 위치가 3의 배수(점이 반만 보이지 않게)인지
  await fresh();
  { const sc = [];
    for (let t = 0; t <= 8; t++) {
      for (const slot of [0, 3]) {
        await G(({ t, slot }) => { const g = window.game, S = g.state.raw, R = window.Rules; S.tier = t; S.homeVal = t >= 4 ? R.homePrice(S, t) : 0; S.biz = Math.max(1, t - 3); S.loan = { balance: 50000000, orig: 60000000, day: 40 }; S.cash = 9000000; S.day = 44; S.movedDay = 43; S.slot = slot; S.quest = 99; S.offer = null; S.picks = 0; S.event = null; S.act1 = S.act1 || { day: 22, rank: 'A', worth: 1, price: 1 }; g.render(); }, { t, slot });
        await step(5);
        const r = await G(() => { const box = document.querySelector('#me .scene'), b = box.getBoundingClientRect(), img = box.querySelector('img'), rows = document.querySelectorAll('#me .me-row').length;
          const tier = window.game.state.tier, sb = window.PxArt && window.PxArt.SCENE_BOX && window.PxArt.SCENE_BOX[tier];
          const inn = { top: b.top + box.clientTop, left: b.left + box.clientLeft }; inn.bottom = inn.top + box.clientHeight; inn.right = inn.left + box.clientWidth;
          if (!img || box.querySelector('svg')) return { px: false, name: img ? img.alt : (box.querySelector('svg') || { getAttribute: () => '' }).getAttribute('aria-label') || '', h: box.clientHeight, rows };
          const q = img.getBoundingClientRect(), W = Number(img.getAttribute('width')), H = Number(img.getAttribute('height')), k = q.width / W;
          const part = a => { if (!a) return null; const x0 = q.left + a[0] * k, y0 = q.top + a[1] * k, x1 = q.left + a[2] * k, y1 = q.top + a[3] * k; return { top: y0 - inn.top, bottom: inn.bottom - y1, left: x0 - inn.left, right: inn.right - x1 }; };
          return { px: img.classList.contains('px') && /^data:image\/png/.test(img.src) && W === 128 && H === 72 && k === 3 && q.height === 216, name: img.alt, src: img.src, h: box.clientHeight, off: q.top - inn.top, rows, box: !!sb, hero: part(sb && sb.hero), holo: part(sb && sb.win) }; });
        sc.push(Object.assign({ t, slot }, r));
        const tag = '사는 곳 ' + t + '(' + r.name + ') ' + ['오전', '', '', '밤'][slot];
        if (!r.px) { forced.push(tag + ': 픽셀 그림(128×72 를 3배로 키운 img.px)이 아님 — 예전 그림이 나옴'); continue; }
        if (!r.box) forced.push(tag + ': PxArt.SCENE_BOX[' + t + '] 가 없어 잘림을 잴 수 없음');
        for (const k of ['hero', 'holo']) { const q = r[k]; if (r.box && (!q || q.top < -0.5 || q.bottom < -0.5 || q.left < -0.5 || q.right < -0.5)) forced.push(tag + ': 그림 칸 ' + Math.round(r.h) + 'px 에서 ' + (k === 'hero' ? '주인공' : '상태창') + '이 잘림: ' + JSON.stringify(q)); }
        if (r.h % 3 || Math.round(r.off) % 3) forced.push(tag + ': 그림 칸 높이 ' + r.h + 'px · 그림 위치 ' + r.off + 'px 가 3의 배수가 아님 (맨 윗줄 · 아랫줄 점이 반만 보임)');
        if (slot === 3) await shot('66_scene_' + t + '_' + r.name.replace(/\s/g, ''));
      }
    }
    const night = sc.filter(x => x.slot === 3 && x.px), names = new Set(night.map(x => x.name)), srcs = new Set(night.map(x => x.src));
    if (names.size !== 9 || srcs.size !== 9) forced.push('사는 곳 그림 아홉이 서로 다르지 않음 (이름 ' + names.size + ' · 그림 ' + srcs.size + '): ' + [...names].join(' · '));
    if (sc.some(x => x.rows < 3)) forced.push('그림 점검이 사업 · 대출 줄이 둘 다 붙은 상태가 아님: ' + JSON.stringify(sc.map(x => x.rows)));
    log.push('사는 곳 그림: ' + [...names].join(' · ') + ' (그림 칸 ' + Math.min(...sc.map(x => x.h)) + 'px 까지)'); }
  // I. 시작 전 화면(시연 · 강도 고르기). 번호는 화면 명세의 새 확인 (2 가장 긴 일당은 worst.js, 8 새로 고침은 tut.js 의 실제 저장)
  await fresh();
  // 기본은 고시원(알바가 넷이라 카드 넷이 한 줄에 다 보인다)
  { const JOBS = ['flyer', 'loading', 'store', 'delivery'], NEWJOBS = ['cafe', 'tutor', 'driver', 'lecture', 'tv', 'advise'], HOTEL = { tier: 8, lease: 'own', deposit: 0, homeVal: 8000000000, slot: 2 }; // 새 일 여섯은 호텔 · 저녁 칸에서 (대리는 저녁에만)
    const setS = o => G(o => { const g = window.game, S = g.state.raw; Object.assign(S, { tier: 2, lease: 'rent', deposit: 500000, homeVal: 0, slot: 0, quest: 99, offer: null, picks: 0, event: null, xp: 0, hp: 100, inten: {}, did: null, sick: 0 }, o); g.render(); }, o || {}); // did: 같은 알바는 하루 한 번 — 점검은 같은 알바를 여러 번 열어 보므로 오늘 한 것을 지운다
    const open = async id => { await G(id => window.game.run('job', id), id); await step(10); };
    const lv = id => G(id => window.Rules.acts(window.game.state.raw).find(a => a.id === id).levels, id);
    const view = () => G(() => { const g = window.game, w = document.querySelector('#veil .win.mg'), sr = document.getElementById('stage').getBoundingClientRect(), q = w ? w.getBoundingClientRect() : null;
      return { modal: g.state.modal, pre: g.state.pre, int: g.state.int, mg: !!g.mg, demo: !!g.demo, risks: [...document.querySelectorAll('#veil .ib.risk')].map(b => b.textContent), start: (document.querySelector('#veil [data-do="mgstart"]') || {}).textContent || '', ib: [...document.querySelectorAll('#veil .ib')].map(b => (b.classList.contains('on') ? 'on' : '') + (b.classList.contains('risk') ? 'risk' : '') + (b.classList.contains('lock') ? 'lock' : '')),
        pays: [...document.querySelectorAll('#veil .ib .p')].map(e => e.textContent), head: (document.querySelector('.mg-head i') || {}).textContent || '', chip: (document.querySelector('.mg-head .ich') || {}).textContent || '', howto: !!document.querySelector('.mg-head > span'), line: (document.querySelector('.mg-line') || {}).textContent || '', why: (document.querySelector('.mg-line .why') || {}).textContent || '',
        lineHidden: !!document.querySelector('.mg-line') && getComputedStyle(document.querySelector('.mg-line')).visibility === 'hidden', press: (e => (e && !e.classList.contains('hide') ? e.textContent : ''))(document.querySelector('.mg-press')), demoTag: (document.querySelector('.mg-demo:not(.hide)') || {}).textContent || '',
        win: q ? [q.left, q.top, q.width, q.height].map(x => Math.round(x * 10) / 10).join() : '', locks: [...document.querySelectorAll('#veil .ib.lock')].map(b => b.textContent),
        over: [...document.querySelectorAll('#veil .ib, #veil .mg-head, #veil .mg-line, #veil .mg-how')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.className), inside: !!q && q.top >= sr.top && q.bottom <= sr.bottom && q.left >= sr.left && q.right <= sr.right,
        toast: document.getElementById('toasts').textContent }; });
    const toastsOff = () => G(() => document.querySelectorAll('#toasts .toast').forEach(e => e.remove()));
    // 1. 게임 열 × 강도 넷: 고른 것 · 창 머리 일당(한 줄 하는 법 · 강도 딱지는 머리에 없음) · 한 줄(빠르기를 말로, 숫자 배율 없음 · 상 · 최상만 "보너스 없음") · "자동 시연" 딱지 · 넘침 없음 · 창이 화면 안 (한 장씩 찍어 글자 점검도)
    for (const id of JOBS.concat(NEWJOBS)) {
      await setS(NEWJOBS.indexOf(id) >= 0 ? HOTEL : {}); await open(id);
      const L = await lv(id), names = await G(() => window.Rules.INT);
      for (let n = 0; n < 4; n++) {
        await G(n => { window.game.run('int', String(n)); window.game.step(150); }, n); await step(5); // "준비" 띠가 지나 시연이 하는 중일 때 찍음
        const v = await view(), want = await G(n => window.Rules.won(n), L[n].pay), pay = await G(n => window.Rules.num(n), L[n].pay);
        if (!v.pre || v.mg || v.int !== n || v.ib.join() !== [0, 1, 2, 3].map(k => (k === n ? 'on' : '')).join() || v.head.indexOf(want) < 0 || v.chip || v.howto || v.pays[n].indexOf(pay) < 0 || (n >= 2) !== /실수하면 보너스 없음/.test(v.line) || v.line.indexOf(['천천히 · ', '기준 빠르기', '빠르다 · ', '아주 빠르다 · '][n]) < 0 || /×/.test(v.line) || v.demoTag !== '자동 시연' || v.over.length || !v.inside)
          forced.push('시작 전 화면(' + id + ' · ' + names[n] + ')이 다름: ' + JSON.stringify(v).slice(0, 300));
        await shot('70_pre_' + id + '_' + n);
      }
      await G(() => window.game.press('Escape')); await step(10);
    }
    // 3. 체력이 모자랄 때 (2026-11-19 "무리"): 모자란 강도는 꺼지지 않고 "무리 N%"(쓰러질 확률)로 고를 수 있다 · 기억한 최상보다 내려서(할 수 있는 가장 높은 것으로) 열림 · 무리를 고르면 맨 아래 줄에 확률, 시작 버튼이 "무리"
    //    · 하만 되는 카드 · 어느 강도도 안 되는 카드는 "무리" 카드 · 체력이 0 이면 꺼진 카드
    { const L = await lv('flyer');
      await setS({ hp: L[1].hp, inten: { flyer: 3 } }); await G(() => { window.game.run('why', '체력이 모자랍니다 — 쉬거나 사 먹기'); window.game.step(2); }); // 방 그림 위에 떠 있던 거절 알림은 창이 뜰 때 지워진다
      await open('flyer'); await page.waitForTimeout(300); // 창이 뜨는 연출(0.2초)이 끝난 뒤의 자리를 기준으로
      let v = await view();
      if (v.int !== 1 || v.ib.join() !== ',on,risk,risk') forced.push('체력이 중까지만 될 때 시작 전 화면이 중으로 열리지 않거나 상 · 최상이 "무리"로 안 보임: ' + JSON.stringify(v.ib) + ' int ' + v.int);
      if (/모자랍니다/.test(v.toast)) forced.push('시작 전 창이 떴는데 "모자랍니다" 알림이 남아 창과 겹침: ' + v.toast);
      if (v.risks.length !== 2 || !/^상무리 \d+%$/.test(v.risks[0]) || !/^최상무리 \d+%$/.test(v.risks[1]) || !/시작/.test(v.start)) forced.push('모자란 강도 칸에 "무리 N%"가 없거나, 할 수 있는 강도인데 시작 버튼이 "시작"이 아님: ' + JSON.stringify({ risks: v.risks, start: v.start }));
      if (await G(() => window.game.state.raw.inten.flyer) !== 3) forced.push('체력이 모자라 내려서 열었는데 기억한 강도(최상)가 덮어써짐');
      await shot('71_pre_low_hp');
      const w0 = v.win; await click('#veil .ib[data-arg="3"]'); await step(5); v = await view();
      if (v.int !== 3 || !/^체력이 모자랍니다 \(\d+ \/ \d+\) — 무리하면 끝나고 쓰러질 확률 \d+%$/.test(v.why) || v.toast || !/무리/.test(v.start)) forced.push('모자란 강도(최상)를 눌렀는데 안 골라지거나, 쓰러질 확률이 창 안 맨 아래 줄에 없거나, 시작 버튼이 "무리"가 아님: ' + JSON.stringify({ int: v.int, why: v.why, toast: v.toast, start: v.start }));
      { const want = await G(() => { const g = window.game, S = g.state.raw, a = window.Rules.acts(S).find(x => x.id === 'flyer'); return Math.round(a.levels[3].risk * 100); }); if (v.why.indexOf('확률 ' + want + '%') < 0 || !(want >= 25 && want <= 95)) forced.push('창에 적힌 쓰러질 확률이 규칙의 값(' + want + '%)과 다름: ' + v.why); }
      if (v.win !== w0) forced.push('무리를 고를 때 창이 움직임: ' + w0 + ' → ' + v.win);
      await shot('71b_pre_push');
      await G(() => { window.game.press('ArrowLeft'); window.game.step(5); window.game.press('ArrowLeft'); window.game.step(5); }); v = await view();
      if (v.int !== 1 || v.why || !/기준 빠르기/.test(v.line) || !/시작/.test(v.start)) forced.push('← 로 할 수 있는 강도(중)로 돌아왔는데 확률 줄이 남거나 시작 버튼이 "무리"임: ' + JSON.stringify({ int: v.int, line: v.line, start: v.start }));
      await G(() => window.game.press('Escape')); await step(10);
      await setS({ hp: L[0].hp, inten: { flyer: 2, loading: 3 } }); await step(5); await toastsOff();
      const c = await G(() => { const R = window.Rules, a = R.acts(window.game.state.raw), card = id => [...document.querySelectorAll('#today .card')].find(e => e.title.indexOf(a.find(x => x.id === id).name + ' —') === 0);
        const f = card('flyer'), l = card('loading'), A = a.find(x => x.id === 'loading'); return { f: f && { cls: f.className, do: f.dataset.do, tag: (f.querySelector('.ich') || {}).textContent, pay: f.querySelector('.pay').textContent, hp: f.querySelector('.cost, .lack').textContent, skip: !!f.querySelector('.skip') }, l: l && { cls: l.className, do: l.dataset.do, tag: (l.querySelector('.ich') || {}).textContent, skip: !!l.querySelector('.skip'), title: l.title }, risk: Math.round(A.levels[0].risk * 100), push: A.push, want: R.num(a[0].levels[0].pay), hp0: '−' + a[0].levels[0].hp }; });
      if (!c.f || !/go/.test(c.f.cls) || c.f.do !== 'job' || c.f.tag !== '하' || c.f.pay !== c.want || c.f.hp !== c.hp0 || c.f.skip) forced.push('하만 되는 전단지 카드가 켜져 하의 일당 · 체력 · 딱지를 보이고 대충을 숨겨야 함: ' + JSON.stringify(c));
      if (!c.l || !c.push || !/go/.test(c.l.cls) || !/push/.test(c.l.cls) || c.l.do !== 'job' || c.l.tag !== '무리' || c.l.skip || c.l.title.indexOf('쓰러질 확률 ' + c.risk + '%') < 0) forced.push('어느 강도도 체력이 모자란 상하차 카드가 "무리" 카드(딱지 · 설명에 쓰러질 확률 · 대충 없음)가 아님: ' + JSON.stringify(c.l));
      await shot('72_cards_low_hp');
      await open('loading'); await page.waitForTimeout(300); v = await view();
      if (!v.pre || v.int !== 0 || v.ib.join() !== 'onrisk,risk,risk,risk' || !/무리/.test(v.start) || !/쓰러질 확률/.test(v.why)) forced.push('무리 카드를 열면 하(무리)로 열리고 네 강도가 모두 "무리 N%", 시작 버튼이 "무리"여야 함: ' + JSON.stringify({ pre: v.pre, int: v.int, ib: v.ib, start: v.start, why: v.why }));
      await shot('72b_pre_all_push'); await G(() => window.game.press('Escape')); await step(10);
      await setS({ hp: 0 }); await step(5); await toastsOff();
      { const z = await G(() => { const t = document.querySelector('#today .card.off[data-do="why"]'), n = document.querySelectorAll('#today .card.push').length; if (t) t.click(); window.game.step(5); return { off: !!t, push: n, modal: window.game.state.modal, toast: document.getElementById('toasts').textContent }; });
        if (!z.off || z.push || z.modal || !/체력이 모자랍니다 — 쉬거나 사 먹기/.test(z.toast)) forced.push('체력이 0 이면 알바 카드가 꺼지고(무리도 안 됨) 누르면 까닭이 떠야 함: ' + JSON.stringify(z)); }
      await shot('72c_cards_hp0'); }
    // 오늘 칸 카드의 강도 딱지가 넷 다 다를 때
    await setS({ inten: { flyer: 0, loading: 1, store: 2, delivery: 3 } }); await step(5);
    { const t = await G(() => ['flyer', 'loading', 'store', 'delivery'].map(id => { const c = document.querySelector('#today .card[data-arg="' + id + '"]'), e = c.querySelector('.ich');
        const hit = e ? [...c.querySelectorAll('.pic, .lv, .tag, .key')].filter(o => { const a = e.getBoundingClientRect(), b = o.getBoundingClientRect(); return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > (o.classList.contains('pic') ? 8 : 0.5); }).map(o => o.className) : []; // 그림 칸과는 맨 위 가장자리(8px)까지만 — 딱지는 카드 위쪽 줄에
        const A = window.Rules.acts(window.game.state.raw).find(a => a.id === id); return { tag: e ? e.textContent : '', hit, skip: (c.querySelector('.skip') || {}).textContent, want: '대충 ' + window.Rules.num(Math.round(A.pay * window.Rules.skipMult(window.game.state.raw) / 1000) * 1000) }; }));
      if (t.map(x => x.tag).join() !== '하,,상,최상') forced.push('오늘 칸 카드의 강도 딱지가 기억한 강도와 다르거나 중에도 붙음: ' + t.map(x => x.tag).join());
      if (t.some(x => x.hit.length)) forced.push('카드의 강도 딱지가 그림 · 숙련 · 추천 · 숫자 키와 겹침: ' + JSON.stringify(t.map(x => x.hit)));
      if (t.some(x => x.skip !== x.want)) forced.push('"대충" 버튼에 받을 돈(중 일당 × 대충 배율)이 안 적힘: ' + t.map(x => x.skip + ' / ' + x.want).join(' · ')); }
    await shot('73_cards_int_tags');
    // 4. 시연이 실제로 움직임: 0.5초 간격 그림 둘이 다름 · 판 수가 늚 · 시연이 누른 키 딱지가 눌린 모양
    await setS(); await open('store');
    { const pic = () => G(() => document.getElementById('mgc').toDataURL());
      const a = await pic(); await page.screenshot({ path: path.join(out, '74_demo_a.png') }); await G(() => window.game.step(30)); const b = await pic(); await page.screenshot({ path: path.join(out, '74_demo_b.png') });
      const l0 = await G(() => window.game.demo.loops); await G(() => window.game.step(60 * 14)); const l1 = await G(() => window.game.demo.loops);
      const lit = await G(() => { const g = window.game; for (let i = 0; i < 600; i++) { g.step(1); const p = g.demo.lastPress, on = document.querySelector('#veil .keys .key.on'); if (p && p.age < 0.15 && on) { const big = document.querySelector('#veil .mg-press'), c = g.demo.controls.find(x => x.code === p.code); return { code: p.code, on: on.dataset.k, down: getComputedStyle(on).transform, big: big.classList.contains('hide') ? '' : big.textContent, label: c.label }; } } return null; });
      await shot('74_demo_key_lit'); // 눌린 키 딱지가 노랗게 내려앉고, 그림 아래 가운데에 큰 키 딱지가 뜬 때
      const off = await G(() => { window.game.step(20); const p = window.game.demo.lastPress; return p.age >= 0.15 ? document.querySelectorAll('#veil .keys .key.on').length : 0; });
      const bigOff = await G(() => { const g = window.game; for (let i = 0; i < 600; i++) { g.step(1); const p = g.demo.lastPress; if (p.age >= 0.35) return !document.querySelector('#veil .mg-press').classList.contains('hide'); } return true; });
      if (!lit || lit.big.indexOf(lit.label) < 0 || bigOff) forced.push('시연이 키를 누른 순간 그림 아래 가운데에 큰 키 딱지(키 + 조작 이름)가 안 뜨거나 0.35초 뒤에 안 꺼짐: ' + JSON.stringify({ lit, bigOff }));
      await G(() => window.game.render()); { const relit = await G(() => { const g = window.game; for (let i = 0; i < 600; i++) { g.step(1); const p = g.demo.lastPress; if (p && p.age < 0.15) return !!document.querySelector('#veil .keys .key.on'); } return false; }); // 다른 까닭으로 다시 그려져도 다음 누름에 켜짐
        if (!relit) forced.push('시작 전 화면이 다시 그려진 뒤 시연이 누른 키 딱지가 안 켜짐'); }
      if (a === b) forced.push('시연이 0.5초 동안 그림이 그대로 (안 움직임)');
      if (!(l1 > l0)) forced.push('시연이 되풀이되지 않음 (loops ' + l0 + ' → ' + l1 + ')');
      if (!lit || lit.code !== lit.on || !/matrix/.test(lit.down) || off) forced.push('시연이 누른 키의 딱지가 눌린 모양이 아니거나 안 꺼짐: ' + JSON.stringify({ lit, off }));
      log.push('시연: loops ' + l0 + ' → ' + l1 + ' · 깜빡인 키 ' + (lit && lit.code)); }
    // 5. 돌아가기: 열고(강도를 바꾸고) 닫은 뒤의 판 상태 = 열기 전 (inten 만 다름). Esc · 버튼 둘 다
    await G(() => window.game.press('Escape')); await step(10);
    { const s0 = await G(() => JSON.stringify(window.game.state.raw));
      await open('loading'); await G(() => window.game.press('ArrowRight')); await step(5); await click('#veil [data-do="no"]'); await step(10);
      const r = await G(s0 => { const a = JSON.parse(s0), b = window.game.state.raw, c = JSON.parse(JSON.stringify(b)); const ia = a.inten, ib = c.inten; delete a.inten; delete c.inten; return { same: JSON.stringify(a) === JSON.stringify(c), ia, ib, modal: window.game.state.modal }; }, s0);
      if (!r.same || r.modal || r.ib.loading !== 2 || (r.ia || {}).loading != null) forced.push('돌아가기 뒤 판 상태가 열기 전과 다름(강도 기억 말고): ' + JSON.stringify(r).slice(0, 200));
      const s1 = await G(() => JSON.stringify(window.game.state.raw)); await open('flyer'); await G(() => window.game.press('Escape')); await step(10);
      if (s1 !== await G(() => JSON.stringify(window.game.state.raw))) forced.push('Esc 로 돌아갔는데 판 상태가 바뀜'); }
    // 6. 기억한 강도로 시작해 끝까지: 쓴 체력 = levels[n].hp · job 이벤트 int · 하는 중 · 결과에 머리의 강도 딱지 · 결과 판의 계산 줄(배율마다 이름: "기준 170,000 · 잘함 ×1.2 · 최상 ×1.5", 중 · 실수면 강도 조각 없음)
    //    · 결과가 뜨면 맨 아래 강도 한 줄은 숨김 · 23. 시작 전 화면이 열린 뒤 강도를 바꿀 때 · 시연이 키를 누를 때 · 시작할 때 · 결과가 뜰 때 창이 한 점도 안 움직임
    for (const [n, score, tag] of [[3, 0.8, 'top_good'], [3, 0.1, 'top_miss'], [0, 0.5, 'low_ok'], [1, 0.8, 'mid_good']]) {
      await setS({ inten: { loading: n } }); await open('loading'); await page.waitForTimeout(300); // 뜨는 연출이 끝난 뒤부터는 누를 때마다 바로 잰다 (창을 새로 만들면 연출이 다시 돌아 잡힌다)
      const L = await lv('loading'), hp0 = await G(() => window.game.state.raw.hp), wins = [(await view()).win];
      if ((await view()).int !== n) forced.push('기억한 강도(' + n + ')로 열리지 않음');
      await G(n => { window.game.run('int', String(n ? n - 1 : 1)); window.game.step(5); }, n); wins.push((await view()).win); await G(n => { window.game.run('int', String(n)); window.game.step(5); }, n); wins.push((await view()).win);
      await G(() => { const g = window.game; for (let i = 0; i < 600 && !(g.demo.lastPress && g.demo.lastPress.age === 0); i++) g.step(1); }); wins.push((await view()).win);
      await G(() => window.game.press('Space')); await step(4); wins.push((await view()).win);
      if (!(await G(n => { const p = window.game.state.raw.pending; return !!window.game.mg && !window.game.state.pre && !!p && p.id === 'loading' && p.n === n; }, n))) forced.push('강도 ' + n + '(으)로 시작되지 않거나 하는 중으로 적힌 강도가 다름: ' + JSON.stringify(await G(() => window.game.state.raw.pending)));
      const names = await G(() => window.Rules.INT); { const v = await view(); if (v.chip !== '강도 ' + names[n] || v.howto) forced.push('하는 중에 머리의 강도 딱지가 없거나 한 줄 하는 법이 머리에 남음: ' + JSON.stringify({ chip: v.chip, howto: v.howto })); }
      if (n === 3 && score > 0.5) { await G(() => window.game.step(60)); await shot('75_playing_top'); }
      await G(score => { const g = window.game; g.step(90); g.mg.done = true; g.mg.result = { score }; g.step(1); }, score); await G(() => window.game.step(60));
      const v = await view(); wins.push(v.win);
      const r = await G(() => { const S = window.game.state.raw, j = S.ev.find(e => e.t === 'job'), t = document.querySelector('.mg-res').textContent; return { j: j && { int: j.int, hp: j.hp, imult: j.imult, grade: j.grade, gradeName: j.gradeName, mult: j.mult, gmult: j.gmult, base: j.base }, hp: S.hp, t }; });
      const calc = await G(j => { const N = window.Rules.num; return '기준 ' + N(j.base) + ' · ' + j.gradeName + ' ×' + j.gmult + (j.int !== 1 && j.grade !== 'miss' ? ' · ' + window.Rules.INT[j.int] + ' ×' + j.imult : ''); }, r.j);
      if (!r.j || r.j.int !== n || r.j.hp !== L[n].hp || Math.abs(hp0 - r.hp - L[n].hp) > 1e-9) forced.push('강도 ' + n + '(으)로 했는데 쓴 체력 · job 이벤트가 다름: ' + JSON.stringify({ r, hp0, want: L[n].hp }));
      if (r.t.indexOf(calc) < 0 || /\(최상\)|×1\(/.test(r.t)) forced.push('결과 판의 계산 줄에 배율마다 이름이 없음 (' + calc + '): ' + r.t);
      if (v.chip !== '강도 ' + names[n] || !v.lineHidden) forced.push('결과 판에서 머리의 강도 딱지가 없거나 맨 아래 강도 한 줄이 남음: ' + JSON.stringify({ chip: v.chip, hidden: v.lineHidden }));
      if (tag === 'top_good' && (r.j.imult !== await G(() => window.CONFIG.int_pay_3.value) || r.t.indexOf('최상 ×' + r.j.imult) < 0 || /보너스 없음/.test(r.t))) forced.push('최상 · 잘함인데 강도 배율이 안 붙음: ' + JSON.stringify(r.j));
      if (tag === 'top_miss' && (r.j.imult !== 1 || !/실수 — 강도 보너스 없음/.test(r.t) || /최상 ×/.test(r.t))) forced.push('최상 · 실수인데 "강도 보너스 없음"이 한눈에 안 보이거나 강도 조각이 남음: ' + r.t);
      if (tag === 'low_ok' && r.t.indexOf('하 ×' + L[0].payMult) < 0) forced.push('하 · 보통인데 "하 ×0.8" 조각이 없음: ' + r.t);
      if (tag === 'mid_good' && /중 ×/.test(r.t)) forced.push('중인데 강도 조각이 붙음: ' + r.t);
      if (new Set(wins).size !== 1) forced.push('시작 전 화면부터 결과까지 창이 움직임 (강도 ' + n + '): ' + wins.join(' / '));
      await shot('75_result_' + tag);
      await G(() => window.game.press('Space')); await step(20); await closeAll(); }
    // 7. 다시 열면 기억한 강도 · 체력이 모자라면 내려가 있고 기억은 그대로
    { await setS({ inten: { loading: 3 } }); await open('loading'); const a = (await view()).int; await G(() => window.game.press('Escape')); await step(10);
      const L = await lv('loading'); await setS({ hp: L[2].hp, inten: { loading: 3 } }); await open('loading'); const b = (await view()).int; await G(() => window.game.press('Escape')); await step(10);
      const keep = await G(() => window.game.state.raw.inten.loading);
      if (a !== 3 || b !== 2 || keep !== 3) forced.push('다시 열 때 기억한 강도가 아니거나, 체력이 모자라 내린 것이 기억을 덮음: ' + JSON.stringify({ a, b, keep })); }
  }
  // K. 2026-11-19 피드백으로 생긴 화면을 실제 버튼으로: 후드 색 · 꿈 고르기 · 가게(옷을 입으면 효과와 모습) · 입주(월세 / 전세) · 전세로 갈아타기 · 은행(빌리기 / 갚기 / 정산 때 자동 대출)
  //    · 부동산(상가 사기 / 팔기) · 무리 → 쓰러짐 → 병원의 밤 → 오전을 잃은 아침 · 꿈의 장면 · 일요일 정산(임대수익 · 배당 · 신용 · 시세)
  {
    const veil = () => G(() => ({ modal: window.game.state.modal, t: (document.querySelector('#veil .win') || {}).textContent || '', opts: [...document.querySelectorAll('#veil .opt')].map(e => e.textContent) }));
    const key = async (k, n) => { await G(k => window.game.press(k), k); await step(n || 20); };
    await page.goto('file://' + path.resolve(dir, 'index.html') + '?manual=1&seed=' + seed); await step(10);
    { const t = await G(() => { const ls = [...document.querySelectorAll('.t-looks .look')]; if (ls[2]) ls[2].click(); window.game.step(3); return { n: ls.length, on: [...document.querySelectorAll('.t-looks .look')].findIndex(e => e.classList.contains('on')), look: window.game.meta.look }; });
      if (t.n !== 4 || t.on !== 2 || t.look !== 2) forced.push('제목 화면의 후드 색 넷 중 셋째를 눌렀는데 켜지지 않음: ' + JSON.stringify(t));
      await shot('80_title_look'); }
    await click('[data-do="new"]'); await step(30);
    { const d0 = await G(() => ({ modal: window.game.state.modal, n: document.querySelectorAll('#veil .dcard').length, intro: (document.querySelector('#veil .dintro') || {}).textContent || '' }));
      await key('Digit2', 5); await shot('81_intro_dream');
      const d1 = await G(() => ({ on: [...document.querySelectorAll('#veil .dcard')].findIndex(e => e.classList.contains('on')), intro: (document.querySelector('#veil .dintro') || {}).textContent || '' }));
      await key('Space', 40);
      const d2 = await G(() => { const S = window.game.state.raw; return { dream: S.dream, look: S.look, note: (document.querySelector('#quest .note.dream') || {}).textContent || '' }; });
      if (d0.modal !== 'intro' || d0.n !== 3 || d1.on !== 1 || d1.intro === d0.intro || d2.dream !== 'sign' || d2.look !== 2 || !/간판을 다시 건다/.test(d2.note)) forced.push('첫 창에서 고른 꿈(둘째) · 제목에서 고른 후드 색이 판에 남지 않음: ' + JSON.stringify({ d0, d1, d2 }).slice(0, 400)); }
    // 꿈의 장면: 고시원에 들어가면(주소) 첫 장면 창이 한 번 뜬다
    await G(() => { const g = window.game, S = g.state.raw; S.tier = 1; S.cash = 700000; S.day = 3; S.quest = 99; g.render(); g.run('move', '2'); g.step(30); }); await key('Enter', 40);
    { const seenM = []; for (let i = 0; i < 6; i++) { const v = await veil(); if (!v.modal) break; seenM.push(v.modal); if (v.modal === 'story') { await shot('82_story'); if (!/고시원 벽에 메뉴판을 다시 적어 붙였다/.test(v.t) || !/1 \/ 2/.test(v.t)) forced.push('꿈의 첫 장면 창(글 · 1 / 2)이 다름: ' + v.t.slice(0, 160)); } await key(v.modal === 'perk' ? 'Digit1' : 'Space', 40); }
      const s2 = await G(() => { const S = window.game.state.raw; return { tier: S.tier, dep: S.deposit, lease: S.lease, beats: S.beats, credit: S.credit }; });
      if (s2.tier !== 2 || s2.dep !== 500000 || seenM.indexOf('story') < 0 || (s2.beats || []).join() !== 'sign1' || !(s2.credit >= 450)) forced.push('고시원 입주(예치금 500,000 · 주소가 생겨 신용 +100 — 칭호가 오르면 +25씩 더) 뒤 꿈의 첫 장면이 안 뜸: ' + JSON.stringify({ s2, seenM })); }
    // 가게: 작업 조끼를 사면 바로 입고(상하차에 드는 체력이 준다), 방 그림의 내 모습이 바뀐다. 후드티로 갈아입으면 효과가 사라진다
    await G(() => { const g = window.game, S = g.state.raw; S.cash = 900000; S.hp = 50; g.render(); g.run('tab', 'shop'); g.step(5); });
    { const hpOf = () => G(() => window.Rules.acts(window.game.state.raw).find(a => a.id === 'loading').levels[1].hp), pic = () => G(() => (document.querySelector('#me .scene img') || {}).src || '');
      const h0 = await hpOf(), p0 = await pic(); await shot('83_shop');
      await click('#board [data-do="item"][data-arg="vest"]'); await step(20); await closeAll(); await step(5);
      const a = await G(() => { const S = window.game.state.raw; return { have: !!S.items.vest, wear: S.wear, cash: S.cash, on: (document.querySelector('#board .sitem.wear.have .chip.hot') || {}).textContent || '' }; }), h1 = await hpOf(), p1 = await pic();
      if (!a.have || a.wear !== 'vest' || a.cash !== 600000 || !(h1 < h0) || p1 === p0 || !/입는 중/.test(a.on)) forced.push('작업 조끼를 샀는데 입혀지지 않거나(상하차 체력 ' + h0 + ' → ' + h1 + ') 방 그림의 모습이 그대로임: ' + JSON.stringify(a));
      await shot('83b_shop_wear');
      await click('#board .sitem.wear [data-do="wear"][data-arg=""]'); await step(10);
      const h2 = await hpOf(), p2 = await pic();
      if (h2 !== h0 || p2 !== p0 || await G(() => window.game.state.raw.wear) !== '') forced.push('후드티로 갈아입었는데 조끼의 효과 · 모습이 남음: ' + JSON.stringify({ h0, h2 })); }
    // 입주 창: 월세 / 전세 — 보증금 · 지금 나갈 현금 · 일요일 밤마다 나갈 돈 · 지금 벌이 대비 %. 월세로 들어간다
    await G(() => { const g = window.game, S = g.state.raw; S.cash = 9000000; S.day = 9; S.movedDay = 4; S.credit = 640; g.render(); g.run('tab', 'road'); g.run('move', '3'); g.step(30); });
    { const v = await veil(); await shot('84_lease');
      if (v.modal !== 'lease' || v.opts.length !== 2 || !/^1월세/.test(v.opts[0]) || v.opts[0].indexOf('보증금 2,000,000원') < 0 || v.opts[0].indexOf('고정비 2,600,000원') < 0 || !/^2전세/.test(v.opts[1]) || v.opts[1].indexOf('보증금 6,500,000원') < 0 || v.opts[1].indexOf('고정비 900,000원') < 0) forced.push('입주 창의 월세 · 전세(보증금 · 일요일 밤마다 고정비)가 다름: ' + JSON.stringify(v.opts));
      if (!/고시원 예치금 500,000원은 돌려받아/.test(v.t) || !/지금 벌이는 주 약 [0-9,]+원/.test(v.t) || !/월세 \d+% · 전세 \d+%/.test(v.t) || !/순자산은 그대로/.test(v.t)) forced.push('입주 창에 돌려받는 예치금 · 지금 벌이 대비 고정비(%) · "순자산은 그대로"가 없음: ' + v.t.slice(0, 300));
      const w0 = await G(() => window.Rules.worth(window.game.state.raw));
      await key('Digit1', 4); await key('Enter', 30);
      const m = await G(() => { const S = window.game.state.raw; return { tier: S.tier, lease: S.lease, dep: S.deposit, worth: window.Rules.worth(S), modal: window.game.state.modal }; });
      if (m.tier !== 3 || m.lease !== 'rent' || m.dep !== 2000000 || !(w0 - m.worth >= 0 && w0 - m.worth < 1300000)) forced.push('월세로 입주했는데 계약 · 보증금이 다르거나 순자산이 살던 곳 정산보다 더 줄었음: ' + JSON.stringify({ m, w0 }));
      if (m.modal) await shot('84b_tier_oneroom'); await closeAll(); await step(5);
      if (!(await G(() => /원룸/.test(document.querySelector('#me .zh').textContent) && /월세/.test(document.querySelector('#me .zh').textContent)))) forced.push("'나' 구역 머리에 사는 곳 · 계약(원룸 월세)이 안 보임"); }
    // 전세로 갈아타기: 확인 창 → 보증금이 바뀌고 매주 나가는 돈이 준다 · 신용 +30
    await G(() => { const g = window.game, S = g.state.raw; S.cash = 9000000; g.render(); g.run('lease', 'jeonse'); g.step(30); });
    { const v = await veil(); await shot('85_swap_jeonse'); const c0 = await G(() => window.game.state.raw.credit);
      if (v.modal !== 'confirm' || !/원룸을 전세로 바꿀까요/.test(v.t) || !/전세 보증금 6,500,000원/.test(v.t) || !/2,600,000원 → 900,000원/.test(v.t)) forced.push('전세로 갈아타는 확인 창이 다름: ' + v.t.slice(0, 240));
      await key('Enter', 30); await closeAll();
      const m = await G(() => { const S = window.game.state.raw, R = window.Rules; return { lease: S.lease, dep: S.deposit, week: R.weekCost(S, 3), credit: S.credit, jeonse: S.stats.jeonse }; });
      if (m.lease !== 'jeonse' || m.dep !== 6500000 || m.week !== 900000 || !(m.credit >= c0 + 30) || !m.jeonse) forced.push('전세로 갈아탔는데 계약 · 보증금 · 고정비 · 신용점수(+30, 칭호가 오르면 더)가 다름: ' + JSON.stringify(m)); }
    // 은행: 한도까지 빌리기 → 빚 줄 → 전부 갚기. 4등급(640점대) · 원룸 = 한도 1,650,000원
    await G(() => { const g = window.game, S = g.state.raw; S.credit = 640; S.cash = 500000; g.render(); g.run('tab', 'bank'); g.run('bamt', 'room'); g.step(5); });
    { await shot('86_bank'); const b0 = await G(() => { const v = window.Rules.creditView(window.game.state.raw); return { grade: v.grade, limit: v.limit, amt: document.getElementById('bamt').textContent }; });
      await click('#board [data-do="borrow"]'); await step(20); await closeAll();
      const b1 = await G(() => { const S = window.game.state.raw; return { cl: S.cl, cash: S.cash, row: (document.querySelector('#me .me-row.loan') || {}).textContent || '', week: window.Rules.creditView(S).week }; });
      if (b0.grade !== 4 || b0.limit !== 1650000 || b0.amt !== '1,650,000' || b1.cl !== 1650000 || b1.cash !== 2150000 || b1.row.indexOf('1,650,000') < 0 || !(b1.week > 0)) forced.push('마이너스 통장을 한도까지 빌렸는데 한도 · 빚 · 현금 · 빚 줄이 다름: ' + JSON.stringify({ b0, b1 }));
      await shot('86b_bank_borrowed');
      await G(() => { window.game.run('bamt', 'bal'); window.game.step(3); }); await click('#board [data-do="repaycl"]'); await step(20);
      const b2 = await G(() => { const S = window.game.state.raw; return { cl: S.cl, cash: S.cash, row: !!document.querySelector('#me .me-row.loan') }; });
      if (b2.cl !== 0 || b2.cash !== 500000 || b2.row) forced.push('빚을 전부 갚았는데 빚 · 현금 · 빚 줄이 남음: ' + JSON.stringify(b2)); }
    // 부동산: 골목 상가 한 칸을 사면 값은 자산으로 남고(순자산은 취득세 · 중개비만큼만 줄고) 일요일 밤마다 임대수익, 팔면 중개비를 뗀다
    await G(() => { const g = window.game, S = g.state.raw; S.cash = 9000000; g.render(); g.run('tab', 'realty'); g.step(5); });
    { await shot('87_realty'); const w0 = await G(() => window.Rules.worth(window.game.state.raw));
      await click('#board [data-do="propbuy"][data-arg="stall"]'); await step(20); const v = await veil(); await shot('87b_prop_confirm');
      if (v.modal !== 'confirm' || !/골목 상가 한 칸을 살까요/.test(v.t) || !/취득세 · 중개비/.test(v.t) || !/임대수익/.test(v.t)) forced.push('상가를 사는 확인 창이 다름: ' + v.t.slice(0, 200));
      await key('Enter', 30); await closeAll(); await step(5);
      const p1 = await G(() => { const S = window.game.state.raw, R = window.Rules, v = R.propView(S); return { have: !!S.props.stall, worth: R.worth(S), rent: v.rent, rows: document.querySelectorAll('#board .prow.have').length, sell: !!document.querySelector('#board [data-do="propsell"][data-arg="stall"]'), income: R.weekIncome(S).total }; });
      if (!p1.have || !(w0 - p1.worth > 0 && w0 - p1.worth < 400000) || !(p1.rent > 100000) || p1.rows !== 1 || !p1.sell) forced.push('상가를 샀는데 순자산이 세금보다 더 줄거나 임대수익 · 가진 줄 · 팔기 버튼이 없음: ' + JSON.stringify({ p1, w0 }));
      await shot('87c_realty_owned');
      await click('#board [data-do="propsell"][data-arg="stall"]'); await step(20); await shot('87d_prop_sell'); await key('Enter', 30); await closeAll();
      if (await G(() => !!window.game.state.raw.props.stall)) forced.push('상가를 팔았는데 그대로 남음'); }
    // 무리 → 쓰러짐: 체력 6으로 배달(무리)을 끝내면 응급실 — 응급실비 · 오늘 남은 칸 · 다음 날 오전을 잃고, 그 밤은 병원에서 잔다 (점검은 쓰러질 확률을 100%로 올린다)
    await G(() => { const g = window.game, S = g.state.raw; window.CONFIG.collapse_min.value = 1; S.hp = 6; S.slot = 0; S.did = null; S.cash = 3000000; g.render(); g.run('tab', 'road'); g.step(5); });
    { await shot('88_cards_push'); await click('#today .card.push[data-arg="delivery"]', { position: { x: 20, y: 60 } }); await step(20);
      const pre = await G(() => ({ pre: window.game.state.pre, start: (document.querySelector('#veil [data-do="mgstart"]') || {}).textContent || '', line: (document.querySelector('#veil .mg-line') || {}).textContent || '' })); await shot('88b_pre_push');
      if (!pre.pre || !/무리/.test(pre.start) || !/쓰러질 확률 100%/.test(pre.line)) forced.push('무리 카드의 시작 전 화면(시작 버튼 "무리" · 쓰러질 확률)이 다름: ' + JSON.stringify(pre));
      const c0 = await G(() => window.game.state.raw.cash);
      await key('Space', 4); await G(() => { const g = window.game; g.step(90); g.mg.done = true; g.mg.result = { score: 0.8 }; g.step(1); }); await G(() => window.game.step(60)); await shot('88c_result_push');
      await key('Space', 30);
      let v = await veil(); for (let i = 0; i < 4 && v.modal && v.modal !== 'collapse'; i++) { await key(v.modal === 'perk' ? 'Digit1' : 'Space', 40); v = await veil(); }
      await shot('89_collapse');
      const k = await G(() => { const S = window.game.state.raw; return { slot: S.slot, hp: S.hp, sick: S.sick, hosp: S.hosp, cash: S.cash, n: S.stats.collapse || S.stats.collapsed || 0 }; });
      if (v.modal !== 'collapse' || !/응급실/.test(v.t) || !/응급실비 150,000원/.test(v.t) || !/내일 오전/.test(v.t) || k.slot !== 3 || k.hp !== 0 || !k.sick || !k.hosp) forced.push('무리 끝에 쓰러졌는데 응급실 창(응급실비 · 잃는 칸)이나 판 상태(칸 · 체력 · 병원)가 다름: ' + JSON.stringify({ t: v.t.slice(0, 200), k }));
      if (!(k.cash < c0 + 400000 && k.cash > c0 - 150000)) forced.push('쓰러진 날의 돈(일당 − 응급실비)이 이상함: ' + c0 + ' → ' + k.cash);
      await closeAll(); await step(5); await G(() => { window.CONFIG.collapse_min.value = 0.25; });
      await click('[data-do="endday"]'); await step(20); if ((await st()).modal === 'confirm') { await key('Enter', 30); }
      v = await veil(); await step(120); await shot('89b_night_hospital');
      if (v.modal !== 'night' || !/병원/.test(v.t)) forced.push('쓰러진 날의 밤 정산에 "병원에서" 잔 것이 안 보임: ' + v.t.slice(0, 200));
      await key('Space', 40); await closeAll(); await step(5);
      const mo = await G(() => { const S = window.game.state.raw; return { slot: S.slot, hp: S.hp, sick: S.sick, toast: document.getElementById('toasts').textContent, sys: (document.querySelector('#quest .sysline, #quest .sys') || {}).textContent || '' }; });
      if (mo.slot !== 1 || !(mo.hp >= 30)) forced.push('쓰러진 다음 날 아침: 오전 칸을 잃고(칸 1부터) 병원에서 잔 만큼 체력이 돌아와야 함: ' + JSON.stringify(mo));
      await shot('89c_morning_after'); }
    // 일요일 밤: 임대수익 · 배당이 먼저 들어오고, 모자란 정산은 마이너스 통장에서 자동으로 빌려 내고(연체 아님), 신용점수 · 부동산 시세 한 줄
    await G(() => { const g = window.game, S = g.state.raw, R = window.Rules; S.credit = 640; S.cl = 0; S.cash = 9000000; S.hp = 60; S.sick = 0; R.buyProp(S, 'stall'); R.buyUnits(S, 'bank', 20); S.hold.bank.min = 20; S.cash = 300000; S.day = 14; S.slot = 3; S.missed = 0; S.arrears = 0; S.ev.length = 0; g.render(); });
    { const b = await G(() => { const x = window.Rules.bill(window.game.state.raw); return { net: x.net, rent: x.rent, div: x.div, week: x.week, inDays: x.inDays }; });
      await click('[data-do="endday"]'); await step(20); let v = await veil(); if (v.modal === 'confirm') { await shot('90_sleep_auto_borrow'); if (!/마이너스 통장/.test(v.t)) forced.push('정산이 모자란 밤의 확인 창에 마이너스 통장에서 빌려 낸다는 말이 없음: ' + v.t.slice(0, 200)); await key('Enter', 30); v = await veil(); }
      await step(120); await shot('90b_night_sunday');
      const n = await G(() => { const S = window.game.state.raw; return { cl: S.cl, missed: S.missed, credit: S.credit, cash: S.cash, re: S.re.hist.length }; });
      if (v.modal !== 'night' || !/임대수익/.test(v.t) || !/배당 \(튼튼은행\)/.test(v.t) || !/신용점수 640 → 655/.test(v.t) || !/부동산 시세/.test(v.t) || !/빌려 냈습니다/.test(v.t)) forced.push('일요일 밤 정산에 임대수익 · 배당 · 신용점수 · 부동산 시세 · 자동 대출 한 줄이 없음: ' + v.t.slice(0, 500));
      if (!(b.rent > 0 && b.div > 0 && b.inDays === 0) || !(n.cl > 0) || n.missed !== 0 || n.credit !== 655 || !(n.re >= 2)) forced.push('일요일 정산: 자동 대출(연체 아님) · 신용 +15 · 시세 기록이 다름: ' + JSON.stringify({ b, n }));
      await key('Space', 40); await closeAll(); }
  }
  // L. 2026-11-21 피드백으로 생긴 화면을 실제 버튼으로: 알바 넘기기(◀ ▶ · ← → · 숫자 키) · 새 알바 한 판(카페: Space 로 붓고 멈추기) · 세상 사건(예보 칩 → 닥친 아침의 창 → 못 하는 알바 · 뉴스 탭)
  //    · 종목 세 줄 칸에서 ETF 사기 · 코인 고르기(멍멍코인으로 열고 정리) · 은행의 신용 다섯 항목 → 신용 보고서
  {
    const veil = () => G(() => ({ modal: window.game.state.modal, t: (document.querySelector('#veil .win') || {}).textContent || '' }));
    const key = async (k, n) => { await G(k => window.game.press(k), k); await step(n || 20); };
    const names = () => G(() => ({ cards: [...document.querySelectorAll('#today .card .nm')].map(e => e.textContent), pager: (document.querySelector('#today .jpg b') || {}).textContent || '', left: !!(document.querySelector('#today [data-do="jpage"][data-arg="-1"]') || {}).disabled, right: !!(document.querySelector('#today [data-do="jpage"][data-arg="1"]') || {}).disabled }));
    await fresh();
    await G(() => { const g = window.game, S = g.state.raw; window.CONFIG.event_p.value = 0; window.CONFIG.world_p.value = 0; // 이 구획은 정해 둔 사건만 본다
      Object.assign(S, { tier: 4, lease: 'own', homeVal: 11000000, deposit: 0, addr: 1, credit: 640, cash: 30000000, hp: 100, day: 9, movedDay: 2, slot: 0, quest: 99, offer: null, picks: 0, event: null, xp: 0, inten: {} }); S.stats.maxTier = 4; S.market.world = []; S.market.news = [];
      Object.assign(g.meta.seen, { stock: 1, coin: 1, cafe: 1 }); g.render(); });
    await closeAll(); await step(10);
    // 1. 알바 넘기기: 내 집이면 알바가 여섯 — 처음에는 새로 열린 일부터 넷
    { let n = await names(); await shot('91_jobs_page');
      if (n.cards.join() !== '편의점,배달,카페,과외,쉬기,공부' || n.pager !== '일 3~6 / 6' || n.left || !n.right) forced.push('내 집의 오늘 칸: 새로 열린 일부터 넷(편의점 · 배달 · 카페 · 과외) + 쉬기 · 공부, 머리줄에 "일 3~6 / 6"이어야 함: ' + JSON.stringify(n));
      await click('#today [data-do="jpage"][data-arg="-1"]'); await step(5); n = await names(); await shot('91b_jobs_page_old');
      if (n.cards.join() !== '전단지,상하차,편의점,배달,쉬기,공부' || n.pager !== '일 1~4 / 6' || !n.left || n.right) forced.push('◀ 를 누르면 앞의 일 넷(전단지 · 상하차 · 편의점 · 배달)이 보여야 함: ' + JSON.stringify(n));
      await key('ArrowRight', 5); n = await names(); if (n.cards[3] !== '과외') forced.push('→ 키로 뒤의 일로 넘어가지 않음: ' + JSON.stringify(n));
      const cafe = await G(() => { const c = document.querySelector('#today .card[data-arg="cafe"]'); return { tag: (c.querySelector('.tag.mod') || {}).textContent || '', pay: c.querySelector('.pay').textContent, want: window.Rules.num(window.Rules.acts(window.game.state.raw).find(a => a.id === 'cafe').pay) }; });
      if (cafe.tag !== '+15%' || cafe.pay !== cafe.want) forced.push('오전의 카페 카드에 "+15%" 딱지와 그만큼 오른 일당이 없음: ' + JSON.stringify(cafe)); }
    // 2. 숫자 키 3 = 지금 보이는 셋째 카드(카페) → 시작 전 화면 → 진짜 한 판을 손으로(Space 로 붓고 멈추기)
    { await key('Digit3', 20); let v = await G(() => ({ modal: window.game.state.modal, pre: window.game.state.pre, title: (document.querySelector('.mg-head b') || {}).textContent || '', how: (document.querySelector('.mg-how') || {}).textContent || '' })); await step(120); await shot('92_cafe_pre');
      if (v.modal !== 'mg' || !v.pre || v.title !== '카페 음료' || !/Space 로 붓기 시작/.test(v.how)) forced.push('숫자 키 3 으로 셋째 카드(카페)의 시작 전 화면이 안 열림: ' + JSON.stringify(v));
      const c0 = await G(() => window.game.state.raw.cash);
      await key('Space', 4);
      const r = await G(() => { const g = window.game, hand = window.Minigames._hand('cafe', null, () => 0.5); let n = 0, shotAt = 0; for (let f = 0; f < 1500 && g.mg && !g.mg.done; f++) { const c = hand(g.mg._state, 1 / 60); if (c) { g.press(c); n++; } g.step(1); } return { done: !!(g.mg && g.mg.done), score: g.mg && g.mg.result ? g.mg.result.score : -1, detail: g.mg && g.mg.result ? g.mg.result.detail : '', presses: n }; });
      await G(() => window.game.step(80)); await shot('92b_cafe_result');
      const res = await G(() => ({ grade: (document.querySelector('.mg-res .g') || {}).textContent || '', d: (document.querySelector('.mg-res .d') || {}).textContent || '' }));
      await key('Space', 40); await closeAll();
      const k = await G(() => { const S = window.game.state.raw; return { cash: S.cash, slot: S.slot, n: S.jobs.cafe, closed: !!document.querySelector('#today .card.closed[data-arg], #today .card.closed') }; });
      if (!r.done || r.score < 0.999 || r.presses < 8 || res.grade !== '완벽' || !/딱 맞춘 선/.test(res.d) || !(k.cash > c0) || k.slot !== 1 || k.n !== 1 || !k.closed) forced.push('카페 한 판(Space 로 붓고 선에서 멈추기)을 흠 없이 했는데 완벽 · 일당 · 숙련 · 오늘 마감이 아님: ' + JSON.stringify({ r, res, k, c0 })); }
    // 3. 세상 사건: 내일 태풍 예보 칩 → 하루를 넘기면 아침에 창 한 장 → 야외 알바는 꺼지고 누르면 까닭 · 뉴스 탭에 한 줄
    { await G(() => { const g = window.game, S = g.state.raw; S.market.world = [{ id: 9801, type: 'typhoon', day: S.day + 1, days: 1, warn: true, truth: true, told: 1, pre: 1 }]; g.render(); }); await step(5);
      let h = await G(() => [...document.querySelectorAll('#today .zh .wchip')].map(e => e.textContent + '|' + e.title)); await shot('93_forecast_chip');
      if (h.length !== 1 || !/^내일태풍\|내일 예보: 태풍 \(열에 일곱 번쯤 맞음\) — 야외 알바 불가/.test(h[0])) forced.push('오늘 칸 머리줄에 "내일 태풍" 예보 칩(맞을 확률 · 무엇이 달라지는지)이 없음: ' + JSON.stringify(h));
      await click('#today .zh .wchip'); await step(5);
      const nw = await G(() => ({ tab: (document.querySelector('#board .tabs .on') || {}).textContent || '', lines: [...document.querySelectorAll('#board .wline')].map(e => e.textContent), season: (document.querySelector('#board .chip.season') || {}).textContent || '' })); await shot('93b_news_forecast');
      if (!/뉴스/.test(nw.tab) || nw.lines.length !== 1 || !/내일 예보.*태풍.*야외 알바 불가/.test(nw.lines[0]) || !/가을.*겨울까지 \d+일/.test(nw.season)) forced.push('예보 칩을 누르면 뉴스 탭이 열리고 "내일 예보 태풍" 한 줄 · 계절이 보여야 함: ' + JSON.stringify(nw));
      await G(() => { const g = window.game; g.run('rest'); g.step(30); g.run('rest'); g.step(30); }); await closeAll(); await click('[data-do="endday"]'); await step(20); if ((await st()).modal === 'confirm') await key('Enter', 30);
      await step(120); await key('Space', 40);
      let v = await veil(); await step(20); await shot('94_world_typhoon');
      if (v.modal !== 'world' || !/날씨 · 예보대로/.test(v.t) || !/태풍/.test(v.t) || !/야외 알바 불가/.test(v.t) || !/날개항공 −9%/.test(v.t) || !/아침 값에 이미 들어갔습니다/.test(v.t)) forced.push('태풍이 닥친 아침에 세상 사건 창(무엇이 달라지는지 · 시세)이 안 뜸: ' + JSON.stringify(v).slice(0, 400));
      await key('Space', 30); await closeAll(); await click('#board .tabs [data-arg="road"]'); await step(5);
      await click('#today [data-do="jpage"][data-arg="-1"]'); await step(5);
      const b = await G(() => { const f = document.querySelector('#today .card[data-arg="전단지"], #today .card.banned'), all = [...document.querySelectorAll('#today .card.banned')].map(c => c.querySelector('.nm').textContent + ':' + c.querySelector('.lack').textContent); if (f) f.click(); window.game.step(5); return { banned: all, toast: document.getElementById('toasts').textContent, chip: [...document.querySelectorAll('#today .zh .wchip')].map(e => e.textContent), flyer: window.Rules.acts(window.game.state.raw).find(a => a.id === 'flyer').banned }; }); await shot('94b_typhoon_cards');
      if (b.banned.join() !== '전단지:태풍,배달:태풍' || !b.flyer || !/태풍 — 오늘은 밖에서 일할 수 없습니다/.test(b.toast) || b.chip.join() !== '태풍') forced.push('태풍 날: 전단지 · 배달 카드가 꺼지고("태풍") 누르면 까닭이 뜨고, 머리줄에 "태풍" 칩이 있어야 함: ' + JSON.stringify(b));
      await G(() => { const S = window.game.state.raw; S.market.world = []; window.game.render(); }); }
    // 4. 주식: 내 집이면 종목이 열하나 — 세 줄 칸. 다담아ETF 를 눌러 한 주 산다
    { await click('#board .tabs [data-arg="stock"]'); await step(5);
      const m = await G(() => ({ c3: !!document.querySelector('#board .mlist.c3'), n: document.querySelectorAll('#board .mlist .arow').length, names: [...document.querySelectorAll('#board .mlist .arow .nm')].map(e => e.textContent) })); await shot('95_market_three');
      if (!m.c3 || m.n !== 11 || m.names.indexOf('다담아ETF') < 0 || m.names.indexOf('든든보험') < 0 || m.names.indexOf('훈훈에너지') >= 0) forced.push('내 집의 장 보기: 종목 열하나가 세 줄 칸으로(다담아ETF · 든든보험 있음 · 아파트의 훈훈에너지는 아직 없음): ' + JSON.stringify(m));
      await click('#board [data-do="sel"][data-arg="etf"]'); await step(5); const q = await G(() => ({ cash: window.game.state.raw.cash, cost: window.Rules.quote(window.game.state.raw, 'etf', 1).buy, tag: (document.querySelector('#board .thead .tg') || {}).textContent || '' }));
      await click('#board [data-do="buyq"]'); await step(10); await shot('95b_etf_bought');
      const a = await G(() => ({ units: window.game.state.raw.hold.etf.units, cash: window.game.state.raw.cash }));
      if (q.tag !== '지수' || a.units !== 1 || a.cash !== q.cash - q.cost) forced.push('다담아ETF 한 주를 샀는데 수량 · 나간 돈(버튼의 금액)이 다름: ' + JSON.stringify({ q, a })); }
    // 5. 코인: 내 집부터 둘 — 멍멍코인을 골라 롱을 열면 그 코인의 포지션, 정리하면 사라진다
    { await click('#board .tabs [data-arg="coin"]'); await step(10); await closeAll();
      let c = await G(() => ({ btns: [...document.querySelectorAll('#board .csel button')].map(b => b.textContent + (b.classList.contains('on') ? '*' : '')), px: (document.querySelector('#board .thead .p') || {}).textContent || '' }));
      if (c.btns.join() !== '달나라코인*,멍멍코인') forced.push('내 집의 코인 탭에 코인 고르기(달나라코인 · 멍멍코인)가 없음: ' + JSON.stringify(c));
      await click('#board .csel [data-arg="doge"]'); await step(5); c = await G(() => ({ on: (document.querySelector('#board .csel .on') || {}).textContent || '', px: (document.querySelector('#board .thead .p') || {}).textContent || '', want: Math.round(window.game.state.raw.market.px.doge).toLocaleString('en-US') + '원' })); await shot('96_coin_doge');
      if (c.on !== '멍멍코인' || c.px !== c.want) forced.push('멍멍코인을 골랐는데 그 코인의 값 · 차트가 아님: ' + JSON.stringify(c));
      await click('#board [data-do="long"]'); await step(30); await closeAll();
      const p = await G(() => { const S = window.game.state.raw; return { id: S.lev && S.lev.id, entry: S.lev && S.lev.entry === S.market.px.doge, other: !!(document.querySelector('#board .csel [data-arg="coin"]') || {}).disabled }; }); await shot('96b_doge_long');
      await click('#board [data-do="close"]'); await step(30); await closeAll();
      const z = await G(() => window.game.state.raw.lev);
      if (p.id !== 'doge' || !p.entry || !p.other || z) forced.push('멍멍코인 롱: 그 코인 값으로 열리고(다른 코인은 잠김) 정리하면 사라져야 함: ' + JSON.stringify({ p, z })); }
    // 6. 은행: 신용 칸에 다섯 항목 → "보고서" → 신용 보고서(다섯 항목 · 등급표 · 최근 변동 · 다음 등급)
    { await click('#board .tabs [data-arg="bank"]'); await step(5);
      const cv = await G(() => { const c = window.Rules.creditView(window.game.state.raw); return { score: c.score, grade: c.grade, name: c.name, toNext: c.toNext }; }); // 점수는 판에 따라(칭호가 오르면 +25) — 규칙에서 읽어 견준다
      const f = await G(() => ({ rows: [...document.querySelectorAll('#board .bl.fac')].map(e => e.textContent), grade: (document.querySelector('#board .grade') || {}).textContent || '' })); await shot('97_bank_factors');
      if (f.rows.length !== 5 || !/^상환 이력/.test(f.rows[0]) || !/계약과 소비/.test(f.rows[4]) || f.grade !== cv.grade + '등급 · ' + cv.name + cv.score + '점' || cv.grade !== 4) forced.push('은행 탭의 신용 칸에 등급 이름 · 다섯 항목이 없음: ' + JSON.stringify({ f, cv }));
      await click('#board [data-do="credit"]'); await step(20); const v = await veil(); await shot('97b_credit_report');
      for (const k of ['신용 보고서', '4등급 · 보통', cv.score + '점', '3등급(' + cv.toNext + '점 더)이 되면', '상환 이력', '부채 수준', '거래 기간', '소득과 자산', '계약과 소비', '등급표', '최우량', '대출 불가', '최근 변동']) if (v.modal !== 'credit' || v.t.indexOf(k) < 0) { forced.push('신용 보고서 창에 "' + k + '"가 없음: ' + v.t.slice(0, 200)); break; }
      const me = await G(() => { const r = document.querySelector('#veil .ctb .tr.me'), c = window.Rules.creditView(window.game.state.raw); return { row: r ? r.textContent : '', limit: window.Rules.num(c.limit), rows: document.querySelectorAll('#veil .ctb .tr').length, facs: document.querySelectorAll('#veil .cf').length }; });
      if (me.rows !== 7 || me.facs !== 5 || me.row.indexOf('4 보통') !== 0 || me.row.indexOf(me.limit) < 0) forced.push('신용 보고서의 등급표: 일곱 줄 · 내 등급 줄(통장 한도 = 지금 한도)이 강조되어야 함: ' + JSON.stringify(me));
      await key('Space', 20); if ((await st()).modal) forced.push('신용 보고서가 Space 로 안 닫힘'); }
    await G(() => { window.CONFIG.event_p.value = 0.5; window.CONFIG.world_p.value = 0.2; });
  }
  await page.goto('file://' + path.resolve(dir, 'index.html') + '?manual=1&scene=figures'); await page.screenshot({ path: path.join(out, 'figures.png') });
  const zones = await G(() => document.querySelectorAll('[data-zone]').length);
  forced.unshift(...forcedMain);
  console.log(JSON.stringify({ seed, style, loops: guard, end: end.ended, shots: shots.length, perks, events: evts, dens, fxAfterQuest: fxSeen, errors: errs.slice(0, 8), roll: rollBad, forced, lint, log }, null, 1));
  if (errs.length || Object.keys(lint).length || rollBad.length || forced.length || !fxSeen || !evts || !perks) process.exitCode = 1; // 오류 · 넘침이 있거나, 폭죽 · 사건 · 특성 창을 한 번도 못 봤으면 실패
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
