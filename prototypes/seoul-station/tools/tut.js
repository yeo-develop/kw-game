// PROTOTYPE - NOT FOR PRODUCTION
// 게임이 불러오지 않는 개발용 도구. 첫 판 안내(튜토리얼)를 처음부터 끝까지 따라가 본다. 창 없이 돌고, 단계마다 화면을 찍는다.
// 보는 것: 단계가 차례로 뜨는가 · 짚은 것만 눌리는가(다른 것을 누르면 이유가 뜨는가) · 알바는 시작 전 화면에서 "시작"을 눌러야 판이 움직이는가(← → 강도)
//         · 말풍선이 화면 안에 있고 짚은 곳을 가리지 않는가 · 짚은 것을 할 수 없는 상태에서는 막지 않는가(갇히지 않는가)
//         · 끄면 안 뜨는가 · 주식 설명 · 코인 연습(세 박자)은 한 번만 뜨는가 · 창 크기가 달라도 같은 자리인가 · 안내를 안 쓰는 점검(?manual=1)에는 안 뜨는가
//         · 실제 저장으로: 이어하기 · 새로 고침(시작 전 · 하는 중 · 하만 되는 체력으로 하로 시작한 판) · 끄기/다시 켜기 · 예전 기록
// node tools/tut.js [게임 폴더] [찍을 폴더]
const path = require('path'), fs = require('fs');
const { chromium } = require(process.env.KW_PLAYWRIGHT || '/Users/admin/projects/outsourcing/high-order-front/node_modules/playwright');
const advanceOpening = require('./opening');
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
    const st = () => G(() => { const s = window.game.state; return { day: s.day, slot: s.slot, cash: s.cash, hp: s.hp, tier: s.tier, modal: s.modal, coach: s.coach, pre: s.pre, int: s.int, tut: s.tut }; });
    const shot = async n => { await page.waitForTimeout(420); await page.screenshot({ path: path.join(out, n + '.png') }); };
    const box = () => G(BOX);
    const closeAll = async () => {
      for (let i = 0; i < 8; i++) {
        const m = (await st()).modal; if (!m) break;
        if (m === 'perk') await confirmPerk(page, () => step(1)); else await page.keyboard.press('Space');
        await step(60);
      }
    };
    const start = async () => { await advanceOpening(page); await step(30); };
    return { page, G, step, st, shot, box, closeAll, start };
  };
  const want = (cond, msg) => { if (!cond) errs.push(msg); };
  async function confirmPerk(page, ready = () => page.waitForFunction(() => window.game.state.guard === 0)) {
    await ready();
    const [id, n] = await page.evaluate(() => { const s = window.game.state.raw, id = s.offer[0]; return [id, window.Rules.perk(s, id)]; });
    await page.click('#perk-confirm');
    want(await page.evaluate(id => window.Rules.perk(window.game.state.raw, id), id) === n + 1, '첫 특성 확정으로 보유 수가 하나 늘지 않음: ' + id);
  }
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
  want(await p.page.textContent('#opening-title') === '서울역 벤치', '첫 화면에 서울역 프롤로그가 없음');
  want((await p.page.textContent('.opening-narration')).includes('밤새 누워 있던 벤치의 냉기가 아직 옷에 배어 있었다.'), '수정한 프롤로그 대사가 빠짐');
  want(await p.G(() => {
    const art = document.querySelector('.opening-scene img').getBoundingClientRect();
    const story = document.querySelector('.opening-narration').getBoundingClientRect();
    return Math.abs(art.width / art.height - 3.25) < 0.05 && art.bottom <= story.top;
  }), '프롤로그 가로 그림 아래에 대사가 있어야 함');
  await p.shot('tut00_prologue');
  await advanceOpening(p.page, 1); await p.step(30); await p.shot('tut00_intro');
  want(await p.page.textContent('#opening-title') === '상태 진단' && await p.page.locator('.opening-stats > div').count() === 3 &&
    await p.page.locator('.opening-slots').count() === 0,
    '상태창 안내에 현금 · 주소 · 체력이 빠짐');
  await advanceOpening(p.page, 2); await p.step(30); await p.shot('tut00_road');
  { const t = await p.page.textContent('#veil .intro'); want(/한국 최고 부자/.test(t) && /내 집 마련/.test(t) && /기한 없음/.test(t) && !/28일/.test(t), '로드맵에 두 목표와 기한 안내가 없음'); }
  want((await p.page.locator('.opening-dialogue').innerText()).endsWith('님을 돕기 위해 온 사람입니다.\n기한은 없으니, 한국 최고의 부자가 되는 날까지 곁에서 응원하겠습니다.'), '목표 안내의 응원 대사가 빠졌거나 순서가 바뀜');
  want(await p.page.locator('.introroad + .opening-goals').count() === 1, '로드맵 아래에 목표 카드가 있어야 함');
  want(await p.page.locator('.opening-slot').count() === 3, '오늘의 행동 3칸이 목표 화면에 빠짐');
  await advanceOpening(p.page, 3); await p.step(30); await p.shot('tut00_dream');
  want(await p.page.textContent('#opening-title') === '첫 각성 선물', '꿈 선택 앞에 첫 각성 선물 안내가 없음');
  const gift = p.page.locator('#gift-confirm');
  want(await gift.isDisabled() && await p.page.locator('.dcard.on, .dream-path').count() === 0, '선물을 고르기 전부터 선택 또는 해금 경로가 보임');
  for (const key of ['Space', 'Space', 'Enter']) { await p.page.keyboard.press(key); await p.step(4); }
  want(await gift.isDisabled(), 'Space 연타나 Enter로 선물 선택을 건너뜀');
  { const cards = await p.page.locator('.dcard').allTextContents();
    want(cards.length === 3 && /밤 체력 회복 \+8/.test(cards[0]) && /사업 매출 \+10%/.test(cards[1]) &&
      /임대수익 \+10%/.test(cards[2]), '꿈 카드 세 장에 비교할 효과 수치가 있어야 함');
    const emblems = await p.page.locator('.dream-emblem img').evaluateAll(images => images.filter(img => img.naturalWidth === 32).map(img => img.src));
    want(new Set(emblems).size === 3, '꿈마다 서로 다른 32픽셀 엠블럼이 있어야 함'); }
  await p.page.keyboard.press('Digit1'); await p.step(4);
  want(await gift.isEnabled() && await p.page.locator('.dcard.on, .dream-path').count() === 2, '숫자 키로 고른 선물이 확정 가능해지지 않음');
  await gift.focus(); await p.page.keyboard.press('Space'); await p.step(4);
  want(await gift.isVisible(), '선물 받기 버튼에 포커스가 있을 때 Space로 넘어감');
  await p.page.keyboard.press('Enter'); await p.step(30); await p.shot('tut00_quest');
  want(await p.page.textContent('#opening-title') === '첫 끼니를 벌어라' &&
    /아무 알바 1회 완료/.test(await p.page.textContent('#veil .quest-objective')) &&
    /삼각김밥.*체력 \+10/.test(await p.page.textContent('#veil .quest-payment')), '시작 안내의 첫 퀘스트에 목표 또는 보상 카드가 빠짐');
  want((await p.page.textContent('#veil [data-do="ok"]')).trim().startsWith('다음'), '첫 퀘스트 확인 버튼은 "다음"이어야 함');
  await p.start();
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
  s = await p.st(); want(s.modal === 'mg' && s.pre, '알바를 눌렀는데 시작 전 화면이 안 뜸: ' + JSON.stringify(s));
  want(await p.G(() => !window.game.state.raw.pending && !window.game.mg && !!window.game.demo), '시작 전 화면인데 벌써 알바를 시작한 것으로 적히거나 시연이 없음');
  { const j0 = await p.G(() => JSON.stringify(window.game.state.raw)); await p.step(240); want(j0 === await p.G(() => JSON.stringify(window.game.state.raw)), '"시작"을 누르기 전에 판 상태(JSON)가 바뀜'); }
  await p.page.waitForTimeout(350); // 창이 뜨는 연출(살짝 커짐)이 끝난 뒤에 자리를 잰다
  const how = await p.G(() => { const e = document.querySelector('.mg-how'), c = document.querySelector('#mgc').getBoundingClientRect(), r = e.getBoundingClientRect(), w = document.querySelector('.win.mg').getBoundingClientRect(), sr = document.getElementById('stage').getBoundingClientRect();
    return { text: e.textContent.replace(/\s+/g, ' ').trim(), clear: r.top >= c.bottom, inside: r.left >= w.left && r.right <= w.right && r.bottom <= w.bottom && w.bottom <= sr.bottom && w.top >= sr.top, top: c.top, over: e.scrollHeight - e.clientHeight, ctl: document.querySelectorAll('[data-mg]').length, lines: e.querySelectorAll('li').length, first: /처음 하는 알바/.test(e.textContent), ints: document.querySelectorAll('#veil [data-do="int"]').length }; });
  want(how.clear, '하는 법이 미니게임 그림을 가림'); want(how.inside && how.over <= 1, '하는 법이 창이나 화면 밖으로 나감'); want(how.ctl === 0, '시작 전에 조작 버튼이 떠 있음'); want(how.lines >= 2, '하는 법이 두 줄이 안 됨');
  want(how.first && how.ints === 4, '처음 하는 알바의 시작 전 화면에 "처음 하는 알바" 머리글 · 강도 넷이 없음: ' + JSON.stringify(how));
  log.push('하는 법: ' + how.text);
  await p.shot('tut02_pre_flyer');
  await p.page.keyboard.press('ArrowLeft'); await p.step(10); s = await p.st(); want(s.pre && s.int === 0, '← 로 강도가 하로 안 내려가거나 시작됨: ' + JSON.stringify(s));
  await p.page.keyboard.press('ArrowRight'); await p.step(10); s = await p.st(); want(s.pre && s.int === 1, '→ 로 강도가 중으로 안 돌아옴: ' + JSON.stringify(s));
  await p.page.keyboard.press('KeyA'); await p.page.keyboard.press('Digit1'); await p.step(10); s = await p.st(); want(s.pre && s.int === 1, '시작 · 강도와 상관없는 키(A · 1)로 무엇이 바뀜: ' + JSON.stringify(s));
  await p.page.keyboard.press('Space'); await p.step(4);
  s = await p.st(); want(s.modal === 'mg' && !s.pre, 'Space 로 시작되지 않음');
  want(await p.G(() => { const q = window.game.state.raw.pending; return !!q && q.id === 'flyer' && q.n === 1; }), '시작한 알바가 "하는 중"(알바 · 강도)으로 적히지 않음');
  want(Math.abs(await p.G(() => document.querySelector('#mgc').getBoundingClientRect().top) - how.top) < 0.5, '시작할 때 미니게임 그림의 자리가 움직임');
  want(await p.G(() => document.querySelectorAll('[data-mg]').length > 0 && !document.querySelector('[data-do="int"]') && !document.querySelector('.mg-demo:not(.hide)')), '시작한 뒤 조작 버튼이 없거나 강도 버튼 · 시연 딱지가 남아 있음');
  await p.step(30); await p.shot('tut03_playing');
  for (let i = 0; i < 700 && !(await p.G(() => !!document.querySelector('.mg-res'))); i += 20) await p.G(() => { const g = window.game, m = g.mg; if (m && m._state.people) { const z = m._state; if (z.people.some(q => q.state === 'walk' && !q.busy && Math.abs(q.x - z.zoneX) < 30)) g.press('Space'); } g.step(20); });
  want(await p.G(() => !!document.querySelector('.mg-res')), '미니게임이 끝나지 않음');
  await p.step(60); await p.page.keyboard.press('Space'); await p.step(30);
  want(await p.page.locator('.quest-finished').count() === 1 &&
    /1 \/ 1회/.test(await p.page.textContent('#veil .quest-objective')) &&
    /받은 보상.*체력 \+10/.test(await p.page.textContent('#veil .quest-payment')), '첫 알바 뒤에 완료 진행도와 받은 보상이 보여야 함');
  await p.shot('tut03_quest_done'); await p.closeAll();
  s = await p.st(); b = await p.box();
  want(s.coach === 'slots' && s.slot === 1, '첫 알바 뒤 안내가 "세 칸"이 아님: ' + JSON.stringify(s)); geometry(b, 'slots'); log.push('2 ' + b.label + ' — ' + b.text);
  want(b.rings.length === 2, '세 칸 안내의 고리가 둘(오늘 · 체력)이 아님');
  await p.shot('tut04_slots');
  want((await p.st()).cash >= 15000, '이 검사는 찜질방 요금이 있을 때만 뜻이 있음: 현금 ' + (await p.st()).cash);
  await p.G(() => window.game.run('move', '1')); await p.step(10); want((await p.st()).tier === 0, '오늘 칸을 짚는 동안 이사가 됨 (찜질방 안내를 건너뛰게 됨)');
  // 같은 알바는 하루 한 번: 오늘 한 전단지는 "오늘 마감"으로 닫히고, 눌러도 시작 전 화면이 아니라 이유가 뜬다
  { const c = await p.G(() => { const e = document.querySelector('#today .card.closed'); return e ? { t: e.textContent, why: e.dataset.do + ':' + e.dataset.arg, skip: !!e.querySelector('[data-do="skip"]') } : null; });
    want(c && /전단지/.test(c.t) && /오늘 마감/.test(c.t) && /^why:오늘은 이 알바를 마쳤습니다/.test(c.why) && !c.skip, '오늘 한 전단지 카드가 "오늘 마감"으로 닫히지 않음: ' + JSON.stringify(c)); }
  await p.G(() => window.game.run('job', 'flyer')); await p.step(4);
  s = await p.st(); want(!s.modal && s.slot === 1 && /오늘은 이 알바를 마쳤습니다/.test(await p.page.textContent('#toasts')), '오늘 이미 한 전단지가 또 열리거나 이유가 안 뜸: ' + JSON.stringify(s));
  await p.G(() => window.game.run('skip', 'flyer')); await p.step(4); want((await p.st()).slot === 1, '오늘 이미 한 전단지가 "대충"으로 또 됨');
  await p.G(() => window.game.run('rest')); await p.step(30); await p.closeAll();
  want((await p.st()).coach === 'slots' && (await p.st()).slot === 2, '둘째 칸 뒤에도 "세 칸" 안내여야 함');
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
  want((await p.page.locator('#board .tabs .newly-unlocked').evaluateAll(tabs => tabs.map(tab => tab.dataset.arg))).join() === 'stock,info', '찜질방을 열었을 때 주식과 뉴스 탭에 해금 표시가 없음');
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
  // 해 본 알바(전단지)는 날이 바뀌면 다시 열리고, "처음 하는 알바" 머리글 없이 바로
  await p.G(() => window.game.run('job', 'flyer')); await p.step(4);
  s = await p.st(); want(s.modal === 'mg' && s.pre && !(await p.G(() => /처음 하는 알바/.test(document.querySelector('.mg-how').textContent))), '해 본 알바인데 (둘째 날) 시작 전 화면이 없거나 "처음 하는 알바"가 또 붙음: ' + JSON.stringify(s));
  await p.G(() => window.game.press('Space')); await p.step(4); await finishMg(p); await p.step(60); await p.closeAll();
  want((await p.st()).slot === 1, '둘째 날 전단지를 했는데 칸이 안 쓰임');
  // 처음 하는 다른 알바: 하는 법이 뜨고, 눌러서(마우스) 시작
  await p.G(() => window.game.run('job', 'loading')); await p.step(30);
  want((await p.st()).pre, '처음 하는 상하차에 시작 전 화면이 안 뜸'); await p.shot('tut09_pre_loading');
  await p.page.click('[data-do="mgstart"]'); await p.step(4); want(!(await p.st()).pre, '"시작" 버튼으로 시작되지 않음');
  await finishMg(p); await p.step(60); await p.closeAll();
  // 주식 · 코인 설명: 처음 그 탭을 열 때 한 번만
  await p.G(() => { const S = window.game.state.raw; S.tier = 2; S.cash = 2330000; S.day = 5; S.movedDay = 3; S.quest = 4; window.game.render(); window.game.run('tab', 'stock'); }); await p.step(30); await p.closeAll();
  s = await p.st(); b = await p.box();
  want(s.coach === 'stock', '주식 탭을 처음 열 때 설명이 안 뜸: ' + JSON.stringify(s)); geometry(b, 'stock'); want(b.rings.length === 3, '주식 설명의 고리가 셋이 아님'); log.push(b.label + ' — ' + b.text);
  want(await p.page.locator('#board [data-arg="stock"].newly-unlocked').count() === 0 && await p.page.locator('#board [data-arg="info"].newly-unlocked').count() === 1, '열어 본 탭의 해금 표시만 사라져야 함');
  await p.shot('tut10_stock');
  await p.G(() => window.game.run('buy', '100000')); await p.step(10); want(await p.G(() => window.game.state.raw.stats.bought === 0), '주식 설명을 읽기 전에 사짐');
  await p.page.click('[data-do="coachok"]'); await p.step(30);
  want(!(await p.st()).coach, '주식 설명이 닫히지 않음');
  await p.G(() => { window.game.run('roadmap'); window.game.step(20); window.game.run('ok'); window.game.step(20); window.game.render(); window.game.run('tab', 'stock'); }); await p.step(30); want(!(await p.st()).coach, '주식 설명이 또 뜸');
  await p.G(() => window.game.run('buy', '100000')); await p.step(10); want(await p.G(() => window.game.state.raw.stats.bought > 0), '설명을 닫은 뒤에도 못 삼');
  await p.closeAll();
  // 코인: 처음 탭을 열면 설명 대신 연습 창 (진짜 돈 아님) — 박자마다 맞는 버튼만 · 움직이는 동안 안 넘어감 · 결과 숫자 = 규칙의 식 · 판 상태 그대로 · 한 번만 · "연습"으로 다시 · 건너뛰기
  await p.G(() => {
    const g = window.game, S = g.state.raw;
    S.tier = 3; S.cash = 9200000; S.day = 15; S.movedDay = 12; g.render();
    window.__S0 = JSON.stringify({ ...S, seenTabs: [...S.seenTabs, 'coin'] });
    g.run('tab', 'coin');
  }); await p.step(30);
  s = await p.st();
  want(s.modal === 'drill' && !s.coach, '코인 탭을 처음 열 때 연습 창이 안 뜸: ' + JSON.stringify(s));
  want(await p.G(() => window.__S0 === JSON.stringify(window.game.state.raw)), '코인 탭을 처음 열었을 때는 탭 확인 기록만 바뀌어야 함');
  const D = () => p.G(() => { const g = window.game, w = document.querySelector('#veil .win.drill'), t = sel => ((w && w.querySelector(sel)) || {}).textContent || '';
    const sr = document.getElementById('stage').getBoundingClientRect(), r = w ? w.getBoundingClientRect() : null;
    const small = w ? [...w.querySelectorAll('*')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 13.99).length : 0;
    return { modal: g.state.modal, d: g.state.drill, n: t('.drill-n'), ask: t('.drill-ask'), res: t('.drill-res'), now: t('#drillnow'), h3: t('h3'), in: !!r && r.left >= sr.left && r.top >= sr.top && r.right <= sr.right && r.bottom <= sr.bottom, over: w ? w.scrollWidth - w.clientWidth : 0, small,
      btns: [...document.querySelectorAll('#veil [data-do="drillgo"]')].map(e => e.dataset.arg + (e.disabled ? ':off' : ':on')) }; });
  const want3 = await p.G(() => { const R = window.Rules, v = (dir, chg) => Math.round(R.levValue({ lev: { dir, lev: 3, put: 100000, margin: 100000, entry: 1000 }, market: { px: { coin: 1000 * (1 + chg) } } })) - 100000; return [v(1, 0.06), v(-1, -0.06), v(1, -0.34)].map(n => (n >= 0 ? '+' : '') + R.won(n)); }); // 규칙의 식으로 셈한 연습 결과
  const beats = [['long', 'Digit1', 'Digit2', /\+18,000원/, /6% × 3배/], ['short', 'Digit2', 'Digit1', /\+18,000원/, /숏은 내려도 번다/], ['long', 'Digit1', 'Digit2', /청산/, /100,000원이 전부 사라짐.*33% 거꾸로/]];
  want(want3.join('|') === '+18,000원|+18,000원|−100,000원', '연습의 셈이 규칙(levValue)과 다름: ' + want3.join('|'));
  for (let i = 0; i < 3; i++) {
    const [side, ok, no, r1, r2] = beats[i];
    let d = await D();
    want(d.d && d.d.beat === i && d.d.ph === 'ask' && d.n === (i + 1) + ' / 3', '연습 ' + (i + 1) + '박자가 아님: ' + JSON.stringify(d));
    want(d.in && d.over <= 1 && !d.small, '연습 창이 화면 밖 · 넘침 · 작은 글자: ' + JSON.stringify(d));
    if (!i) await p.shot('tut11_drill_ask');
    await p.page.keyboard.press(no); await p.step(4); d = await D();
    want(d.d.ph === 'ask' && /차례/.test(d.ask), (i + 1) + '박자: 다른 버튼(' + no + ')을 눌렀는데 넘어가거나 이유가 없음: ' + JSON.stringify(d));
    await p.page.click('[data-do="drillgo"][data-arg="' + (side === 'long' ? 'short' : 'long') + '"]'); await p.step(4);
    want((await D()).d.ph === 'ask', (i + 1) + '박자: 다른 버튼을 마우스로 눌렀는데 넘어감');
    if (!i) await p.shot('tut11b_drill_why');
    await p.page.keyboard.press(ok); await p.G(() => window.game.step(10)); d = await D();
    want(d.d.ph === 'move', (i + 1) + '박자: 맞는 버튼(' + ok + ')을 눌렀는데 차트가 안 움직임: ' + JSON.stringify(d.d));
    await p.G(() => { const g = window.game; for (const k of ['Space', 'Enter', 'Digit1', 'Digit2', 'Escape']) { g.press(k); g.step(3); } }); d = await D(); // 움직이는 동안 연타
    want(d.modal === 'drill' && d.d.ph === 'move' && d.d.beat === i, (i + 1) + '박자: 차트가 움직이는 동안 넘어가거나 닫힘: ' + JSON.stringify(d.d));
    if (!i) await p.shot('tut11c_drill_move');
    await p.G(() => window.game.step(110)); d = await D();
    want(d.d.ph === 'show' && r1.test(d.res) && r2.test(d.res), (i + 1) + '박자 결과가 다름: ' + d.res);
    want(i < 2 ? d.now === '118,000원' : d.now === '0원', (i + 1) + '박자 "지금" 값이 다름: ' + d.now);
    await p.shot('tut11d_drill_res' + (i + 1));
    await p.page.keyboard.press('Space'); await p.step(20);
  }
  let dd = await D();
  want(dd.d && dd.d.ph === 'end' && /진짜 돈은 아래에서 건다/.test(dd.h3), '세 박자 뒤 마무리 창이 아님: ' + JSON.stringify(dd));
  await p.shot('tut11e_drill_end');
  await p.page.keyboard.press('Space'); await p.step(30);
  want(!(await p.st()).modal && await p.G(() => window.game.meta.seen.coin === 1), '연습을 마쳤는데 창이 남거나 본 것으로 안 남음');
  want(await p.G(() => window.__S0 === JSON.stringify(window.game.state.raw)), '연습이 판 상태(돈 · 시세 · 난수)를 바꿈');
  await p.G(() => { window.game.run('tab', 'stock'); window.game.run('tab', 'coin'); }); await p.step(20);
  want(!(await p.st()).modal && !(await p.st()).coach, '연습 창이 또 뜸 (한 번만이어야 함)');
  await p.page.click('#board [data-do="drill"]'); await p.step(20);
  dd = await D(); want(dd.modal === 'drill' && dd.d.beat === 0, '코인 탭의 "연습" 버튼으로 다시 열리지 않음');
  await p.page.keyboard.press('Escape'); await p.step(20); want(!(await p.st()).modal, 'Esc 로 건너뛰어지지 않음');
  await p.page.click('#board [data-do="drill"]'); await p.step(20); await p.page.click('[data-do="drillgo"][data-arg="long"]'); await p.G(() => window.game.step(4)); // 막음을 기다리지 않는 걸음 (움직이는 동안을 보려고)
  await p.page.click('[data-do="drillskip"]'); await p.G(() => window.game.step(4)); want((await p.st()).modal === 'drill' && (await p.G(() => window.game.state.drill.ph)) === 'move', '차트가 움직이는 동안 "건너뛰기"가 눌림');
  await p.G(() => window.game.step(120)); await p.page.click('[data-do="drillskip"]'); await p.step(20); want(!(await p.st()).modal, '"건너뛰기" 버튼으로 닫히지 않음');
  want(await p.G(() => window.__S0 === JSON.stringify(window.game.state.raw)), '연습을 다시 해도 판 상태가 바뀜');
  log.push('코인 연습 — 세 박자 ' + want3.join(' · '));
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
  s = await p.st(); want(s.modal === 'mg' && s.pre && !(await p.G(() => /처음 하는 알바/.test(document.querySelector('.mg-how').textContent))), '안내를 껐는데 "처음 하는 알바" 머리글이 붙거나 시작 전 화면이 없음');
  await p.page.close();

  // ── 4. 안내를 안 쓰는 점검 창에는 아무것도 안 뜸 ──
  p = await open('manual=1&scene=play&seed=5'); await p.start();
  s = await p.st(); want(!s.coach && !s.tut, '?manual=1 에 안내가 뜸');
  await p.G(() => window.game.run('job', 'flyer')); await p.step(4); want((await p.st()).pre && !(await p.G(() => /처음 하는 알바/.test(document.querySelector('.mg-how').textContent))), '?manual=1 에 "처음 하는 알바" 머리글이 붙음');
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
    const st = () => page.evaluate(() => { const s = window.game.state; return { scene: window.game.scene, day: s.day, slot: s.slot, coach: s.coach, tut: s.tut, modal: s.modal, pre: s.pre, int: s.int, mt: window.game.meta.tut, first: !!document.querySelector('.mg-how') && /처음 하는 알바/.test(document.querySelector('.mg-how').textContent) }; });
    const wait = ms => page.waitForTimeout(ms);
    const load = async q => { await page.goto('file://' + path.join(dir, 'index.html') + '?' + (q || query)); await wait(450); };
    const fresh = async () => { await page.click('[data-do="new"]'); await wait(300); if (await page.evaluate(() => window.game.scene) === 'title') { await page.click('[data-do="new"]'); await wait(300); } await advanceOpening(page); await wait(700); }; // 저장이 있으면 한 번 더 눌러야 시작
    const resume = async () => { await page.click('[data-do="continue"]'); await wait(700); };
    const quit = async () => { await page.click('#hud [data-do="quit"]'); await wait(400); };
    const clear = async () => {
      for (let i = 0; i < 6 && (await st()).modal; i++) {
        if ((await st()).modal === 'perk') await confirmPerk(page); else await page.click('#veil [data-do="ok"]');
        await wait(750);
      }
    };
    await load();
    return { ctx, page, st, wait, load, fresh, resume, quit, clear };
  };
  { // 처음 연 사람: 안내가 뜨고, 새로 고쳐 이어 해도 이어지고, 끄면 다음 판에 안 뜨고, 제목 화면에서 다시 켠다
    const r = await real('seed=5');
    want(await r.page.locator('[data-do="tuttoggle"]').count() === 1 && /켜짐/.test(await r.page.textContent('[data-do="tuttoggle"]')), '제목 화면에 "첫 판 안내 켜짐"이 없음');
    await r.page.screenshot({ path: path.join(out, 'tut13_title.png') });
    await r.page.click('[data-do="new"]');
    await advanceOpening(r.page, 3);
    await r.load();
    await r.page.locator('[data-do="new"]').press('Enter');
    await r.page.evaluate(() => window.game.step(1));
    want((await r.st()).scene === 'title' && /하던 판을 지우고/.test(await r.page.textContent('[data-do="new"]')),
      '새로 시작에서 Enter를 눌렀는데 새 판 확인 대신 하던 판이 열림');
    await r.page.keyboard.press('Enter');
    want(await r.page.textContent('#opening-title') === '서울역 벤치', '새 판을 Enter로 확정하면 프롤로그부터 열려야 함');
    await advanceOpening(r.page, 3);
    const desktop = r.page.viewportSize();
    await r.page.setViewportSize({ width: 390, height: 760 });
    await r.page.waitForSelector('body > #veil.dream-veil');
    await r.page.waitForFunction(() => window.game.state.guard === 0);
    await r.page.click('#veil [data-do="dream"][data-arg="sign"]');
    want(/첫 사업 시작/.test(await r.page.textContent('#veil .dream-path')), '모바일에서 꿈을 고르면 해금 경로가 바뀌어야 함');
    await advanceOpening(r.page, 4);
    want(await r.page.locator('body > #veil.opening-veil .quest-layout').count() === 1, '좁은 화면의 첫 퀘스트는 화면 크기에 맞아야 함');
    await r.page.setViewportSize(desktop);
    await r.page.waitForSelector('#stage > #veil.opening-veil');
    await r.load(); await r.resume();
    want(await r.page.evaluate(() => {
      const s = window.game.state.raw;
      return s.opening?.step === 4 && s.opening.gift === 'sign' && !s.dreamSet;
    }), '중간에 새로 고치면 마지막 안내창과 꿈 선택이 남아야 함');
    await advanceOpening(r.page); await r.wait(700);
    want(await r.page.evaluate(() => window.game.state.raw.dream === 'sign'), '첫날 시작에 고른 꿈이 적용되지 않음');
    s = await r.st(); want(s.coach === 'job' && s.mt === 1, '처음 연 사람에게 안내가 안 뜸: ' + JSON.stringify(s));
    await r.load(); // 아무것도 하지 않고 새로 고침: 방금 시작한 판이 저장되어 있어야 한다
    want(await r.page.locator('[data-do="continue"]').count() === 1, '새 판을 시작하자마자 새로 고치면 이어하기가 없음');
    await r.resume();
    s = await r.st(); want(s.coach === 'job' && s.day === 1, '이어하기에서 안내가 이어지지 않음: ' + JSON.stringify(s));
    await r.page.click('#today [data-arg="flyer"]', { position: { x: 30, y: 80 } }); await r.wait(500);
    want((await r.st()).pre, '시작 전 화면이 안 뜸 (실제 저장)');
    await r.page.keyboard.press('ArrowRight'); await r.wait(200); want((await r.st()).int === 2, '→ 로 강도가 상으로 안 바뀜 (실제 저장)');
    await r.load(); await r.resume(); // 시작 전에 새로 고침: 칸을 쓰지 않고 그 자리 그대로
    s = await r.st(); want(s.slot === 0 && s.coach === 'job', '시작 전에 새로 고치면 알바를 "대충" 한 것으로 처리됨: ' + JSON.stringify(s));
    await r.page.click('#today [data-arg="flyer"]', { position: { x: 30, y: 80 } }); await r.wait(600);
    want((await r.st()).int === 2, '고른 강도(상)가 새로 고친 뒤 기억되지 않음: ' + JSON.stringify(await r.st()));
    await r.page.click('[data-do="mgstart"]'); await r.wait(300);
    await r.load(); await r.resume(); // 시작한 뒤에 새로 고침: 예전처럼 "대충" 처리
    s = await r.st(); want(s.slot === 1, '시작한 알바를 하다가 새로 고쳤는데 칸이 그대로: ' + JSON.stringify(s));
    await r.clear();
    const again = () => r.page.evaluate(() => { const g = window.game; g.state.raw.did = null; g.render(); }); // 같은 알바는 하루 한 번 — 이 검사는 같은 날 다시 열어 봐야 하므로 오늘 한 것을 지운다
    want(await r.page.evaluate(() => !!document.querySelector('#today .card.closed')), '시작한 뒤 새로 고쳐 "대충" 처리된 전단지가 오늘 마감으로 닫히지 않음'); await again();
    await r.page.click('#today [data-arg="flyer"]', { position: { x: 30, y: 80 } }); await r.wait(500);
    s = await r.st(); want(s.modal === 'mg' && s.pre && !s.first, '해 본 알바에 새로 고친 뒤 "처음 하는 알바"가 또 붙음 (본 것이 남지 않음): ' + JSON.stringify(s));
    await r.load(); await r.resume(); await r.clear();
    { // 하만 되는 체력으로 하로 시작 → 하는 중에 새로 고침: 공짜로 다시 하지 않게 칸 · 체력(하만큼)이 쓰인다
      await again();
      const b0 = await r.page.evaluate(() => { const S = window.game.state.raw, L = window.Rules.acts(S).find(a => a.id === 'flyer').levels; S.hp = L[0].hp; window.game.render(); return { slot: S.slot, hp: S.hp, cash: S.cash, ok: window.Rules.acts(S).find(a => a.id === 'flyer').ok }; }); // ok = 중(대충)을 할 체력
      await r.page.click('#today [data-arg="flyer"]', { position: { x: 30, y: 80 } }); await r.wait(600);
      want((await r.st()).int === 0 && !b0.ok, '하만 되는 체력인데 시작 전 화면이 하로 열리지 않음: ' + JSON.stringify(await r.st()));
      await r.page.click('[data-do="mgstart"]'); await r.wait(300);
      await r.load(); await r.resume();
      const a0 = await r.page.evaluate(() => { const S = window.game.state.raw; return { slot: S.slot, hp: S.hp, cash: S.cash, pending: S.pending }; });
      want(a0.slot === b0.slot + 1 && a0.hp === 0 && a0.cash > b0.cash && !a0.pending, '하만 되는 체력으로 하로 시작해 하는 중에 새로 고쳤는데 칸 · 체력이 그대로 (공짜로 다시 함): ' + JSON.stringify({ b0, a0 }));
      log.push('하로 시작해 하는 중에 새로 고침: 칸 ' + b0.slot + ' → ' + a0.slot + ' · 체력 ' + b0.hp + ' → ' + a0.hp + ' · 현금 +' + (a0.cash - b0.cash));
      await r.clear(); }
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
  { // 보기 전에 새로 고친 창 · 끝난 저장: 1막 끝 · 사업 확장 창을 닫기 전에 새로 고치면 이어 할 때 다시 뜨고(닫은 뒤엔 안 뜸), 끝난 판의 저장은 이어하기로 열리지 않는다
    const r = await real('seed=5&tut=0');
    await r.fresh();
    const upto = async want2 => {
      for (let i = 0; i < 5; i++) {
        const m = (await r.st()).modal; if (!m || m === want2) return m;
        if (m === 'perk') await confirmPerk(r.page); else await r.page.click('#veil [data-do="ok"]');
        await r.wait(750);
      }
      return (await r.st()).modal;
    };
    await r.page.evaluate(() => { const g = window.game, S = g.state.raw; S.tier = 3; S.stats.maxTier = 3; S.movedDay = 1; S.cash = 20000000; S.quest = 11; S.offer = null; S.picks = 0; S.event = null; g.render(); g.run('house'); g.step(30); g.press('Enter'); g.step(40); });
    want(await upto('act1') === 'act1', '내 집을 샀는데 1막 끝 창이 안 뜸');
    await r.load(); await r.resume();
    want(await upto('act1') === 'act1', '1막 끝 창을 닫기 전에 새로 고쳤더니 이어 할 때 다시 안 뜸');
    await r.page.click('#veil [data-do="ok"]'); await r.wait(750); await upto('');
    await r.load(); await r.resume();
    want(!(await r.st()).modal, '본 1막 끝 창이 이어 할 때 또 뜸: ' + (await r.st()).modal);
    await r.page.evaluate(() => { const g = window.game, S = g.state.raw; S.cash = 900000000; S.offer = null; S.picks = 0; S.event = null; g.render(); g.run('bizup'); g.step(40); g.press('Enter'); g.step(40); });
    want(await upto('biz') === 'biz', '사업을 키웠는데 사업 확장 창이 안 뜸');
    await r.load(); await r.resume();
    want(await upto('biz') === 'biz', '사업 확장 창을 닫기 전에 새로 고쳤더니 이어 할 때 다시 안 뜸');
    await r.page.click('#veil [data-do="ok"]'); await r.wait(750);
    await r.page.evaluate(() => { const S = window.game.state.raw; S.ended = { kind: 'top', day: 80, worth: 1, rank: 'B' }; localStorage.setItem('seoul-station-save-v1', window.Rules.save(S)); }); // 예전 버전에서 끝난 판이 저장돼 있는 경우
    await r.load();
    want(await r.page.locator('[data-do="continue"]').count() === 0 && !(await r.page.evaluate(() => localStorage.getItem('seoul-station-save-v1'))), '끝난 판의 저장이 제목 화면에 이어하기로 남음');
    log.push('보기 전에 새로 고친 창(1막 끝 · 사업 확장)은 이어 할 때 다시 뜸 · 끝난 저장은 지움');
    await r.ctx.close();
  }

  await browser.close();
  console.log(JSON.stringify({ errors: errs, log }, null, 1));
  if (errs.length) process.exitCode = 1;
})().catch(e => { console.error('FAIL', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
