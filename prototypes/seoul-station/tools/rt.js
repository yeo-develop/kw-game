// PROTOTYPE - NOT FOR PRODUCTION
// 게임이 불러오지 않는 개발용 도구. 화면 없는 브라우저(Playwright)는 KW_PLAYWRIGHT 환경 변수로 위치를 줄 수 있다.
// 실제 시간 · 실제 클릭으로 첫 이틀을 해 보는 점검 (사람이 하듯: 클릭 사이에 기다림). 창 없이 돈다.
// node rt.js <게임 폴더> <찍을 폴더>
const path = require('path'), fs = require('fs');
const { chromium } = require(process.env.KW_PLAYWRIGHT || '/Users/admin/projects/outsourcing/high-order-front/node_modules/playwright');
const dir = path.resolve(process.argv[2] || path.join(__dirname, '..')), out = process.argv[3] || path.join(dir, 'evidence', 'rt');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errs = [], log = [];
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  page.on('pageerror', e => errs.push('uncaught: ' + e.message));
  const url = 'file://' + path.resolve(dir, 'index.html') + '?seed=5';
  await page.goto(url);
  const st = () => page.evaluate(() => { const s = window.game.state; return { scene: window.game.scene, day: s.day, slot: s.slot, cash: s.cash, hp: s.hp, tier: s.tier, quest: s.quest, modal: s.modal }; });
  const wait = ms => page.waitForTimeout(ms);
  const shot = n => page.screenshot({ path: path.join(out, n + '.png') });
  const note = async t => { const s = await st(); log.push(t + ' → ' + JSON.stringify(s)); return s; };
  const clear = async () => { // 떠 있는 창을 종류에 맞게 닫고(특성은 첫째 카드, 돌발 사건은 둘째 선택 뒤 확인), 본 창의 종류를 차례로 돌려줌
    const seen = []; let last = '';
    for (let i = 0; i < 16; i++) {
      const m = (await st()).modal; if (!m) break;
      const sig = m + ':' + await page.evaluate(() => (document.querySelector('#veil h3, #veil .qdone b') || {}).textContent || ''); // 같은 종류라도 제목이 다르면 다른 창
      if (sig !== last) { seen.push(m); last = sig; }
      if (m === 'perk') await page.click('.pcard'); else if (m === 'event' && await page.locator('[data-do="ev"]').count()) await page.click('[data-do="ev"][data-arg="b"]'); else await page.click('#veil [data-do="ok"]');
      await wait(750);
    }
    return seen;
  };
  const mgButtons = () => page.evaluate(() => Array.from(document.querySelectorAll('[data-mg]')).map(b => b.dataset.mg + ':' + b.textContent.trim()));
  await wait(500); await page.fill('#name', '동여'); await shot('rt01_title');
  await page.click('text=새로 시작'); await wait(700); await shot('rt02_intro'); await note('새로 시작');
  await page.click('[data-do="ok"]'); await wait(600); await note('시작 확인');
  await shot('rt03_first_screen');
  // 전단지: 카드를 두 번 연달아 눌러도 한 번만 시작
  await page.dblclick('[data-do="job"][data-arg="flyer"]', { position: { x: 30, y: 80 } }); await wait(400);
  let s = await note('전단지 두 번 누름');
  if (s.modal !== 'mg') errs.push('미니게임이 열리지 않음');
  const title = await page.textContent('.mg-head b'); const howto = await page.textContent('.mg-head span');
  log.push('미니게임: ' + title + ' / ' + howto + ' / 버튼: ' + (await mgButtons()).join(' | '));
  for (let i = 0; i < 16; i++) { await wait(560); if (i === 5) await shot('rt04_minigame_mid'); if (await page.locator('.mg-res').count()) break; await page.keyboard.press('Space'); }
  await page.waitForSelector('.mg-res', { timeout: 6000 });
  await page.keyboard.press('Space'); await wait(150); // 미니게임의 마지막 누름: 결과 창이 바로 닫히면 안 됨
  if ((await st()).modal !== 'mg') errs.push('결과 창이 뜨자마자 닫힘');
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Space'); await wait(150); } // 1.8초 동안 연타
  if ((await st()).modal !== 'mg' || !(await page.locator('.mg-res').count())) errs.push('연타로 결과 창이 넘어감');
  await wait(500); await shot('rt05_minigame_result');
  const res = await page.textContent('.mg-res'); log.push('결과: ' + res.replace(/\s+/g, ' '));
  // 결과가 뜨자마자 Space 를 연타해도 퀘스트 창까지 한꺼번에 닫히지 않아야 함
  await page.keyboard.press('Space'); await wait(60); await page.keyboard.press('Space'); await wait(120); // 멈췄다 누른 첫 번째만 듣는다
  s = await note('결과에서 Space 두 번');
  for (let i = 0; i < 8; i++) { await page.keyboard.press('Space'); await wait(150); } // 이어지는 연타도 다음 창을 넘기지 못한다
  s = await st();
  if (s.modal !== 'quest') errs.push('퀘스트 완료 창이 떠 있어야 하는데: ' + s.modal);
  await shot('rt06_quest_done');
  await clear();
  // 화면 버튼(마우스)만으로 미니게임 하기: 상하차
  await page.click('[data-do="job"][data-arg="loading"]', { position: { x: 30, y: 80 } }); await wait(1000);
  log.push('상하차 화면 버튼: ' + (await mgButtons()).join(' | '));
  for (let i = 0; i < 14; i++) {
    await wait(500); if (await page.locator('.mg-res').count()) break;
    const bs = page.locator('[data-mg]'); const n = await bs.count(); if (n) await bs.nth(i % n).dispatchEvent('pointerdown');
    if (i === 6) await shot('rt07_loading_mid');
  }
  await page.waitForSelector('.mg-res', { timeout: 6000 }); await wait(1100); await page.click('#veil [data-do="ok"]'); await wait(500);
  if ((await st()).modal === 'perk') await shot('rt07b_level_up');
  await clear();
  s = await note('상하차 뒤');
  await clear();
  // "대충"을 빠르게 세 번: 한 칸만 써야 하고, 같은 자리에 생긴 "하루 마치기"까지 눌리면 안 됨
  { const b = await page.locator('[data-do="skip"][data-arg="flyer"]').boundingBox(); for (let i = 0; i < 3; i++) { await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await wait(90); } }
  await wait(500); s = await note('대충 세 번 연타');
  if (s.slot !== 3 || s.modal === 'night') errs.push('연타가 칸을 여러 개 쓰거나 밤으로 넘어감: slot ' + s.slot + ' modal ' + s.modal);
  await clear();
  await shot('rt08_day_done');
  await page.click('[data-do="endday"]'); await wait(700); await shot('rt09_night'); await note('하루 마치기');
  await page.keyboard.press('Space'); await wait(800);
  if ((await st()).modal) await shot('rt10_morning_popup');
  { // 2일째 아침에 뜨는 창을 세어 본다: 퀘스트 완료 한 장(+ 레벨이 올랐으면 특성 고르기)까지만
    const seen = await clear();
    log.push('2일째 아침에 뜬 창: ' + (seen.join(' → ') || '없음'));
    if (seen.filter(m => m === 'quest').length > 1) errs.push('퀘스트 완료 창이 여러 장: ' + seen.join(' → '));
    if (seen.indexOf('event') >= 0) errs.push('2일째 아침에 돌발 사건이 겹쳐 뜸: ' + seen.join(' → '));
    if (seen.length > 2) errs.push('2일째 아침에 창이 ' + seen.length + '장: ' + seen.join(' → '));
  }
  s = await note('2일째 아침');
  if (s.day !== 2) errs.push('2일째가 아님');
  // 찜질방으로 옮기기 (사다리 버튼)
  if (await page.locator('[data-do="move"]').count()) { await page.click('[data-do="move"]'); await wait(600); if ((await st()).modal) await shot('rt11_roof_quest'); await clear(); }
  s = await note('찜질방 이동'); await shot('rt12_sauna');
  // 저장: 새로 고침 뒤 이어하기
  await page.evaluate(() => { const S = window.game.state.raw; if (S.ach.indexOf('kind') < 0) S.ach.push('kind'); }); // 알림이 뜨기 전에 판 저장에만 들어간 업적을 흉내
  await page.click('#hud [data-do="quit"]'); await wait(400); // 나가면서 저장
  await page.reload(); await wait(600); await shot('rt13_title_continue');
  if (!(await page.locator('[data-do="continue"]').count())) errs.push('이어하기 버튼이 없음');
  else { await page.click('[data-do="continue"]'); await wait(600); const r = await note('이어하기'); if (r.day !== 2) errs.push('이어하기가 2일째가 아님: ' + r.day); }
  await shot('rt14_continued');
  // 업적 · 기록은 판 저장과 따로 남는다: 새로 고친 뒤에도 있고, 도감에서 보인다
  const metaAch = await page.evaluate(() => Object.keys(window.game.meta.ach).length);
  if (metaAch < 1) errs.push('새로 고친 뒤 업적이 남아 있지 않음'); log.push('남아 있는 업적 ' + metaAch + '개');
  if (!(await page.evaluate(() => window.game.meta.ach.kind))) errs.push('판 저장에만 있던 업적이 이어하기 때 기록에 맞춰지지 않음');
  await page.click('#hud [data-do="achs"]'); await wait(500); await shot('rt14a_achievements');
  if (!(await page.locator('.ach.got').count())) errs.push('도감에 얻은 업적이 안 보임');
  await page.click('#veil [data-do="ok"]'); await wait(400);
  await page.click('#hud [data-do="help"]'); await wait(500); await shot('rt14a_help'); await page.click('#veil [data-do="ok"]'); await wait(400);
  // 코인: "정리하기"를 두 번 눌러도 새 포지션이 열리면 안 됨 (원룸 상태로 건너뛰어 확인)
  await page.evaluate(() => { const S = window.game.state.raw; S.tier = 3; S.deposit = 5000000; S.cash = 3000000; window.game.run('tab', 'coin'); });
  await wait(400); await page.click('[data-do="long"]'); await wait(600);
  await clear(); // 건너뛴 탓에 밀린 퀘스트 창들
  if (!(await page.evaluate(() => !!window.game.state.raw.lev))) errs.push('롱이 열리지 않음');
  await shot('rt14b_coin_position');
  { const b = await page.locator('[data-do="close"]').boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await wait(80); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); }
  await wait(500);
  if (await page.evaluate(() => !!window.game.state.raw.lev)) errs.push('정리하기 두 번에 새 포지션이 열림');
  await clear();
  await shot('rt14c_coin_closed'); await note('코인 정리 두 번 누름');
  // 판 코드: 제목 화면에서 코드를 넣으면 그 판이 시작되고(저장이 있으면 한 번 더 눌러야 함), 결과 화면에서 카드를 복사할 수 있다
  await page.click('#hud [data-do="quit"]'); await wait(500);
  await page.fill('#code', 'ss-00a5'); await page.click('[data-do="new"]'); await wait(400);
  if (await page.evaluate(() => window.game.scene) !== 'title') errs.push('저장이 있는데 확인 없이 새 판이 시작됨');
  await page.click('[data-do="daily"]'); await wait(400); // 다른 버튼으로 넘어가면 그 버튼도 한 번 더 물어야 함
  if (await page.evaluate(() => window.game.scene) !== 'title') errs.push('"새로 시작"의 확인이 "오늘의 판"으로 새어 나감');
  await shot('rt14d_title_ask'); await page.fill('#code', 'ss-00a5'); await page.click('[data-do="new"]'); await wait(400);
  if (await page.evaluate(() => window.game.scene) !== 'title') errs.push('확인 없이 새 판이 시작됨 (오늘의 판 → 새로 시작)');
  await page.fill('#code', 'ss-00a5'); await page.click('[data-do="new"]'); await wait(700);
  const seed = await page.evaluate(() => window.game.state.raw && window.game.state.raw.seed);
  if (seed !== parseInt('00A5', 36)) errs.push('판 코드로 시작한 씨앗이 다름: ' + seed); log.push('판 코드 SS-00A5 → 씨앗 ' + seed);
  await clear();
  await page.evaluate(() => { const S = window.game.state.raw; S.cash = 50000000; window.game.render(); window.game.run('house'); }); await wait(600);
  await page.keyboard.press('Space'); await wait(600); // 확인 창에서 Space 는 늘 "돌아가기"
  if ((await st()).modal || await page.evaluate(() => window.game.scene) !== 'play') errs.push('계약 확인 창에서 Space 가 돌아가기가 아님');
  await page.evaluate(() => window.game.run('house')); await wait(600);
  await page.keyboard.press('Enter'); await wait(900); await shot('rt14e_results_home'); // Enter 가 "한다"
  const card = await page.evaluate(() => (document.querySelector('.e-card pre') || {}).textContent || '');
  if (!/판 코드 SS-00A5/.test(card)) errs.push('결과 카드에 판 코드가 없음: ' + card);
  await page.click('[data-do="copy"]'); await wait(400);
  const wins = await page.evaluate(() => window.game.meta.wins); if (wins < 1) errs.push('성공 기록이 남지 않음');
  await page.keyboard.press('Enter'); await wait(600); await shot('rt14f_title_records');
  await page.click('[data-do="new"]'); await wait(700); await clear();
  // 작은 창 · 큰 창: 통째로 늘고 주는지
  await page.setViewportSize({ width: 800, height: 450 }); await wait(400); await shot('rt15_small_800x450');
  await page.setViewportSize({ width: 1920, height: 1080 }); await wait(400); await shot('rt16_large_1080p');
  console.log(JSON.stringify({ errors: errs, log }, null, 1));
  if (errs.length) process.exitCode = 1;
  await browser.close();
})().catch(e => { console.error('FAIL', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
