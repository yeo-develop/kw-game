// PROTOTYPE - NOT FOR PRODUCTION
// 게임이 불러오지 않는 개발용 도구. 화면 없는 브라우저(Playwright)는 KW_PLAYWRIGHT 환경 변수로 위치를 줄 수 있다.
// 규칙 확인 (게임 폴더 밖). 기획서의 고리 · 압박 · 엔딩이 적힌 대로 도는지.
const path = require('path'), assert = require('assert');
const dir = require('path').resolve(process.argv[2] || require('path').join(__dirname, '..'));
global.window = {};
require(path.join(dir, 'config.js'));
const R = require(path.join(dir, 'rules.js'));
const C = window.CONFIG, T = new Proxy({}, { get: (_, k) => (C[k] && typeof C[k] === 'object' ? C[k].value : C[k]) });
R.setTune(T);
const M = 10000; let n = 0;
const ok = (name, fn) => { try { fn(); n++; console.log('통과', name); } catch (e) { console.log('실패', name, '\n   ', e.message); process.exitCode = 1; } };
const day = (s, f) => { while (s.slot < 3) f ? f(s) : R.doRest(s); R.endDay(s); R.nextDay(s); };

ok('새 판: 현금 0 · 서울역 · 퀘스트 1개 · 못 하는 알바는 안 보임', () => {
  const s = R.create(1, '');
  assert.equal(s.cash, 0); assert.equal(s.tier, 0); assert.equal(R.questView(s).id, 'first_job'); assert.equal(s.name, '나');
  assert.deepEqual(R.acts(s).map(a => a.id), ['flyer', 'loading', 'rest']);
  assert.equal(R.unlocked(s, 'stock'), false); assert.equal(R.buy(s, 'daejang', 100000), false);
});
ok('알바: 점수에 따라 일당 ×0.6~1.4, 체력 소모, 숙련도', () => {
  const s = R.create(1); R.doJob(s, 'flyer', 0.95); assert.equal(s.cash, Math.round(T.pay_flyer * T.mult_perfect / 1000) * 1000); assert.equal(s.hp, T.start_hp - T.hp_flyer + 10); // 첫 퀘스트 보상(삼각김밥 +10)까지
  const t = R.create(1); R.doJob(t, 'flyer', 0.1); assert.equal(t.cash, Math.round(T.pay_flyer * T.mult_miss / 1000) * 1000);
  const u = R.create(1); R.doJob(u, 'flyer', null); assert.equal(u.cash, Math.round(T.pay_flyer * T.mult_skip / 1000) * 1000);
  const v = R.create(1); v.hp = 100; v.jobs.flyer = T.skill_n1 - 1; R.doJob(v, 'flyer', 0.5); assert.equal(R.skill(v, 'flyer'), 1);
  const w = R.create(1); w.hp = 5; assert.equal(R.doJob(w, 'flyer', 1), false);
});
ok('퀘스트는 늘 하나, 끝내면 바로 다음 것 (첫 알바 → 삼각김밥 → 오늘을 버텨라)', () => {
  const s = R.create(1); R.doJob(s, 'flyer', 0.8);
  assert.equal(R.questView(s).id, 'survive'); assert.equal(s.hp, T.start_hp - T.hp_flyer + 10);
  assert.ok(s.ev.some(e => e.t === 'quest_done') && s.ev.some(e => e.t === 'quest_new'));
});
ok('밤: 끼니 · 잠(서울역 +25) · 굶으면 체력 깎임 · 다음 날 아침', () => {
  const s = R.create(1); R.doJob(s, 'flyer', 0.8); R.doRest(s); R.doRest(s);
  const cash = s.cash, hp = s.hp; R.endDay(s);
  assert.equal(s.cash, cash - T.meal_cost); assert.equal(s.hp, Math.min(100, hp + T.sleep_station)); assert.equal(s.phase, 'night');
  R.nextDay(s); assert.equal(s.day, 2); assert.equal(s.slot, 0); assert.equal(R.questView(s).id, 'roof');
  const t = R.create(1); t.hp = 50; day(t); assert.equal(t.hp, Math.min(100, 50 + 3 * T.rest_hp_station - T.meal_skip_hp + T.sleep_station));
});
ok('사다리: 찜질방(하룻밤 요금) → 고시원(보증금 · 주식/배달/공부 열림) → 원룸(코인 열림), 보증금은 순자산에 남음', () => {
  const s = R.create(1); s.cash = 100 * M;
  assert.equal(R.move(s, 2), false); assert.ok(R.move(s, 1)); assert.ok(R.acts(s).some(a => a.id === 'store'));
  const w = R.worth(s); assert.ok(R.move(s, 2)); assert.equal(R.worth(s), w); assert.equal(s.deposit, T.gosiwon_deposit);
  assert.ok(R.unlocked(s, 'stock') && R.acts(s).some(a => a.id === 'delivery') && R.acts(s).some(a => a.id === 'study'));
  assert.equal(R.unlocked(s, 'coin'), false); assert.equal(R.levOpen(s, 1, 10 * M, 3), false);
  s.cash = 600 * M; assert.ok(R.move(s, 3)); assert.equal(s.cash, 600 * M - (T.oneroom_deposit - T.gosiwon_deposit)); assert.ok(R.unlocked(s, 'coin'));
});
ok('고정비: 7일째 밤 청구, 입주한 날이 청구일이면 건너뜀, 연체 → 연체료, 연속 2회면 한 단계 내려가고 계좌 정리', () => {
  const s = R.create(1); s.cash = 200 * M; R.move(s, 1); R.move(s, 2);
  while (s.day < 7) day(s);
  assert.equal(R.bill(s).inDays, 0); const c = s.cash; while (s.slot < 3) R.doRest(s); R.endDay(s);
  assert.equal(s.cash, c - T.gosiwon_week); assert.equal(s.last.billed.paid, true); R.nextDay(s); // 고시원부터 끼니는 고정비에 들어 있음
  R.buy(s, 'daejang', s.cash); assert.ok(R.holdValue(s, 'daejang') > 0);
  while (s.day < 14) day(s);
  while (s.slot < 3) R.doRest(s); R.endDay(s); assert.equal(s.last.billed.paid, false); assert.equal(s.missed, 1); assert.ok(s.arrears > T.gosiwon_week); assert.equal(s.tier, 2); R.nextDay(s);
  while (s.day < 21) day(s);
  while (s.slot < 3) R.doRest(s); R.endDay(s); assert.equal(s.tier, 1); assert.equal(s.deposit, 0); assert.equal(s.hold.daejang.units, 0); assert.equal(s.arrears, 0);
  const t = R.create(1); t.cash = 200 * M; R.move(t, 1); while (t.day < 7) day(t); R.move(t, 2);
  assert.equal(R.bill(t).inDays, 0); assert.equal(R.bill(t).week, Math.round(T.gosiwon_week / 7 / 1000) * 1000); // 청구일에 입주하면 하루치만
});
ok('고정비: 맞춰 둔 현금으로 딱 내진다 (끼니가 먼저 빠져 연체되는 일 없음)', () => {
  const s = R.create(1); s.cash = 200 * M; R.move(s, 1); R.move(s, 2); while (s.day < 7) day(s);
  while (s.slot < 3) R.doRest(s); s.cash = R.bill(s).amt; R.endDay(s);
  assert.equal(s.last.billed.paid, true); assert.equal(s.cash, 0); assert.equal(s.arrears, 0);
});
ok('청구일에 위로 이사해도 살던 곳 고정비는 산 날만큼 낸다 (공짜 주 없음)', () => {
  const s = R.create(1); s.cash = 2000 * M; R.move(s, 1); R.move(s, 2); while (s.day < 7) day(s);
  const info = R.moveInfo(s, 3); assert.equal(info.settle, Math.round(T.gosiwon_week * 6 / 7 / 1000) * 1000);
  const w = R.worth(s); R.move(s, 3); assert.equal(R.worth(s), w - info.settle);
  assert.equal(R.bill(s).week, Math.round(T.oneroom_week / 7 / 1000) * 1000);
});
ok('정산 장부: 못 낸 밤과 갚은 밤 모두 "투자 손익"에 고정비가 섞이지 않는다', () => {
  const s = R.create(1); s.cash = 200 * M; R.move(s, 1); R.move(s, 2); while (s.day < 7) day(s);
  while (s.slot < 3) R.doRest(s); s.cash = 0; s.today.startWorth = R.worth(s); R.endDay(s); // 현금을 비워 못 내게 함
  assert.equal(s.last.billed.paid, false); assert.equal(s.last.invest, 0); assert.equal(s.last.worthEnd - s.last.worthStart, -s.arrears);
  assert.equal(s.last.spent, s.arrears); R.nextDay(s);
  s.cash = 500 * M; s.today.startWorth = R.worth(s); while (s.day < 14) day(s);
  while (s.slot < 3) R.doRest(s); R.endDay(s);
  assert.equal(s.last.billed.paid, true); assert.equal(s.last.invest, 0); assert.equal(s.last.spent, T.gosiwon_week); assert.equal(s.arrears, 0);
});
ok('쫓겨날 때 빚은 보증금 · 현금 · 주식에서 받는다 (주식에 숨겨 두고 버티기 안 됨)', () => {
  const s = R.create(1); s.cash = 300 * M; R.move(s, 1); R.move(s, 2); R.buy(s, 'daejang', s.cash);
  const w0 = R.worth(s);
  while (s.day < 14) day(s);
  while (s.slot < 3) R.doRest(s); const before = R.worth(s); R.endDay(s);
  assert.equal(s.tier, 1); assert.equal(s.arrears, 0); assert.equal(s.hold.daejang.units, 0);
  assert.ok(R.worth(s) < before - T.gosiwon_week); assert.ok(w0 > 0);
});
ok('공부는 하루 한 번, 한탕바이오는 "가깝다/멀다"까지만, 이틀 연속 공부해도 어제 리포트가 오늘 소식에 남는다', () => {
  const s = R.create(4); s.tier = 2; assert.ok(R.doStudy(s)); assert.equal(R.doStudy(s), false);
  assert.equal(R.acts(s).find(a => a.id === 'study').ok, false);
  assert.deepEqual(Object.keys(R.intelView(s).ht).sort(), ['phase', 'soon']);
  let seen = 0;
  for (let seed = 1; seed < 40 && !seen; seed++) {
    const t = R.create(seed); t.tier = 2; R.doStudy(t); const n1 = R.intelView(t).items.length; R.doRest(t); R.doRest(t); R.endDay(t); R.nextDay(t);
    if (!n1 || !R.todayNews(t).length) continue;
    assert.ok(R.todayNews(t).every(n => n.report !== 0)); R.doStudy(t); // 오늘 또 공부해도
    assert.ok(R.todayNews(t).every(n => n.report !== 0), '어제 리포트 표시가 지워짐'); assert.ok(R.intelView(t)); seen = 1;
  }
  assert.ok(seen);
});
ok('대충 하면 숙련도가 안 오른다 (직접 한 횟수만 셈), 첫 퀘스트는 대충으로도 끝난다', () => {
  const s = R.create(1); s.hp = 100; for (let i = 0; i < 3; i++) { R.doJob(s, 'flyer', null); s.hp = 100; s.slot = 0; }
  assert.equal(R.skill(s, 'flyer'), 0); assert.ok(s.quest >= 1);
  for (let i = 0; i < T.skill_n1; i++) { R.doJob(s, 'flyer', 0.5); s.hp = 100; s.slot = 0; }
  assert.equal(R.skill(s, 'flyer'), 1);
});
ok('작전주 퀘스트: 한탕바이오를 이익 내고 팔면 끝난다', () => {
  const s = R.create(1); R.doJob(s, 'flyer', 0.8); day(s); s.cash = 200 * M; R.move(s, 1); R.move(s, 2);
  R.buy(s, 'daejang', 10 * M); R.doStudy(s); s.market.px.daejang *= 1.8; R.sell(s, 'daejang', 1);
  assert.equal(R.questView(s).id, 'pump');
  R.buy(s, 'hantang', 100 * M); s.market.px.hantang *= 1.3; R.sell(s, 'hantang', 1);
  assert.notEqual(R.questView(s).id, 'pump'); assert.ok(s.stats.htGain >= 10 * M);
});
ok('밤 정산이 떠 있는 동안과 엔딩 뒤에는 매매 · 이사 · 계약이 안 된다, 이상한 금액은 거절', () => {
  const s = R.create(1); s.tier = 3; s.cash = 5000 * M; while (s.slot < 3) R.doRest(s); R.endDay(s);
  assert.equal(R.buy(s, 'daejang', 10 * M), false); assert.equal(R.levOpen(s, 1, 10 * M, 2), false); assert.equal(R.buyHouse(s), false); assert.equal(s.ended, null);
  R.nextDay(s); assert.equal(R.buy(s, 'daejang', NaN), false); assert.equal(R.levOpen(s, 1, undefined, 3), false); assert.ok(Number.isFinite(s.cash));
  assert.ok(R.buyHouse(s)); assert.equal(R.buy(s, 'daejang', 10 * M), false);
});
ok('때를 놓친 퀘스트는 건너뛰어 "집을 사라"가 가려지지 않는다', () => {
  const s = R.create(1); R.doJob(s, 'flyer', 0.8); day(s); s.cash = 3000 * M; R.move(s, 1); R.move(s, 2); R.move(s, 3);
  assert.equal(R.questView(s).id, 'house'); assert.ok(s.ev.some(e => e.t === 'quest_skip'));
  const t = R.create(1); R.doJob(t, 'flyer', 0.8); day(t); t.cash = 700 * M; R.move(t, 1); R.move(t, 2); R.move(t, 3);
  assert.equal(R.questView(t).id, 'lev'); t.day = 22; R.doRest(t); assert.equal(R.questView(t).id, 'house'); // 마지막 주에는 집 퀘스트가 앞에
});
ok('집값: 매주 7% (2,500 → 2,675 → 2,862 → 3,063만), 순자산이 넘으면 계약 = 엔딩, 28일 밤이 지나면 실패', () => {
  const s = R.create(1);
  assert.deepEqual([1, 8, 15, 22].map(d => R.housePrice(s, d)), [2500, 2675, 2862, 3063].map(x => x * M));
  assert.equal(R.buyHouse(s), false); s.cash = 2500 * M; assert.ok(R.buyHouse(s)); assert.equal(s.ended.kind, 'home'); assert.equal(s.ended.rank, 'S');
  const t = R.create(2); while (!t.ended) day(t); assert.equal(t.ended.kind, 'fail'); assert.equal(t.ended.day, T.days);
});
ok('주식: 수수료 · 실현 손익 · 평가, 코인: 배율 · 청산 · 유지비', () => {
  const s = R.create(3); s.tier = 3; s.cash = 1000 * M;
  R.buy(s, 'daejang', 100 * M); assert.ok(Math.abs(R.holdValue(s, 'daejang') - 100 * M * (1 - T.fee)) < 5);
  s.market.px.daejang *= 1.1; const c = s.cash; R.sell(s, 'daejang', 1); assert.ok(s.cash - c > 108 * M && s.stats.gain > 8 * M);
  R.levOpen(s, 1, 100 * M, 5); const e = s.lev.entry; s.market.px.coin = e * 1.1; assert.ok(Math.abs(R.levValue(s) - s.lev.margin * 1.5) < 5);
  assert.equal(R.levOpen(s, 1, 10 * M, 2), false);
  s.market.px.coin = e * 0.75; s.market.chg.coin = 0; C.c_sigma.value = 0; R.doRest(s); C.c_sigma.value = 0.05;
  assert.equal(s.lev, null); assert.equal(s.stats.liq, 1); assert.ok(s.ev.some(x => x.t === 'liq'));
});
ok('공부: 내일 소식의 실제 방향을 미리 봄 (다음 날 소식에 표시됨)', () => {
  let found = false;
  for (let seed = 1; seed < 30 && !found; seed++) {
    const s = R.create(seed); s.tier = 2; R.doStudy(s); const iv = R.intelView(s); assert.ok(iv && iv.day === 2);
    R.doRest(s); R.doRest(s); R.endDay(s); R.nextDay(s);
    const news = R.todayNews(s); if (news.length && iv.items.length) { assert.ok(news.every(n => n.report !== 0)); found = true; }
    assert.equal(R.intelView(s), null);
  }
  assert.ok(found);
});
ok('저장 → 불러오기 뒤에도 같은 판이 이어진다 (같은 행동이면 같은 결과)', () => {
  const play = (s, k) => { for (let i = 0; i < k && !s.ended; i++) { if (s.phase === 'night') R.nextDay(s); else if (s.slot >= 3) R.endDay(s); else { const a = R.acts(s).find(x => x.kind === 'job' && x.ok); a ? R.doJob(s, a.id, 0.8) : R.doRest(s); } if (s.tier === 0 && s.cash > 5 * M) R.move(s, 1); if (s.tier === 1 && s.cash > 60 * M) R.move(s, 2); if (s.tier === 2 && s.cash > 80 * M) R.buy(s, 'buldak', 30 * M); } };
  const a = R.create(7); play(a, 40); const b = R.load(R.save(a)); play(a, 60); play(b, 60);
  assert.equal(R.worth(a), R.worth(b)); assert.equal(a.day, b.day); assert.ok(Number.isFinite(R.worth(a)));
});
ok('화면에 나오는 글에 "미래"가 없다 (규칙 · 화면 · 그림 · 미니게임 파일)', () => {
  const fs = require('fs');
  for (const f of ['rules.js', 'ui.js', 'index.html', 'config.js', 'art.js', 'minigames.js']) { const p = path.join(dir, f); if (fs.existsSync(p)) assert.ok(!/미래/.test(fs.readFileSync(p, 'utf8')), f + ' 에 "미래"'); }
});
console.log(n + '개 통과');
