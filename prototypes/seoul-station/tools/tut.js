// PROTOTYPE - NOT FOR PRODUCTION
// 게임이 불러오지 않는 개발용 도구. 첫 판 안내(튜토리얼)를 처음부터 끝까지 따라가 본다. 창 없이 돌고, 단계마다 화면을 찍는다.
// 보는 것: 단계가 차례로 뜨는가 · 짚은 것만 눌리는가(다른 것을 누르면 이유가 뜨는가) · 처음 하는 알바는 "시작"을 눌러야 시간이 가는가
//         · 말풍선이 화면 안에 있고 짚은 곳을 가리지 않는가 · 짚은 것을 할 수 없는 상태에서는 막지 않는가(갇히지 않는가)
//         · 끄면 안 뜨는가 · 주식/코인 설명은 한 번만 뜨는가 · 창 크기가 달라도 같은 자리인가 · 안내를 안 쓰는 점검(?manual=1)에는 안 뜨는가
//         · 실제 저장으로: 이어하기 · 새로 고침 · 끄기/다시 켜기 · 예전 기록
// node tools/tut.js [게임 폴더] [찍을 폴더]
const path = require('path'), fs = require('fs');
const { chromium } = require(process.env.KW_PLAYWRIGHT || '/Users/admin/projects/outsourcing/high-order-front/node_modules/playwright');
const dir = path.resolve(process.argv[2] || path.join(__dirname, '..')), out = process.argv[3] || path.join(dir, 'evidence', 'tut');
fs.mkdirSync(out, { recursive: true });
const BOX = () => { // 안내의 자리: 말풍선 · 고리 · 밝힌 곳 (1280×720 기준). 말풍선은 뜨는 연출(살짝 커짐) 중에도 같은 값이 나오게 배치 값으로 잰다
  const sr = document.getElementById('stage').getBoundingClientRect(), k = 1280 / sr.width;
  const r = e => { const b = e.getBoundingClientRect(); return { x: (b.left - sr.left) * k, y: (b.top - sr.top) * k, w: b.width * k, h: b.height * k }; };
  const c = document.getElementById('coach'), b = c.querySelector('.bubble');
  const tx = b ? b.querySelector('.tx') : null, shown = e => !!e && getComputedStyle(e).display !== 'none';
  return { hidden: c.classList.contains('hide'), side: b ? ['up', 'down', 'left'].find(s => b.classList.contains(s)) || '' : '', a: b ? parseFloat(b.style.getPropertyValue('--a')) || 0 : 0,
    bubble: b ? { x: b.offsetLeft, y: b.offsetTop, w: b.offsetWidth, h: b.offsetHeight } : null, rings: [...c.querySelectorAll('.ring')].map(r), holes: c.querySelectorAll('mask rect').length - 1,
    text: tx ? tx.textContent.replace(/\s+/g, ' ').trim() : '', label: b ? b.querySelector('.lab').textContent : '', why: b && shown(b.querySelector('.no')) ? b.querySelector('.no').textContent : '', labelShown: b ? shown(b.querySelector('.lab')) : false,
    over: b ? Math.max(b.scrollWidth - b.clientWidth, tx.scrollHeight - tx.clientHeight) : 0, board: r(document.getElementById('board')), // 넘침: 가로는 말풍선, 세로는 글 칸 (아래로 난 화살표는 넘침이 아님)
    small: b ? [...b.querySelectorAll('*')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 13.99).length : 0 };
};
(async () => {
  const browser = await chromium.launch({ headless: true });
  const errs = [], log = [];
  const open = async (query, size) => {
    const page = await browser.newPage({ viewport: size || { width: 1280, height: 720 } });
    page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    page.on('pageerror', e => errs.push('uncaught: ' + e.message));
    await page.goto('file://' + path.join(dir, 'index.html') + '?' + query);
    const G = (fn, arg) => page.evaluate(fn, arg);
    const step = n => G(n => { const g = window.game; g.step(n); const left = g.state.guard || 0; if (left) g.step(left + 1); g.step(2); }, n || 30); // 누름이 막힌 동안은 마저 기다림
    const st = () => G(() => { const s = window.game.state; return { day: s.day, slot: s.slot, cash: s.cash, hp: s.hp, tier: s.tier, modal: s.modal, coach: s.coach, wait: s.wait, tut: s.tut }; });
    const shot = async n => { await page.waitForTimeout(420); await page.screenshot({ path: path.join(out, n + '.png') }); };
    const box = () => G(BOX);
    const closeAll = async () => { for (let i = 0; i < 8; i++) { const m = (await st()).modal; if (!m) break; await page.keyboard.press(m === 'perk' ? 'Digit1' : 'Space'); await step(60); } };
    const start = async () => { await step(60); await page.keyboard.press('Space'); await step(30); }; // 첫 창을 닫음
    return { page, G, step, st, shot, box, closeAll, start };
  };
  const want = (cond, msg) => { if (!cond) errs.push(msg); };
  const geometry = (b, tag) => { // 말풍선은 화면 안 · 짚은 곳과 안 겹침 · 화살표가 짚은 곳을 가리킴 · 글이 넘치지 않음 · 작은 글자 없음
    want(b.bubble, tag + ': 말풍선이 없음'); if (!b.bubble) return;
    const q = b.bubble;
    want(q.x >= 8 && q.y >= 8 && q.x + q.w <= 1272 && q.y + q.h <= 712, tag + ': 말풍선이 화면 밖 ' + JSON.stringify(q));
    for (const r of b.rings) { const ix = Math.min(q.x + q.w, r.x + r.w) - Math.max(q.x, r.x), iy = Math.min(q.y + q.h, r.y + r.h) - Math.max(q.y, r.y); want(!(ix > 2 && iy > 2), tag + ': 말풍선이 짚은 곳을 가림'); }
    if (b.side && b.rings[0]) {
      const r = b.rings[0], mid = b.side === 'left' ? q.y + b.a : q.x + b.a;
      const near = b.side === 'up' ? Math.abs(q.y - (r.y + r.h)) : b.side === 'down' ? Math.abs(q.y + q.h - r.y) : Math.abs(q.x - (r.x + r.w));
      want(near < 20 && (b.side === 'left' ? mid > r.y + 8 && mid < r.y + r.h - 8 : mid > r.x + 8 && mid < r.x + r.w - 8), tag + ': 화살표가 짚은 곳을 가리키지 않음');
    }
    want(b.rings.length > 0 && b.holes >= b.rings.length, tag + ': 고리나 밝힌 곳이 없음'); want(b.over <= 1, tag + ': 말풍선 글이 넘침'); want(!b.small, tag + ': 작은 글자');
    want(b.text.length > 0 && b.text.length <= 110, tag + ': 글이 없거나 너무 김 (' + b.text.length + '자)'); want(b.label && b.labelShown && !b.why, tag + ': 이름표가 없거나, 누르기도 전에 이유가 떠 있음');
  };
  const finishMg = p => p.G(() => { const g = window.game; for (let i = 0; i < 700 && !document.querySelector('.mg-res'); i++) g.step(1); });

  // ── 1. 첫 판을 안내대로 ──
  let p = await open('manual=1&tut=1&scene=play&seed=5');
  await p.step(60);
  let s = await p.st();
  want(s.modal === 'intro' && !s.coach, '첫 창이 떠 있는 동안에는 안내가 없어야 함: ' + JSON.stringify(s));
  want(/28일 안에 집값/.test(await p.page.textContent('#veil .win')), '첫 창에 목표 한 줄이 없음');
  await p.shot('tut00_intro');
  await p.page.keyboard.press('Space'); await p.step(30);
  s = await p.st(); let b = await p.box();
  want(s.coach === 'job', '첫 안내가 "전단지"가 아님: ' + s.coach); geometry(b, 'job'); log.push('1 ' + b.label + ' — ' + b.text);
  want(await p.G(() => !document.querySelector('#today [data-do="skip"]')), '첫 알바를 짚는 동안 "대충" 버튼이 보임');
  await p.shot('tut01_job');
  // 짚은 것 말고는 안 눌림: 상하차 · 쉬기(3) · 대충 · 이사
  await p.page.click('#today [data-arg="loading"]', { position: { x: 30, y: 80 }, force: true }); await p.step(10);
  await p.page.keyboard.press('Digit3'); await p.step(10);
  await p.G(() => { window.game.state.raw.cash = 30000; window.game.run('skip', 'flyer'); window.game.run('move', '1'); window.game.state.raw.cash = 0; }); await p.step(10); // 요금이 있어도 이사는 안 됨
  s = await p.st(); want(s.slot === 0 && !s.modal && s.tier === 0, '안내가 짚지 않은 것이 눌림: ' + JSON.stringify(s));
  b = await p.box();
  want(await p.G(() => document.querySelector('#coach .bubble').classList.contains('nudge')), '다른 것을 눌렀을 때 말풍선이 흔들리지 않음');
  want(/고리/.test(b.why) && !b.labelShown, '다른 것을 눌렀을 때 왜 안 눌리는지 뜨지 않음: "' + b.why + '"'); log.push('다른 것을 누르면 — ' + b.why);
  await p.shot('tut01b_nudge');
  // 전단지 → 하는 법 (시작 전에는 시간이 안 감)
  await p.page.click('#today [data-arg="flyer"]', { position: { x: 30, y: 80 } }); await p.step(20);
  s = await p.st(); want(s.modal === 'mg' && s.wait, '처음 하는 알바에 하는 법이 안 뜸: ' + JSON.stringify(s));
  want(await p.G(() => !window.game.state.raw.pending), '하는 법을 읽는 동안 벌써 알바를 시작한 것으로 적힘');
  const t0 = await p.G(() => window.game.mg._state.wt); await p.step(240); const t1 = await p.G(() => window.game.mg._state.wt);
  want(t0 === t1, '"시작"을 누르기 전에 미니게임 시간이 감: ' + t0 + ' → ' + t1);
  await p.page.waitForTimeout(350); // 창이 뜨는 연출(살짝 커짐)이 끝난 뒤에 자리를 잰다
  const how = await p.G(() => { const e = document.querySelector('.mg-how'), c = document.querySelector('#mgc').getBoundingClientRect(), r = e.getBoundingClientRect(), w = document.querySelector('.win.mg').getBoundingClientRect(), sr = document.getElementById('stage').getBoundingClientRect();
    return { text: e.textContent.replace(/\s+/g, ' ').trim(), clear: r.top >= c.bottom, inside: r.left >= w.left && r.right <= w.right && r.bottom <= w.bottom && w.bottom <= sr.bottom && w.top >= sr.top, top: c.top, over: e.scrollHeight - e.clientHeight, ctl: document.querySelectorAll('[data-mg]').length, lines: e.querySelectorAll('li').length }; });
  want(how.clear, '하는 법이 미니게임 그림을 가림'); want(how.inside && how.over <= 1, '하는 법이 창이나 화면 밖으로 나감'); want(how.ctl === 0, '하는 법을 보는 동안 조작 버튼이 떠 있음'); want(how.lines >= 2, '하는 법이 두 줄이 안 됨');
  log.push('하는 법: ' + how.text);
  await p.shot('tut02_howto_flyer');
  await p.page.keyboard.press('ArrowLeft'); await p.step(10); want((await p.st()).wait, '시작이 아닌 키로 시작됨');
  await p.page.keyboard.press('Space'); await p.step(4);
  s = await p.st(); want(s.modal === 'mg' && !s.wait, 'Space 로 시작되지 않음');
  want(await p.G(() => window.game.state.raw.pending === 'flyer'), '시작한 알바가 "하는 중"으로 적히지 않음');
  want(Math.abs(await p.G(() => document.querySelector('#mgc').getBoundingClientRect().top) - how.top) < 0.5, '시작할 때 미니게임 그림의 자리가 움직임');
  want(await p.G(() => document.querySelectorAll('[data-mg]').length > 0 && !document.querySelector('.mg-how')), '시작한 뒤 조작 버튼이 없거나 하는 법이 남아 있음');
  await p.step(30); await p.shot('tut03_playing');
  for (let i = 0; i < 700 && !(await p.G(() => !!document.querySelector('.mg-res'))); i += 20) await p.G(() => { const g = window.game, m = g.mg; if (m && m._state.people) { const z = m._state; if (z.people.some(q => q.state === 'walk' && !q.busy && Math.abs(q.x - z.zoneX) < 30)) g.press('Space'); } g.step(20); });
  want(await p.G(() => !!document.querySelector('.mg-res')), '미니게임이 끝나지 않음');
  await p.step(60); await p.closeAll();
  s = await p.st(); b = await p.box();
  want(s.coach === 'slots' && s.slot === 1, '첫 알바 뒤 안내가 "세 칸"이 아님: ' + JSON.stringify(s)); geometry(b, 'slots'); log.push('2 ' + b.label + ' — ' + b.text);
  want(b.rings.length === 2, '세 칸 안내의 고리가 둘(오늘 · 체력)이 아님');
  await p.shot('tut04_slots');
  want((await p.st()).cash >= 15000, '이 검사는 찜질방 요금이 있을 때만 뜻이 있음: 현금 ' + (await p.st()).cash);
  await p.G(() => window.game.run('move', '1')); await p.step(10); want((await p.st()).tier === 0, '오늘 칸을 짚는 동안 이사가 됨 (찜질방 안내를 건너뛰게 됨)');
  // 두 번째 전단지는 하는 법 없이 바로
  await p.G(() => window.game.run('job', 'flyer')); await p.step(4);
  s = await p.st(); want(s.modal === 'mg' && !s.wait, '해 본 알바에 하는 법이 또 뜸');
  await finishMg(p); await p.step(60); await p.closeAll();
  want((await p.st()).coach === 'slots', '둘째 칸 뒤에도 "세 칸" 안내여야 함');
  await p.G(() => window.game.run('rest')); await p.step(30); await p.closeAll();
  s = await p.st(); b = await p.box();
  want(s.coach === 'endday' && s.slot === 3, '세 칸을 쓴 뒤 안내가 "하루 마치기"가 아님: ' + JSON.stringify(s)); geometry(b, 'endday'); log.push('3 ' + b.label + ' — ' + b.text);
  await p.shot('tut05_endday');
  want((await p.st()).cash >= 15000, '이 검사는 찜질방 요금이 있을 때만 뜻이 있음: 현금 ' + (await p.st()).cash);
  await p.G(() => window.game.run('move', '1')); await p.step(10); want((await p.st()).tier === 0, '"하루 마치기"를 짚는 동안 이사가 됨');
  await p.page.keyboard.press('Space'); await p.step(30);
  want((await p.st()).modal === 'night', '하루 마치기가 밤 정산으로 안 넘어감');
  await p.page.keyboard.press('Space'); await p.step(60); await p.closeAll();
  s = await p.st(); b = await p.box();
  want(s.day === 2 && s.coach === 'move', '2일째 아침 안내가 "찜질방"이 아님: ' + JSON.stringify(s)); geometry(b, 'move'); log.push('4 ' + b.label + ' — ' + b.text);
  await p.shot('tut06_move');
  { // 4단계 고리는 로드맵(판 자리)의 다음 칸 옮기기 버튼
    const r = await p.G(() => { const e = document.querySelector('#board .rung.next [data-do="move"]'); if (!e) return null; const sr = document.getElementById('stage').getBoundingClientRect(), k = 1280 / sr.width, q = e.getBoundingClientRect(); return { x: (q.left - sr.left) * k - 5, y: (q.top - sr.top) * k - 5 }; });
    want(r && b.rings[0] && Math.abs(b.rings[0].x - r.x) < 2 && Math.abs(b.rings[0].y - r.y) < 2, '4단계 고리가 로드맵의 옮기기 버튼이 아님: ' + JSON.stringify({ r, ring: b.rings[0] }));
  }
  await p.page.keyboard.press('Digit1'); await p.step(10);
  want((await p.st()).slot === 0 && !(await p.st()).modal, '찜질방을 짚는 동안 다른 것이 눌림');
  await p.page.click('#board [data-do="move"]'); await p.step(30); await p.closeAll();
  s = await p.st(); b = await p.box();
  want(s.tier === 1 && s.coach === 'goal', '옮긴 뒤 안내가 "마무리"가 아님: ' + JSON.stringify(s)); geometry(b, 'goal'); log.push('5 ' + b.label + ' — ' + b.text);
  want(b.side === 'down' && b.bubble.x + b.bubble.w <= b.board.x, '마무리 말풍선이 로드맵(다음 목표인 고시원 카드)을 가림');
  await p.shot('tut07_goal');
  await p.page.keyboard.press('Digit1'); await p.step(10); want(!(await p.st()).modal, '마무리 안내를 읽기 전에 다른 것이 눌림');
  want(/알겠다/.test((await p.box()).why), '읽고 넘기는 안내에서 다른 것을 눌렀을 때 무엇을 누를지 뜨지 않음');
  await p.G(() => { const g = window.game; g.run('help'); g.step(60); g.run('ok'); g.step(20); g.press('Space'); g.step(3); g.press('Enter'); g.step(3); }); // 도움말을 닫아 안내가 다시 뜬 뒤 0.3초쯤의 연타 (창을 닫을 때의 짧은 막음은 이미 지난 때)
  want((await p.st()).coach === 'goal', '읽고 넘기는 안내가 뜨자마자 연타에 넘어감'); await p.step(40);
  await p.page.keyboard.press('Space'); await p.step(30);
  s = await p.st(); b = await p.box();
  want(!s.coach && !s.tut && b.hidden, '마무리 뒤에도 안내가 남아 있음: ' + JSON.stringify(s));
  want(await p.G(() => window.game.meta.tut === 2), '안내를 끝낸 것이 기록되지 않음');
  await p.shot('tut08_free');
  // 처음 하는 다른 알바: 하는 법이 뜨고, 눌러서(마우스) 시작
  await p.G(() => window.game.run('job', 'loading')); await p.step(30);
  want((await p.st()).wait, '처음 하는 상하차에 하는 법이 안 뜸'); await p.shot('tut09_howto_loading');
  await p.page.click('[data-do="mgstart"]'); await p.step(4); want(!(await p.st()).wait, '"시작" 버튼으로 시작되지 않음');
  await finishMg(p); await p.step(60); await p.closeAll();
  // 주식 · 코인 설명: 처음 그 탭을 열 때 한 번만
  await p.G(() => { const S = window.game.state.raw; S.tier = 2; S.cash = 2330000; S.day = 5; S.movedDay = 3; S.quest = 4; window.game.render(); window.game.run('tab', 'stock'); }); await p.step(30); await p.closeAll();
  s = await p.st(); b = await p.box();
  want(s.coach === 'stock', '주식 탭을 처음 열 때 설명이 안 뜸: ' + JSON.stringify(s)); geometry(b, 'stock'); want(b.rings.length === 3, '주식 설명의 고리가 셋이 아님'); log.push(b.label + ' — ' + b.text);
  await p.shot('tut10_stock');
  await p.G(() => window.game.run('buy', '100000')); await p.step(10); want(await p.G(() => window.game.state.raw.stats.bought === 0), '주식 설명을 읽기 전에 사짐');
  await p.page.click('[data-do="coachok"]'); await p.step(30);
  want(!(await p.st()).coach, '주식 설명이 닫히지 않음');
  await p.G(() => { window.game.run('roadmap'); window.game.step(20); window.game.run('ok'); window.game.step(20); window.game.render(); window.game.run('tab', 'stock'); }); await p.step(30); want(!(await p.st()).coach, '주식 설명이 또 뜸');
  await p.G(() => window.game.run('buy', '100000')); await p.step(10); want(await p.G(() => window.game.state.raw.stats.bought > 0), '설명을 닫은 뒤에도 못 삼');
  await p.closeAll();
  await p.G(() => { const S = window.game.state.raw; S.tier = 3; S.cash = 9200000; S.day = 15; S.movedDay = 12; window.game.render(); window.game.run('tab', 'coin'); }); await p.step(30); await p.closeAll();
  s = await p.st(); b = await p.box();
  want(s.coach === 'coin', '코인 탭을 처음 열 때 설명이 안 뜸: ' + JSON.stringify(s)); geometry(b, 'coin'); log.push(b.label + ' — ' + b.text);
  await p.shot('tut11_coin');
  await p.page.keyboard.press('Enter'); await p.step(30); want(!(await p.st()).coach, '코인 설명이 Enter 로 닫히지 않음');
  await p.page.close();

  // ── 2. 짚은 것을 할 수 없는 상태에서는 막지 않는다 (갇히지 않는다) ──
  p = await open('manual=1&tut=1&scene=play&seed=5'); await p.start();
  await p.G(() => { window.game.state.raw.hp = 0; window.game.render(); }); await p.step(5); // 전단지를 할 체력이 없음
  want((await p.st()).coach === 'job', '체력이 없어도 첫 안내는 전단지');
  await p.G(() => window.game.run('rest')); await p.step(30); await p.closeAll();
  want((await p.st()).slot === 1, '전단지를 할 수 없는데 다른 것도 안 눌림 (갇힘)');
  await p.G(() => { const S = window.game.state.raw; S.day = 2; S.slot = 0; S.cash = 0; window.game.render(); }); await p.step(5); // 2일째인데 찜질방 요금이 없음
  s = await p.st(); b = await p.box();
  want(s.coach === 'earn', '찜질방 요금이 없을 때의 안내가 아님: ' + s.coach); geometry(b, 'earn'); log.push('4(돈이 모자랄 때) ' + b.label + ' — ' + b.text);
  want(b.holes >= 5, '돈이 모자랄 때는 오늘 칸 · 나 · 위쪽 띠도 밝아야 함 (밝힌 곳 ' + b.holes + ')');
  await p.shot('tut14_earn');
  await p.G(() => window.game.run('rest')); await p.step(30); await p.closeAll();
  want((await p.st()).slot === 1, '찜질방 요금이 없는데 알바 · 쉬기가 막힘 (갇힘)');
  await p.G(() => { window.game.state.raw.cash = 50000; window.game.render(); }); await p.step(5);
  want((await p.st()).coach === 'move', '요금이 모였는데 "옮기기" 안내로 안 바뀜');
  await p.page.close();

  // ── 3. 안내 끄기 ──
  p = await open('manual=1&tut=1&scene=play&seed=5'); await p.start();
  await p.page.click('[data-do="coachoff"]'); await p.step(10);
  s = await p.st(); want(!s.coach && !s.tut, '"안내 끄기" 뒤에도 안내가 남음');
  want(/제목 화면/.test(await p.page.textContent('#toasts')), '안내를 끌 때 어디서 다시 켜는지 알려 주지 않음');
  want(await p.G(() => !!document.querySelector('#today [data-do="skip"]')), '안내를 끈 뒤 "대충" 버튼이 안 돌아옴');
  await p.G(() => window.game.run('job', 'loading')); await p.step(10);
  s = await p.st(); want(s.modal === 'mg' && !s.wait, '안내를 껐는데 하는 법이 뜸');
  await p.page.close();

  // ── 4. 안내를 안 쓰는 점검 창에는 아무것도 안 뜸 ──
  p = await open('manual=1&scene=play&seed=5'); await p.start();
  s = await p.st(); want(!s.coach && !s.tut, '?manual=1 에 안내가 뜸');
  await p.G(() => window.game.run('job', 'flyer')); await p.step(4); want(!(await p.st()).wait, '?manual=1 에 하는 법이 뜸');
  await p.page.close();

  // ── 5. 창 크기가 달라도 같은 자리 ──
  let ref = null;
  for (const [w, h] of [[1280, 720], [800, 450], [1920, 1080]]) {
    p = await open('manual=1&tut=1&scene=play&seed=5', { width: w, height: h }); await p.start();
    b = await p.box(); geometry(b, w + '×' + h + ' job');
    const key = [b.bubble.x, b.bubble.y, b.rings[0].x, b.rings[0].y, b.rings[0].w].map(Math.round);
    if (!ref) ref = key; else want(key.every((v, i) => Math.abs(v - ref[i]) <= 2), w + '×' + h + ': 안내의 자리가 달라짐 ' + key + ' ≠ ' + ref);
    if (w === 800) await p.shot('tut12_small_800x450');
    await p.page.close();
  }

  // ── 6. 실제 저장으로 ──
  const real = async (query, seedMeta) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    if (seedMeta) await ctx.addInitScript(m => { if (!localStorage.getItem('seoul-station-meta-v1')) localStorage.setItem('seoul-station-meta-v1', m); }, seedMeta);
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push('uncaught: ' + e.message));
    const st = () => page.evaluate(() => { const s = window.game.state; return { scene: window.game.scene, day: s.day, slot: s.slot, coach: s.coach, tut: s.tut, modal: s.modal, wait: s.wait, mt: window.game.meta.tut }; });
    const wait = ms => page.waitForTimeout(ms);
    const load = async q => { await page.goto('file://' + path.join(dir, 'index.html') + '?' + (q || query)); await wait(450); };
    const fresh = async () => { await page.click('[data-do="new"]'); await wait(300); if (await page.evaluate(() => window.game.scene) === 'title') { await page.click('[data-do="new"]'); await wait(300); } await wait(600); if ((await st()).modal === 'intro') { await page.click('#veil [data-do="ok"]'); await wait(700); } }; // 저장이 있으면 한 번 더 눌러야 시작
    const resume = async () => { await page.click('[data-do="continue"]'); await wait(700); };
    const quit = async () => { await page.click('#hud [data-do="quit"]'); await wait(400); };
    const clear = async () => { for (let i = 0; i < 6 && (await st()).modal; i++) { await page.click((await st()).modal === 'perk' ? '.pcard' : '#veil [data-do="ok"]'); await wait(750); } };
    await load();
    return { ctx, page, st, wait, load, fresh, resume, quit, clear };
  };
  { // 처음 연 사람: 안내가 뜨고, 새로 고쳐 이어 해도 이어지고, 끄면 다음 판에 안 뜨고, 제목 화면에서 다시 켠다
    const r = await real('seed=5');
    want(await r.page.locator('[data-do="tuttoggle"]').count() === 1 && /켜짐/.test(await r.page.textContent('[data-do="tuttoggle"]')), '제목 화면에 "첫 판 안내 켜짐"이 없음');
    await r.page.screenshot({ path: path.join(out, 'tut13_title.png') });
    await r.fresh();
    s = await r.st(); want(s.coach === 'job' && s.mt === 1, '처음 연 사람에게 안내가 안 뜸: ' + JSON.stringify(s));
    await r.load(); // 아무것도 하지 않고 새로 고침: 방금 시작한 판이 저장되어 있어야 한다
    want(await r.page.locator('[data-do="continue"]').count() === 1, '새 판을 시작하자마자 새로 고치면 이어하기가 없음');
    await r.resume();
    s = await r.st(); want(s.coach === 'job' && s.day === 1, '이어하기에서 안내가 이어지지 않음: ' + JSON.stringify(s));
    await r.page.click('#today [data-arg="flyer"]', { position: { x: 30, y: 80 } }); await r.wait(500);
    want((await r.st()).wait, '하는 법이 안 뜸 (실제 저장)');
    await r.load(); await r.resume(); // 하는 법을 읽다가 새로 고침: 칸을 쓰지 않고 그 자리 그대로
    s = await r.st(); want(s.slot === 0 && s.coach === 'job', '하는 법을 읽다가 새로 고치면 알바를 "대충" 한 것으로 처리됨: ' + JSON.stringify(s));
    await r.page.click('#today [data-arg="flyer"]', { position: { x: 30, y: 80 } }); await r.wait(600);
    await r.page.click('[data-do="mgstart"]'); await r.wait(300);
    await r.load(); await r.resume(); // 시작한 뒤에 새로 고침: 예전처럼 "대충" 처리
    s = await r.st(); want(s.slot === 1, '시작한 알바를 하다가 새로 고쳤는데 칸이 그대로: ' + JSON.stringify(s));
    await r.clear();
    await r.page.click('#today [data-arg="flyer"]', { position: { x: 30, y: 80 } }); await r.wait(500);
    s = await r.st(); want(s.modal === 'mg' && !s.wait, '본 하는 법이 새로 고친 뒤 또 뜸 (본 것이 남지 않음): ' + JSON.stringify(s));
    await r.load(); await r.resume(); await r.clear();
    await r.page.click('[data-do="coachoff"]'); await r.wait(300);
    await r.quit(); await r.load();
    want(/꺼짐/.test(await r.page.textContent('[data-do="tuttoggle"]')), '끈 안내가 제목 화면에 "꺼짐"으로 안 보임');
    await r.fresh();
    s = await r.st(); want(s.scene === 'play' && !s.coach && !s.tut, '끈 안내가 다음 판에 또 뜸: ' + JSON.stringify(s));
    await r.quit();
    await r.page.click('[data-do="tuttoggle"]'); await r.wait(300);
    want(/켜짐/.test(await r.page.textContent('[data-do="tuttoggle"]')), '제목 화면에서 안내를 다시 켤 수 없음');
    want(/새 판/.test(await r.page.textContent('#toasts')), '안내를 다시 켤 때 "새 판부터"라고 알려 주지 않음');
    await r.fresh();
    s = await r.st(); want(s.coach === 'job', '다시 켠 안내가 새 판에 안 뜸: ' + JSON.stringify(s));
    await r.ctx.close();
  }
  { // 예전 기록(안내가 생기기 전)으로 하던 사람: 하던 판을 이어 하면 안내가 붙지 않고, 새 판을 고르면 그 판에 안내가 뜬다
    const r = await real('seed=5&tut=0', JSON.stringify({ ach: { first_pay: 1 }, runs: 3, wins: 0, bestPct: 0.4 }));
    await r.fresh(); // 안내 없이 하던 판을 하나 만들어 둠 (?tut=0)
    s = await r.st(); want(!s.coach && !s.tut, '?tut=0 인데 안내가 뜸: ' + JSON.stringify(s));
    await r.page.evaluate(() => { const S = window.game.state.raw; S.day = 10; S.tier = 3; S.cash = 5900000; window.game.render(); }); await r.quit();
    await r.load('seed=5');
    want(/켜짐/.test(await r.page.textContent('[data-do="tuttoggle"]')), '예전 기록으로 열면 안내가 켜져 있어야 함 (본 적이 없으므로)');
    await r.resume();
    s = await r.st(); want(s.day === 10 && !s.tut && s.coach !== 'goal' && s.coach !== 'move', '하던 판을 이어 했는데 첫 판 안내가 붙음: ' + JSON.stringify(s));
    await r.quit(); await r.fresh();
    s = await r.st(); want(s.day === 1 && s.coach === 'job', '예전 기록이 있는 사람이 새 판을 골랐는데 안내가 안 뜸: ' + JSON.stringify(s));
    await r.load('seed=5'); await r.resume(); // 새 판을 고른 직후 새로 고침: 하던 10일째 판이 아니라 새 판이어야 한다
    s = await r.st(); want(s.day === 1 && s.coach === 'job', '새 판을 고른 뒤 새로 고쳤더니 예전 판에 안내가 붙음: ' + JSON.stringify(s));
    await r.ctx.close();
  }

  await browser.close();
  console.log(JSON.stringify({ errors: errs, log }, null, 1));
  if (errs.length) process.exitCode = 1;
})().catch(e => { console.error('FAIL', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
