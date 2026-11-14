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
    const box = el.closest('#hud,#me,#quest,#today,#board,.win,.e-box,.t-box');
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
  const step = n => G(n => { const g = window.game; g.step(n); const left = g.state.guard || 0; if (left) g.step(left + 1); }, n); // 누름이 막힌 동안(창이 막 뜬 직후)은 마저 기다린다
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
  let guard = 0, mgShot = 0, fxSeen = 0, perks = 0, evts = 0, dens = 0;
  const rollBad = [];
  const hudCheck = async tag => { // 숫자 굴림이 끝난 뒤 위쪽 띠의 현금 · 순자산 = 판 상태
    await step(45);
    const r = await G(() => { const R = window.Rules, S = window.game.state.raw; return { cash: document.getElementById('cash').textContent, want: R.won(S.cash), worth: document.getElementById('worth').textContent, wantW: R.won(R.worth(S)) }; });
    if (r.cash !== r.want || r.worth !== r.wantW) rollBad.push(tag + ': 위쪽 띠 ' + r.cash + ' / ' + r.worth + ' ≠ 판 ' + r.want + ' / ' + r.wantW);
  };
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
      await step(40); // 일당은 0 에서 굴러 올라간다 (0.6초)
      { const t = await G(() => { const e = document.getElementById('mgpay'); return e ? e.textContent : null; }); if (!t || !/^\+[0-9,]+원$/.test(t) || t === '+0원') rollBad.push('미니게임 일당이 굴림 뒤 숫자가 아님: ' + t); }
      await step(30); await G(() => window.game.press('Space')); await step(20);
      continue;
    }
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
    if (s.worth >= s.price) { await shot('20_house_ready'); await page.click('#hud [data-do="house"]'); await step(20); await shot('21_confirm_house'); await G(() => window.game.press('Enter')); await step(20); continue; } // 순자산이 집값을 넘으면 위쪽 띠의 집값 자리가 "집 계약" 버튼
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
      { const t = await G(() => { const R = window.Rules, n = window.game.state.raw.last, a = document.getElementById('nightin'), b = document.getElementById('nightout'); return a && b ? [a.textContent, '+' + R.won(n.labor), b.textContent, '−' + R.won(n.spent)] : null; }); if (!t || t[0] !== t[1] || t[2] !== t[3]) rollBad.push(s.day + '일 밤 정산 합계가 굴림 뒤 값과 다름: ' + JSON.stringify(t)); }
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
  await shot('30_results_' + (end.ended ? end.ended.kind : 'none'));
  // ── 일부러 만든 화면: 판이 우연히 안 지나간 곳도 한 번씩 (같은 넘침 · 작은 글자 점검) ──
  const forced = [];
  const fresh = async () => { await page.goto('file://' + path.resolve(dir, 'index.html') + '?manual=1&scene=play&seed=' + seed); await step(60); await G(() => window.game.press('Space')); await step(40); };
  await fresh();
  await G(() => { const S = window.game.state.raw; S.day = 2; S.cash = 40000; S.quest = 2; window.game.render(); }); await step(10); await shot('40_roadmap_board_next'); // 찜질방 옮기기 버튼이 켜진 로드맵 판
  if (!(await G(() => !!document.querySelector('#board .rung.next [data-do="move"]') && !!document.querySelector('#quest [data-do="move"]')))) forced.push('로드맵 판 · 상태창에 찜질방 옮기기 버튼이 없음');
  if (await G(() => /보증금/.test(document.getElementById('s-play').textContent))) forced.push('화면에 "보증금"이 남아 있음');
  await G(() => { const S = window.game.state.raw; S.tier = 1; S.quest = 3; S.cash = 120000; S.day = 6; window.game.render(); }); await step(10); await shot('41_roadmap_board_short'); // 고시원 기준에 못 미침: 이유 · 막대
  if (!(await G(() => { const b = document.querySelector('#quest [data-do="why"]'); return !!b && /모자랍니다/.test(b.dataset.arg); }))) forced.push('상태창의 옮기기 버튼이 못 할 때 이유(moveInfo.why)를 안 줌');
  if (!(await G(() => /가져가지 않음/.test(document.querySelector('#board .rung.next').textContent)))) forced.push('로드맵 고시원 칸에 "가져가지 않음"이 없음');
  // 긴 숫자 · 주간 띠 · 알림 줄(일요일: 오늘 밤 고정비 + 내일 아침 집값) · 보유 줄 + 합계 + 코인
  await G(() => { const g = window.game, S = g.state.raw; S.tier = 3; S.quest = 11; S.day = 21; S.movedDay = 15; S.cash = 37980000; S.combo = 10; S.arrears = 8000000; S.hold.hantang = { units: 1000, cost: 11000000 }; S.hold.daejang = { units: 20, cost: 1000000 }; S.offer = null; S.picks = 0; g.render(); g.run('tab', 'coin'); g.run('lev', '5'); g.run('share', '0.25'); g.run('long'); g.step(40); g.run('tab', 'stock'); });
  await step(60); await shot('42_long_numbers_stock'); await hudCheck('긴 숫자');
  const f42 = await G(() => ({ notes: [...document.querySelectorAll('#quest .note')].map(e => e.className + ':' + e.textContent), wk: document.querySelectorAll('#hud .wk > *').length, bill: !!document.querySelector('#hud .wk .bill.now'), rows: [...document.querySelectorAll('#board .arow .mine')].map(e => e.textContent), sum: (document.querySelector('#board .hsum') || {}).textContent || '', lv: !!document.querySelector('#board .hsum .lv'), house: !!document.querySelector('#hud [data-do="house"]') }));
  if (f42.wk !== 7 || !f42.bill) forced.push('주간 띠가 일곱 칸이 아니거나 일요일 고정비 칸이 오늘로 안 보임: ' + JSON.stringify(f42));
  if (!f42.notes.some(n => /today/.test(n) && /오늘 밤 고정비/.test(n)) || !f42.notes.some(n => /tomorrow/.test(n) && /내일 아침 집값/.test(n))) forced.push('일요일 알림 줄이 다름: ' + f42.notes.join(' | '));
  if (f42.rows.length !== 3 || !/없음/.test(f42.rows[1]) || !/%/.test(f42.rows[2]) || !f42.lv || !/보유/.test(f42.sum)) forced.push('보유 줄 · 합계가 다름: ' + JSON.stringify(f42));
  if (f42.house) forced.push('순자산이 집값보다 작은데 위쪽 띠에 집 계약 버튼');
  await G(() => { const S = window.game.state.raw; S.day = 20; window.game.render(); }); await step(10);
  if (!(await G(() => [...document.querySelectorAll('#quest .note')].some(e => /tomorrow/.test(e.className) && /내일 밤 고정비/.test(e.textContent))))) forced.push('토요일에 "내일 밤 고정비" 알림이 없음');
  await G(() => { const S = window.game.state.raw; S.day = 17; window.game.render(); }); await step(10);
  if (await G(() => document.querySelectorAll('#quest .note').length)) forced.push('고정비 · 집값 인상 이틀 전인데 알림이 뜸');
  await G(() => { const S = window.game.state.raw; S.cash = 90000000; window.game.render(); }); await step(60); await shot('43_house_button'); await hudCheck('집 계약');
  if (!(await G(() => !!document.querySelector('#hud [data-do="house"]') && !!document.querySelector('#quest [data-do="house"]')))) forced.push('순자산이 집값을 넘었는데 위쪽 띠 · 상태창에 집 계약 버튼이 없음');
  await G(() => window.game.run('roadmap')); await step(20); await shot('44_roadmap_modal_late');
  if (!(await G(() => !!document.querySelector('#veil .rung [data-do="house"]')))) forced.push('로드맵 창에 집 계약 버튼이 없음');
  await G(() => window.game.press('Space')); await step(20);
  // 도박장 다섯 판: 판돈 → 홀/짝 → 구름 → 결과 → (이기면 따블) → 다섯 판이면 합계를 보여 주고 닫힘
  await fresh();
  await G(() => { const g = window.game, S = g.state.raw; S.tier = 2; S.day = 9; S.movedDay = 8; S.cash = 2000000; S.quest = 99; S.offer = null; S.picks = 0; S.xp = 0; S.event = 'den'; g.render(); g.run('rest'); g.step(40); g.press('Digit1'); g.step(40); g.press('Space'); g.step(40); });
  if ((await st()).modal !== 'den') forced.push('친구의 전화에서 "간다"를 골랐는데 도박장 창이 안 뜸');
  await shot('45_den_open');
  if (!(await G(() => /1\.9배 · 자릿세 5%/.test(document.querySelector('.win.den').textContent)))) forced.push('도박장 창에 "맞히면 1.9배 · 자릿세 5%"가 없음');
  let rounds = 0, doubled = 0;
  const raw = n => G(n => window.game.step(n), n); // 막음을 기다리지 않는 걸음 (구르는 동안을 보려고)
  for (let i = 0; i < 8 && (await st()).modal === 'den'; i++) {
    const d = await G(() => window.game.state.den);
    if (d.fin) break;
    const can = await G(() => !!document.querySelector('[data-do="dendouble"]'));
    if (can && !doubled) { await G(() => window.game.press('Enter')); doubled++; }
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
  await page.goto('file://' + path.resolve(dir, 'index.html') + '?manual=1&scene=figures'); await page.screenshot({ path: path.join(out, 'figures.png') });
  const zones = await G(() => document.querySelectorAll('[data-zone]').length);
  console.log(JSON.stringify({ seed, style, loops: guard, end: end.ended, shots: shots.length, perks, events: evts, dens, fxAfterQuest: fxSeen, errors: errs.slice(0, 8), roll: rollBad, forced, lint }, null, 1));
  if (errs.length || Object.keys(lint).length || rollBad.length || forced.length || !fxSeen || !evts || !perks) process.exitCode = 1; // 오류 · 넘침이 있거나, 폭죽 · 사건 · 특성 창을 한 번도 못 봤으면 실패
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
