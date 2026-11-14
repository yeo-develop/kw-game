// PROTOTYPE - NOT FOR PRODUCTION
// 게임이 불러오지 않는 개발용 도구. 화면 없는 브라우저(Playwright)는 KW_PLAYWRIGHT 환경 변수로 위치를 줄 수 있다.
// 한 판을 화면으로 내 집(1막 끝)까지 몰아 보는 점검 (게임 폴더 밖). 창 없이 돌고, 화면 몇 장을 찍고, 글자 넘침 · 겹침 · 작은 글자 · 콘솔 오류를 모은다.
// 그 뒤 단계(아파트 · 대출 · 미리 갚기 기준 · 사업 · 공부 종목 · 밤사이 갭 · 압류 · 호텔 선언 · 엔딩 · 가장 긴 숫자 · 로드맵 열 단계 · 사는 곳 그림 다섯)는 판 상태를 만들어 넣어 같은 점검을 한다.
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
    const el = n.parentElement; if (el.closest('.hide') || el.closest('#fx') || el.closest('#toasts') || el.closest('.stamp')) continue;
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
    const box = el.closest('.arow,.opt,.sbtn,#hud,#me,#quest,#today,#board,.win,.e-box,.t-box'); // 종목 줄 · 고를 것 · 종목 단추 안에서 넘친 글도
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
  const G = (fn, arg) => page.evaluate(fn, arg);
  const step = n => G(n => { const g = window.game; g.step(n); const left = g.state.guard || 0; if (left) g.step(left + 1); }, n); // 누름이 막힌 동안(창이 막 뜬 직후)은 마저 기다린다
  const st = () => G(() => { const s = window.game.state; return { scene: window.game.scene, day: s.day, slot: s.slot, cash: s.cash, worth: s.worth, hp: s.hp, tier: s.tier, quest: s.quest, modal: s.modal, ended: s.ended, act1: s.act1, price: s.housePrice }; });
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
  let guard = 0, mgShot = 0, fxSeen = 0, perks = 0, evts = 0, dens = 0;
  const rollBad = [], forcedMain = [];
  let lastKey = '', stuck = 0;
  const hudCheck = async tag => { // 숫자 굴림이 끝난 뒤 위쪽 띠의 현금 · 순자산 = 판 상태
    await step(45);
    const r = await G(() => { const R = window.Rules, S = window.game.state.raw; return { cash: document.getElementById('cash').textContent, want: R.won(S.cash), worth: document.getElementById('worth').textContent, wantW: R.won(R.worth(S)) }; });
    if (r.cash !== r.want || r.worth !== r.wantW) rollBad.push(tag + ': 위쪽 띠 ' + r.cash + ' / ' + r.worth + ' ≠ 판 ' + r.want + ' / ' + r.wantW);
  };
  const M = 10000;
  while (guard++ < 4000) {
    const s = await st();
    if (s.scene !== 'play' || (s.act1 && !s.modal)) break; // 내 집(1막 끝)까지 몰고, 1막 끝 창 · 그 뒤 창을 닫으면 끝
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
    if (s.modal === 'study') { await shot('pop_study'); await G(() => window.game.press('Digit2')); await step(20); continue; } // 공부: 종목 고르기 (화끈식품)
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
    if (s.tier === 2 && !seen.has('06_gosiwon')) { await shot('06_gosiwon'); await G(() => window.game.run('roadmap')); await step(20); await shot('06b_roadmap_modal'); await G(() => window.game.press('Space')); await step(20); await hudCheck('고시원'); continue; } // 투자가 열리면 로드맵은 '나' 구역 머리의 버튼으로 여는 창
    // 주거 올리기: 다음 단계에 들어갈 수 있으면(순자산 기준 · 밀린 돈을 낼 현금) — 퀘스트 버튼이 있으면 그것을, 없으면 로드맵 창을 연다
    const mv = await G(() => { const R = window.Rules, S = window.game.state.raw, t = S.tier + 1; return t <= 3 && R.moveInfo(S, t).ok ? t : 0; });
    if (mv && style !== 'stay' && (mv < 2 || s.cash >= 5 * M)) {
      const inQuest = await G(t => !!document.querySelector('#quest [data-do="move"][data-arg="' + t + '"]'), mv);
      if (inQuest) await page.click('#quest [data-do="move"]');
      else if (mv === 1) await page.click('#board [data-do="move"]');
      else { await G(() => window.game.run('roadmap')); await step(20); await shot('07_roadmap_move' + mv); await page.click('#veil [data-do="move"]'); }
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
        await page.click('#hud [data-do="house"]'); await step(20); await shot('21_buy_home');
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
      if (s.tier === 2) { await G(() => window.game.run('tab', 'stock')); await shot('08_stock'); const held = await G(() => window.Rules.holdings(window.game.state.raw).total.cost > 0); if (held) { await shot('08b_stock_holding'); await hudCheck('주식을 든 날'); } }
      if (s.tier === 3) { await G(() => window.game.run('tab', 'coin')); await shot('09_coin'); const lev = await G(() => !!window.game.state.raw.lev); if (lev) { await shot('10_coin_position'); await G(() => window.game.run('tab', 'stock')); await shot('10b_stock_with_coin'); } }
    }
    if (s.slot >= 3) {
      // 고정비 날이면 현금 마련
      await G(M => { const R = window.Rules, S = window.game.state.raw, g = window.game, b = R.bill(S); if (b && b.inDays === 0 && S.cash < b.amt + 3 * M) { for (const a of ['daejang', 'buldak', 'hantang']) if (S.hold[a].units > 0) { g.run('tab', 'stock'); g.run('sel', a); g.run('sell', '1'); } if (S.cash < b.amt + 3 * M && S.lev) { g.run('tab', 'coin'); g.run('close'); } } }, M);
      if ((await st()).modal) continue;
      await shot('11_day_done');
      await page.click('[data-do="endday"]'); await step(20);
      if ((await st()).modal === 'confirm') { await shot('13_sleep_confirm'); await page.click('#veil [data-do="ok"]'); await step(20); }
      await shot('12_night_day' + (s.day <= 1 ? 1 : s.day % 7 === 0 ? 'bill' : 'n'));
      { const t = await G(() => { const R = window.Rules, n = window.game.state.raw.last, a = document.getElementById('nightin'), b = document.getElementById('nightout'); return a && b ? [a.textContent, '+' + R.won(n.labor), b.textContent, (n.spent ? '−' : '') + R.won(n.spent)] /* 쓴 돈이 없으면 "−0원"이 아니라 "0원" */ : null; }); if (!t || t[0] !== t[1] || t[2] !== t[3]) rollBad.push(s.day + '일 밤 정산 합계가 굴림 뒤 값과 다름: ' + JSON.stringify(t)); }
      await G(() => window.game.press('Space')); await step(20);
      continue;
    }
    // 칸 행동: 공부형은 자산이 크면 저녁에 공부, 아니면 가장 돈 되는 알바, 안 되면 쉬기
    const pick = await G(({ style, M }) => { const R = window.Rules, S = window.game.state.raw; const acts = R.acts(S); if (style === 'study' && S.slot === 2 && R.worth(S) > 500 * M && acts.find(a => a.kind === 'study' && a.ok)) return ['study', '']; const j = acts.filter(a => a.kind === 'job' && a.ok).sort((a, b) => b.pay - a.pay)[0]; return j ? [(S.day <= 2 || S.day % 5 === 0) ? 'job' : 'skip', j.id] : ['rest', '']; }, { style, M });
    if (process.env.DBG) console.log('pick', JSON.stringify(pick), JSON.stringify(await st()), await G(() => document.getElementById('veil').className + '|' + document.getElementById('veil').innerHTML.slice(0, 120)));
    if (pick[0] === 'job') await page.click('[data-do="job"][data-arg="' + pick[1] + '"]', { position: { x: 20, y: 60 }, timeout: 3000 });
    else if (pick[0] === 'skip') await page.click('[data-do="skip"][data-arg="' + pick[1] + '"]');
    else await page.click('[data-do="' + pick[0] + '"]');
    await step(20);
  }
  const end = await st();
  await step(20);
  if (!end.act1) forcedMain.push('화면으로 몰아서 내 집(1막 끝)까지 가지 못함: ' + JSON.stringify(end));
  await shot('30_after_act1');
  // ── 일부러 만든 화면: 판이 우연히 안 지나간 곳도 한 번씩 (같은 넘침 · 작은 글자 점검) ──
  const forced = [];
  const fresh = async () => { await page.goto('file://' + path.resolve(dir, 'index.html') + '?manual=1&scene=play&seed=' + seed); await step(60); await G(() => window.game.press('Space')); await step(40); };
  await fresh();
  await G(() => { const S = window.game.state.raw; S.day = 2; S.cash = 40000; S.quest = 2; window.game.render(); }); await step(10); await shot('40_roadmap_board_next'); // 찜질방 옮기기 버튼이 켜진 로드맵 판
  if (!(await G(() => !!document.querySelector('#board .rung.next [data-do="move"]') && !!document.querySelector('#quest [data-do="move"]')))) forced.push('로드맵 판 · 상태창에 찜질방 옮기기 버튼이 없음');
  if (await G(() => !!document.querySelector('#hud .wk'))) forced.push('고정비가 없는데(고시원 전) 위쪽 띠에 일곱 칸 띠가 보임 — "7일 기한"으로 읽힘');
  { const r = await G(() => ({ n: document.querySelectorAll('#board .rung').length, far: document.querySelectorAll('#board .rung.far').length, names: [...document.querySelectorAll('#board .rung .nm')].map(e => e.textContent), vals: document.querySelector('#board .ladder').textContent }));
    if (r.n !== 10 || r.names[9] !== '한국 최고 부자' || r.far < 7) forced.push('로드맵 판이 열 단계(먼 단계는 흐리게)가 아님: ' + JSON.stringify(r).slice(0, 200));
    for (const v of ['15,000,000', '80,000,000', '10,000,000,000', '35,000,000,000', '가게', '재벌']) if (r.vals.indexOf(v) < 0) forced.push('로드맵 판에 ' + v + '이(가) 안 보임'); }
  if (await G(() => /보증금/.test(document.getElementById('s-play').textContent))) forced.push('화면에 "보증금"이 남아 있음');
  await G(() => { const S = window.game.state.raw; S.tier = 1; S.quest = 3; S.cash = 120000; S.day = 6; window.game.render(); }); await step(10); await shot('41_roadmap_board_short'); // 고시원 기준에 못 미침: 이유 · 막대
  if (!(await G(() => { const b = document.querySelector('#quest [data-do="why"]'); return !!b && /모자랍니다/.test(b.dataset.arg); }))) forced.push('상태창의 옮기기 버튼이 못 할 때 이유(moveInfo.why)를 안 줌');
  if (!(await G(() => { const e = document.querySelector('#board .rung.next'); return /가져가지 않음/.test(e.textContent + [...e.querySelectorAll('[title]')].map(q => q.title).join()); }))) forced.push('로드맵 고시원 칸에 "가져가지 않음"이 없음 (글 또는 설명)');
  await G(() => window.game.run('roadmap')); await step(20);
  if (!(await G(() => /가져가지 않음/.test(document.querySelector('#veil .rung.next').textContent)))) forced.push('로드맵 창의 고시원 칸에 "가져가지 않음"이 글로 안 보임');
  await G(() => window.game.press('Space')); await step(20);
  await G(() => { const S = window.game.state.raw; S.cash = window.CONFIG.gosiwon_need.value + 20000; window.game.render(); }); await step(10); await shot('41b_roadmap_board_gosiwon_ok'); // 고시원 기준을 넘음: 카드 안의 "옮기기"가 잘리지 않아야 (lint 의 잘림(rung))
  { const r = await G(() => { const n = document.querySelector('#board .rung.next'), b = n && n.querySelector('[data-do="move"]'); if (!b) return { btn: false }; const q = b.getBoundingClientRect(), k = n.getBoundingClientRect(); return { btn: true, inside: q.bottom <= k.bottom + 1 && q.top >= k.top - 1 }; });
    if (!r.btn || !r.inside) forced.push('고시원 기준을 넘었는데 로드맵 카드의 "옮기기"가 없거나 카드 밖으로 잘림: ' + JSON.stringify(r)); }
  // 긴 숫자 · 주간 띠 · 알림 줄(일요일: 오늘 밤 고정비) · 보유 줄 + 합계 + 코인 · 남은 날 대신 N일째
  await G(() => { const g = window.game, S = g.state.raw; S.tier = 3; S.quest = 11; S.day = 21; S.movedDay = 15; S.cash = 37980000; S.combo = 10; S.arrears = 8000000; S.hold.hantang = { units: 1000, cost: 11000000 }; S.hold.daejang = { units: 20, cost: 1000000 }; S.offer = null; S.picks = 0; g.render(); g.run('tab', 'coin'); g.run('lev', '5'); g.run('share', '0.25'); g.run('long'); g.step(40); g.run('tab', 'stock'); });
  await step(60); await shot('42_long_numbers_stock'); await hudCheck('긴 숫자');
  const f42 = await G(() => ({ notes: [...document.querySelectorAll('#quest .note')].map(e => e.className + ':' + e.textContent), wk: document.querySelectorAll('#hud .wk > i, #hud .wk > .bill').length, wkl: (document.querySelector('#hud .wk .wkl') || {}).textContent || '', bill: !!document.querySelector('#hud .wk .bill.now'), rows: [...document.querySelectorAll('#board .arow .mine')].map(e => e.textContent), sum: (document.querySelector('#board .hsum') || {}).textContent || '', lv: !!document.querySelector('#board .hsum .lv'), house: !!document.querySelector('#hud [data-do="house"]'), can: window.Rules.homeInfo(window.game.state.raw, 4).ok, hud: document.getElementById('hud').textContent, buys: [...document.querySelectorAll('#board [data-do="buy"]')].map(e => e.dataset.arg + ':' + e.textContent), want: [0.25, 0.5, 1].map(f => f + ':' + Math.round(f * 100) + '%' + window.Rules.num(Math.floor(window.game.state.raw.cash * f))) }));
  if (f42.wk !== 7 || !f42.bill || f42.wkl !== '고정비') forced.push('주간 띠가 일곱 칸이 아니거나 일요일 고정비 칸이 오늘로 안 보이거나 끝에 "고정비" 글이 없음: ' + JSON.stringify(f42));
  if (!f42.notes.some(n => /today/.test(n) && /오늘 밤 고정비/.test(n)) || f42.notes.some(n => /집값/.test(n))) forced.push('일요일 알림 줄이 다름: ' + f42.notes.join(' | '));
  if (f42.rows.length !== 3 || !/없음/.test(f42.rows[1]) || !/%/.test(f42.rows[2]) || !f42.lv || !/보유/.test(f42.sum)) forced.push('보유 줄 · 합계가 다름: ' + JSON.stringify(f42));
  { const c = await G(() => [...document.querySelectorAll('#board .arow .chg')].map(e => e.textContent)); // 두 % 에 이름표: "내 손익" · "오늘"
    if (!/^내 손익 [+−][0-9.]+%$/.test(f42.rows[2]) || c.some(t => t && !/^오늘 [+−]/.test(t))) forced.push('종목 줄의 % 둘에 이름표("내 손익" · "오늘")가 없음: ' + JSON.stringify({ rows: f42.rows, chg: c })); }
  if (f42.house !== f42.can) forced.push('위쪽 띠의 내 집 사기 버튼이 살 수 있는지(homeInfo.ok)와 다름: ' + JSON.stringify({ house: f42.house, can: f42.can }));
  if (!/21일째/.test(f42.hud) || /남은/.test(f42.hud)) forced.push('위쪽 띠에 "N일째"가 없거나 "남은"이 남아 있음: ' + f42.hud);
  if (f42.buys.join('|') !== f42.want.join('|')) forced.push('주식 사는 버튼이 현금의 25 · 50 · 100%(실제 금액)가 아님: ' + f42.buys.join(' | ') + ' ≠ ' + f42.want.join(' | '));
  await G(() => { const S = window.game.state.raw; S.day = 20; window.game.render(); }); await step(10);
  if (!(await G(() => [...document.querySelectorAll('#quest .note')].some(e => /tomorrow/.test(e.className) && /내일 밤 고정비/.test(e.textContent))))) forced.push('토요일에 "내일 밤 고정비" 알림이 없음');
  await G(() => { const S = window.game.state.raw; S.day = 17; window.game.render(); }); await step(10);
  if (await G(() => document.querySelectorAll('#quest .note').length)) forced.push('고정비 이틀 전인데 알림이 뜸');
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
  // A. 아파트: 내 집에 살며 현금 20,000,000 · 가게 → 사는 창에 대출 셋(최대 · 절반 · 없이), 고른 것마다 일요일 밤마다 나갈 돈 · 압류 경고 · 살던 집 판 돈
  await G(() => { const g = window.game, S = g.state.raw, R = window.Rules; S.tier = 4; S.homeVal = R.homePrice(S, 4); S.act1 = { day: 22, rank: 'A', worth: 16000000, price: S.homeVal }; S.stats.maxTier = 4; S.biz = 1; S.cash = 20000000; S.day = 30; S.movedDay = 23; S.quest = 13; S.offer = null; S.picks = 0; S.event = null; S.xp = 0; g.render(); });
  await step(20); await closeAll(); await shot('49_home_play');
  await G(() => window.game.run('house')); await step(20); await shot('50_buy_apt');
  { const r = await G(() => { const w = document.querySelector('#veil .win').getBoundingClientRect(), s = document.getElementById('stage').getBoundingClientRect(); return { top: w.top - s.top, bottom: s.bottom - w.bottom }; }); if (r.top < 8 || r.bottom < 8) forced.push('아파트 사는 창이 화면보다 높아 위 · 아래가 잘림: ' + JSON.stringify(r)); }
  { const b = await G(() => { const R = window.Rules, S = window.game.state.raw, i = R.homeInfo(S, 5); return { modal: window.game.state.modal, opts: [...document.querySelectorAll('#veil .opt')].map(e => e.textContent), t: document.querySelector('#veil .win').textContent, down: R.won(i.down), sell: R.won(i.sell), weekly: R.won(i.fixed + i.weekly), loan: i.loanMax }; });
    if (b.modal !== 'buy' || b.opts.length !== 3) forced.push('아파트 사는 창에 대출 고르기 셋이 없음: ' + JSON.stringify(b).slice(0, 200));
    else {
      if (!/^1최대로 빌림/.test(b.opts[0]) || b.opts[0].indexOf('현금 ' + b.down + '만 있으면 됨') < 0 || b.opts[0].indexOf('일요일 밤마다') < 0 || b.opts[0].indexOf(b.weekly) < 0) forced.push('"최대로 빌림"에 필요한 현금 · 일요일 밤마다 나갈 돈(고정비 + 원리금)이 없음: ' + b.opts[0]);
      if (!/절반/.test(b.opts[1]) || !/대출 없이/.test(b.opts[2]) || !/모자랍니다/.test(b.opts[2])) forced.push('"절반" · "대출 없이"(현금 모자람)가 다름: ' + b.opts.slice(1).join(' | '));
      if (!/두 번 연속 못 내면 압류되어 한 단계 아래로/.test(b.t) || b.t.indexOf(b.sell) < 0) forced.push('사는 창에 압류 경고 · 살던 집이 팔려 보태지는 돈이 없음');
      if (!/첫 일요일은 산 날만큼\(\d일치\)만: 고른 것이면 [0-9,]+원/.test(b.t) || !/한 주 \d+(\.\d)?% 이자/.test(b.t) || !/하루 약 [0-9,]+원/.test(b.t)) forced.push('사는 창에 "첫 일요일은 산 날만큼(N일치)" · 이자율 · 견줄 벌이가 없음: ' + b.t.slice(0, 240));
    }
    await G(() => window.game.press('Digit3')); await step(4); await G(() => window.game.press('Enter')); await step(20);
    if ((await st()).modal !== 'buy' || (await st()).tier !== 4) forced.push('현금이 모자란 "대출 없이"를 고르고 Enter 를 눌렀는데 창이 닫히거나 사짐');
    await G(() => window.game.press('Digit1')); await step(4); await G(() => window.game.press('Enter')); await step(20);
    const after = await G(() => { const S = window.game.state.raw; return { tier: S.tier, loan: S.loan && S.loan.balance, modal: window.game.state.modal }; });
    if (after.tier !== 5 || after.loan !== b.loan) forced.push('"최대로 빌림"으로 샀는데 아파트 · 대출이 다름: ' + JSON.stringify(after));
    if (after.modal) await shot('51_tier_apt');
    await closeAll(); }
  // B. 대출 줄 · 미리 갚기 (25%)
  await step(10); await shot('52_loan_row');
  { const r = await G(() => { const R = window.Rules, S = window.game.state.raw, l = R.loanView(S), e = document.querySelector('#me .me-row.loan'); return { row: e ? e.textContent : '', bal: R.num(l.balance), due: R.num(R.bill(S).loan), left: l.left + '회', btn: !!document.querySelector('#me [data-do="repay"]'), biz: (document.querySelector('#me .me-row.biz') || {}).textContent || '' }; });
    const days = await G(() => window.Rules.bill(window.game.state.raw).days);
    if (r.row.indexOf(r.bal) < 0 || r.row.indexOf(r.due) < 0 || (days < 7 ? r.row.indexOf('이번 ' + r.due + ' (' + days + '일치)') < 0 : r.row.indexOf(r.left) < 0) || !r.btn) forced.push('대출 줄에 잔액 · 이번 일요일 원리금(이사한 주면 "이번 N (M일치)", 아니면 남은 회) · 미리 갚기가 없음: ' + JSON.stringify(r));
    if (!/가게/.test(r.biz) || !/×5/.test(r.biz) || !/법인/.test(r.biz)) forced.push('사업 줄에 지금 사업 · 배수 · 다음 단계가 없음: ' + r.biz); }
  await page.click('#me [data-do="repay"]'); await step(20); await shot('53_repay');
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
  await G(() => { const S = window.game.state.raw; S.cash = 20000000; S.slot = 0; S.hp = 100; window.game.render(); }); await step(10);
  await page.click('#me [data-do="bizup"]'); await step(20); await shot('54_bizup_confirm');
  if ((await st()).modal !== 'confirm' || !(await G(() => /법인/.test(document.querySelector('#veil h3').textContent) && /자산으로 남지 않음/.test(document.querySelector('#veil .win').textContent)))) forced.push('사업 키우기 확인 창이 다름');
  await G(() => window.game.press('Enter')); await step(20);
  if ((await st()).modal === 'biz') await shot('55_biz_pop'); else forced.push('사업을 키웠는데 사업 확장 창이 안 뜸: ' + (await st()).modal);
  await closeAll();
  await step(10); await shot('56_auto_cards');
  { const c = await G(() => { const R = window.Rules, S = window.game.state.raw, a = R.acts(S); return { biz: S.biz, pay: R.num(a.find(x => x.id === 'flyer').pay), base: R.num(Math.round(90000 * Math.pow(5, 2) / 1000) * 1000), card: document.querySelector('#today [data-arg="flyer"] .pay').textContent, rest: (document.querySelector('#today [data-do="rest"] .auto') || {}).textContent || '', study: (document.querySelector('#today [data-do="study"] .auto') || {}).textContent || '', auto: R.num(a.find(x => x.kind === 'rest').auto) }; });
    if (c.biz !== 2 || c.card !== c.pay || c.pay !== c.base) forced.push('법인 뒤 전단지 카드 일당이 ×25 가 아님: ' + JSON.stringify(c));
    if (!/쉬어도/.test(c.rest) || c.rest.indexOf(c.auto) < 0 || c.study.indexOf(c.auto) < 0) forced.push('쉬기 · 공부 카드에 "쉬어도 +자동 수입"이 없음: ' + JSON.stringify(c)); }
  // 자동 수입: 쉬면 사업 매출이 들어오고 떠오른다
  { const c0 = await G(() => window.game.state.raw.cash); await G(() => window.game.run('rest')); await G(() => window.game.step(2)); const f = await G(() => [...document.querySelectorAll('#fx .fly')].map(e => e.textContent));
    const c1 = await G(() => window.game.state.raw.cash); if (c1 <= c0 || !f.some(t => /매출 \+/.test(t))) forced.push('쉬었는데 사업 매출이 안 들어오거나 안 떠오름: ' + JSON.stringify({ c0, c1, f })); }
  await step(40); await closeAll();
  // D. 공부: 종목 고르기 → 고른 종목만 리포트 칸에
  await G(() => { const S = window.game.state.raw; S.slot = 1; S.hp = 100; window.game.render(); }); await step(10);
  await page.click('#today [data-do="study"]'); await step(20); await shot('57_study_pick');
  { const p = await G(() => ({ modal: window.game.state.modal, n: document.querySelectorAll('#veil .sbtn').length, t: document.querySelector('#veil .win').textContent }));
    if (p.modal !== 'study' || p.n !== 4 || !/체력 8/.test(p.t)) forced.push('공부 종목 고르기 창이 다름: ' + JSON.stringify(p).slice(0, 160));
    await G(() => window.game.press('Digit2')); await step(20); await closeAll();
    const r = await G(() => ({ assets: (window.Rules.intelView(window.game.state.raw) || {}).assets, right: document.querySelectorAll('.newsbox > div')[1].textContent }));
    if (!r.assets || r.assets.join() !== 'buldak' || !/화끈식품/.test(r.right) || /대장전자|달나라/.test(r.right)) forced.push('공부한 종목만 리포트 칸에 보여야 함: ' + JSON.stringify(r));
    if (!(await G(() => /아침 값에 이미 들어감/.test(document.querySelector('.newsbox h4').textContent)))) forced.push('소식 칸에 "아침 값에 이미 들어감"이 없음'); }
  // D2. 리포트 채점: 어제 리포트가 붙은 오늘 소식 → 소식 옆 딱지가 글로 "리포트" → 그 소식의 하루가 끝난 밤 정산에 "리포트 맞음 / 틀림" 한 줄
  await G(() => { const g = window.game, S = g.state.raw; S.slot = 0; S.hp = 100; S.event = null; S.offer = null; S.picks = 0; S.market.news = S.market.news.filter(n => !(n.day === S.day && n.asset === 'buldak')); S.market.news.push({ id: 9801, day: S.day, asset: 'buldak', dir: 1, src: 'article', truth: false, mag: 0.05, head: '화끈식품 신제품 품절 대란', pre: 0 }); S.market.brief = { day: S.day, madeOn: S.day - 1, ht: null, items: [{ nid: 9801, asset: 'buldak', dir: 1, by: 'study' }] }; g.run('tab', 'stock'); g.render(); });
  await step(10); await shot('57b_news_report_tag');
  if (!(await G(() => [...document.querySelectorAll('#board .nitem .rep')].some(e => /^리포트/.test(e.textContent))))) forced.push('어제 리포트가 붙은 소식 옆 딱지가 글("리포트")로 안 읽힘');
  await G(() => { const g = window.game, S = g.state.raw; S.slot = 3; S.cash = Math.max(S.cash, 90000000); g.render(); g.run('endday'); }); await step(30);
  if ((await st()).modal === 'confirm') { await G(() => window.game.press('Enter')); await step(30); }
  { const n = await G(() => ({ modal: window.game.state.modal, reps: (document.querySelector('#veil .n-reps') || {}).textContent || '' }));
    if (n.modal !== 'night' || !/리포트 틀림 — 화끈식품, 리포트는 오르는 쪽 · 실제 소식은 내리는 쪽/.test(n.reps)) forced.push('소식의 하루가 끝난 밤 정산에 "리포트 맞음/틀림" 한 줄이 없거나 다름: ' + JSON.stringify(n));
    await shot('57c_night_report'); }
  await G(() => window.game.press('Space')); await step(30); await closeAll();
  // D3. 한탕바이오 거래량 알림: 그날 한탕바이오 줄에 "거래량" 표시 + 눈에 띄는 알림, 그 전에 읽은 "조용합니다" 리포트는 낡았다고
  await G(() => { const g = window.game, S = g.state.raw; S.slot = 0; S.hp = 100; S.market.ht = { phase: 'quiet', left: 1 }; S.market.intel = { day: S.day + 1, madeOn: S.day, assets: ['hantang'], items: [], ht: { state: 'quiet', lean: 0 } }; g.run('tab', 'stock'); g.render(); g.run('rest'); });
  await step(10); await closeAll(); await G(() => window.game.step(3));
  { const h = await G(() => ({ vol: !!document.querySelector('#board .arow .vol'), toast: document.getElementById('toasts').textContent, right: document.querySelectorAll('.newsbox > div')[1].textContent }));
    if (!h.vol || !/거래량 급증/.test(h.toast) || !/리포트 뒤에 거래량이 늘었습니다/.test(h.right) || /조용합니다/.test(h.right)) forced.push('한탕바이오 거래량 알림이 줄 표시 · 알림 · 낡은 리포트 고침으로 안 보임: ' + JSON.stringify(h));
    await page.waitForTimeout(300); await page.screenshot({ path: path.join(out, '57d_hantang_alert.png') }); shots.push('57d_hantang_alert'); const l = await G(LINT); if (l.length) lint['57d_hantang_alert'] = l; }
  // E. 밤사이 갭: 화끈식품을 들고 자고 일어났는데 오늘 소식(공시 호재)이 장 전에 값에 들어감 → 아침 알림
  await G(() => { const g = window.game, S = g.state.raw; S.slot = 3; S.hold.buldak = { units: 1000, cost: S.market.px.buldak * 1000 }; S.market.news = S.market.news.filter(n => n.day !== S.day + 1); S.market.news.push({ id: 9901, day: S.day + 1, asset: 'buldak', dir: 1, src: 'official', truth: true, mag: 0.1, head: '화끈식품, 해외 수출 계약 체결', pre: 0.07 }); S.cash = 90000000; g.render(); g.run('endday'); });
  await step(30);
  if ((await st()).modal === 'night') { await G(() => window.game.press('Space')); await G(() => window.game.step(3)); }
  await closeAll(); await G(() => window.game.step(3)); // 아침 창(사건 · 퀘스트)이 있으면 그 뒤에 알림이 뜬다
  if (!(await G(() => [...document.querySelectorAll('#board .nitem .gp')].some(e => /밤사이 \+7%/.test(e.textContent))))) forced.push('소식 칸에 그날 내내 남는 "밤사이 +N%"가 없음');
  { const t = await G(() => [...document.querySelectorAll('#toasts .toast.gap')].map(e => e.className + ':' + e.textContent).join(' | '));
    if (!/밤사이/.test(t) || !/화끈식품 \+7\.3%/.test(t) || !/내 손익 \+/.test(t) || !/gap up/.test(t)) forced.push('아침에 밤사이 갭 알림(종목 · 비율 · 내 손익)이 눈에 띄게 안 뜸: ' + t); }
  await page.waitForTimeout(300); await page.screenshot({ path: path.join(out, '58_gap.png') }); shots.push('58_gap');
  await closeAll();
  // F. 압류: 아파트에서 지난주에 한 번 밀린 채 일요일 밤 현금이 없음 → 확인 창 → 정산 → 압류 창(숫자)
  await G(() => { const g = window.game, S = g.state.raw, R = window.Rules; S.tier = 5; S.homeVal = R.homePrice(S, 5); S.loan = { balance: 60000000, orig: 64000000, day: 20 }; S.cash = 0; S.missed = 1; S.arrears = 13000000; S.day = 35; S.movedDay = 20; S.slot = 3; for (const a of ['daejang', 'buldak', 'hantang']) S.hold[a] = { units: 0, cost: 0 }; S.lev = null; S.offer = null; S.picks = 0; S.event = null; g.render(); });
  await step(10); await G(() => window.game.run('endday')); await step(20); await shot('59_sleep_confirm');
  if (!(await G(() => window.game.state.modal === 'confirm' && /압류/.test(document.querySelector('#veil .win').textContent) && /두 번째/.test(document.querySelector('#veil .win').textContent)))) forced.push('두 번째로 원리금을 못 내는 밤의 확인 창에 압류 경고가 없음');
  await G(() => window.game.press('Enter')); await step(30); await shot('59b_night_foreclose'); await G(() => window.game.press('Space')); await step(30);
  { const f = await G(() => ({ modal: window.game.state.modal, tier: window.game.state.tier, t: (document.querySelector('#veil .win') || {}).textContent || '', sold: window.Rules.won(Math.round(window.Rules.homePrice(window.game.state.raw, 5) * 0.95 / 1000) * 1000) }));
    if (f.modal !== 'foreclose' || f.tier !== 4 || f.t.indexOf(f.sold) < 0 || !/갚은 대출 · 빚/.test(f.t) || !/내 집/.test(f.t) || !/순자산/.test(f.t)) forced.push('압류 창(팔린 값 · 갚은 빚 · 어디로 · 순자산)이 다름: ' + JSON.stringify(f).slice(0, 240));
    await shot('60_foreclose'); }
  await closeAll();
  // G. 호텔: 가장 긴 숫자(현금 34,999,999,999원)로 위쪽 띠 · 선언 버튼 → 확인 → 엔딩 결과 화면
  await G(() => { const g = window.game, S = g.state.raw, R = window.Rules; S.tier = 8; S.homeVal = R.homePrice(S, 8); S.loan = { balance: 8000000000, orig: 8000000000, day: 70 }; S.missed = 0; S.arrears = 0; S.biz = 5; S.cash = 24999999999; S.day = 77; S.movedDay = 71; S.slot = 1; S.combo = 10; S.quest = 22; S.stats.maxTier = 8; S.act1 = S.act1 || { day: 22, rank: 'A', worth: 16000000, price: 15000000 }; g.render(); });
  await step(60); await closeAll(); await shot('61_hotel_goal_long'); await hudCheck('호텔 · 긴 숫자 (선언 전)');
  if (await G(() => !!document.querySelector('#hud [data-do="top"]'))) forced.push('순자산이 기준 아래인데 선언 버튼이 뜸');
  await G(() => { const S = window.game.state.raw; S.cash = 34999999999; window.game.render(); }); await step(60); await shot('62_hotel_declare'); await hudCheck('호텔 · 가장 긴 숫자');
  { const h = await G(() => ({ hud: !!document.querySelector('#hud [data-do="top"]'), quest: !!document.querySelector('#quest [data-do="top"]'), over: document.getElementById('hud').scrollWidth - document.getElementById('hud').clientWidth, cash: document.getElementById('cash').textContent }));
    if (!h.hud || !h.quest) forced.push('호텔에서 순자산이 기준을 넘었는데 위쪽 띠 · 상태창에 선언 버튼이 없음: ' + JSON.stringify(h));
    if (h.over > 0 || h.cash !== '34,999,999,999원') forced.push('가장 긴 숫자에서 위쪽 띠가 넘침: ' + JSON.stringify(h)); }
  await G(() => window.game.run('roadmap')); await step(20); await shot('63_roadmap_10_hotel');
  if (!(await G(() => document.querySelectorAll('#veil .rung').length === 10 && !!document.querySelector('#veil .rung.next [data-do="top"]')))) forced.push('호텔의 로드맵 창에 열 단계 · 선언 버튼이 없음');
  await G(() => window.game.press('Space')); await step(20);
  await page.click('#hud [data-do="top"]'); await step(20); await shot('64_confirm_top');
  await G(() => window.game.press('Enter')); await step(60);
  { const r = await G(() => ({ scene: window.game.scene, h1: (document.querySelector('.e-box h1') || {}).textContent, card: (document.querySelector('.e-card pre') || {}).textContent || '', rank: (document.querySelector('.e-box .rank') || {}).textContent }));
    if (r.scene !== 'results' || r.h1 !== '한국 최고 부자' || !/한국 최고 부자/.test(r.card) || !r.rank) forced.push('선언 뒤 엔딩 결과 화면이 다름: ' + JSON.stringify(r).slice(0, 200)); }
  await shot('65_results_top');
  // H. 사는 곳 그림: 내 집 · 아파트 · 주택 · 별장 · 호텔이 서로 다르고, 사업 · 대출 줄이 붙어 그림 칸이 낮아져도 인물 · 상태창이 안 잘림
  await fresh();
  { const sc = [];
    for (const t of [4, 5, 6, 7, 8]) {
      for (const slot of [0, 3]) {
        await G(({ t, slot }) => { const g = window.game, S = g.state.raw, R = window.Rules; S.tier = t; S.homeVal = R.homePrice(S, t); S.biz = Math.max(1, t - 3); S.loan = t >= 5 ? { balance: 50000000, orig: 60000000, day: 40 } : null; S.cash = 9000000; S.day = 44; S.movedDay = 43; S.slot = slot; S.quest = 99; S.offer = null; S.picks = 0; S.event = null; S.act1 = S.act1 || { day: 22, rank: 'A', worth: 1, price: 1 }; g.render(); }, { t, slot });
        await step(5);
        const r = await G(() => { const box = document.querySelector('#me .scene'), b = box.getBoundingClientRect(), svg = box.querySelector('svg'), rows = document.querySelectorAll('#me .me-row').length;
          const part = sel => { const e = box.querySelector(sel); if (!e) return null; const q = e.getBoundingClientRect(); return { top: q.top - b.top, bottom: b.bottom - q.bottom, left: q.left - b.left, right: b.right - q.right }; };
          return { name: svg.getAttribute('aria-label'), len: svg.outerHTML.length, h: b.height, rows, hero: part('[data-part="hero"]'), holo: part('[data-part="holo"]') }; });
        sc.push(Object.assign({ t, slot }, r));
        for (const k of ['hero', 'holo']) { const q = r[k]; if (!q || q.top < -1 || q.bottom < -1 || q.left < -1 || q.right < -1) forced.push('사는 곳 ' + t + '(' + r.name + ') 그림 칸 ' + Math.round(r.h) + 'px 에서 ' + (k === 'hero' ? '인물' : '상태창') + '이 잘림: ' + JSON.stringify(q)); }
        if (slot === 3) await shot('66_scene_' + t + '_' + r.name.replace(/\s/g, ''));
      }
    }
    const names = new Set(sc.map(x => x.name)), lens = new Set(sc.filter(x => x.slot === 3).map(x => x.len));
    if (names.size !== 5 || [...names].some(n => /원룸/.test(n)) || lens.size !== 5) forced.push('내 집 ~ 호텔 그림이 다섯 가지로 다르지 않음: ' + [...names].join(' · '));
    if (sc.some(x => x.t >= 5 && x.rows < 3)) forced.push('그림 점검이 사업 · 대출 줄이 붙은 상태가 아님: ' + JSON.stringify(sc.map(x => x.rows)));
    log.push('사는 곳 그림: ' + [...names].join(' · ') + ' (그림 칸 ' + Math.round(Math.min(...sc.map(x => x.h))) + 'px 까지)'); }
  await page.goto('file://' + path.resolve(dir, 'index.html') + '?manual=1&scene=figures'); await page.screenshot({ path: path.join(out, 'figures.png') });
  const zones = await G(() => document.querySelectorAll('[data-zone]').length);
  forced.unshift(...forcedMain);
  console.log(JSON.stringify({ seed, style, loops: guard, end: end.ended, shots: shots.length, perks, events: evts, dens, fxAfterQuest: fxSeen, errors: errs.slice(0, 8), roll: rollBad, forced, lint, log }, null, 1));
  if (errs.length || Object.keys(lint).length || rollBad.length || forced.length || !fxSeen || !evts || !perks) process.exitCode = 1; // 오류 · 넘침이 있거나, 폭죽 · 사건 · 특성 창을 한 번도 못 봤으면 실패
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
