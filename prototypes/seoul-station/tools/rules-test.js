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
C.event_p.value = 0; C.tip_p.value = 0; // 아래 확인들은 정확한 금액을 보므로 운에 딸린 것(돌발 사건 · 팁)은 끄고, 그것만 보는 확인에서 켠다
const M = 10000; let n = 0;
const withTune = (over, fn) => { const old = {}; for (const k in over) { old[k] = C[k].value; C[k].value = over[k]; } try { fn(); } finally { for (const k in old) C[k].value = old[k]; } };
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
  const s = R.create(1); R.doJob(s, 'flyer', 0.8); day(s); s.cash = 4000 * M; R.move(s, 1); R.move(s, 2); R.move(s, 3);
  assert.equal(R.questView(s).id, 'house'); assert.ok(s.ev.some(e => e.t === 'quest_skip'));
  const t = R.create(1); R.doJob(t, 'flyer', 0.8); day(t); t.cash = 700 * M; R.move(t, 1); R.move(t, 2); R.move(t, 3);
  assert.equal(R.questView(t).id, 'lev'); t.day = 22; R.doRest(t); assert.equal(R.questView(t).id, 'house'); // 마지막 주에는 집 퀘스트가 앞에
});
ok('집값: 매주 7% (3,100 → 3,317 → 3,549 → 3,798만), 순자산이 넘으면 계약 = 엔딩, 28일 밤이 지나면 실패', () => {
  const s = R.create(1);
  assert.deepEqual([1, 8, 15, 22].map(d => R.housePrice(s, d)), [3100, 3317, 3549, 3798].map(x => x * M));
  assert.equal(R.buyHouse(s), false); s.cash = 3100 * M; assert.ok(R.buyHouse(s)); assert.equal(s.ended.kind, 'home'); assert.equal(s.ended.rank, 'S');
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

ok('레벨: 알바 · 퀘스트 · 공부 · 이익이 경험치를 주고, 오르면 특성 셋 중 하나를 고른다 (같은 씨앗이면 같은 후보)', () => {
  const mk = () => { const s = R.create(11); s.hp = 100; R.doJob(s, 'loading', 0.95); R.doJob(s, 'flyer', 0.95); return s; };
  const a = mk(), b = mk();
  assert.ok(a.lv >= 2, 'Lv ' + a.lv); assert.ok(a.offer && a.offer.length === 3 && new Set(a.offer).size === 3);
  assert.deepEqual(a.offer, b.offer); assert.ok(a.ev.some(e => e.t === 'level') && a.ev.some(e => e.t === 'offer'));
  assert.equal(R.offerView(a).length, 3); assert.ok(R.offerView(a).every(p => p.name && p.desc && p.icon));
  const id = a.offer[0]; assert.equal(R.pickPerk(a, 'nope'), false); assert.ok(R.pickPerk(a, id)); assert.equal(R.perk(a, id), 1); assert.equal(a.offer, null);
  const c = R.load(R.save(a)); assert.equal(R.perk(c, id), 1); assert.equal(c.lv, a.lv);
  assert.ok(R.PERKS.length >= 10);
  const x = R.create(1), x0 = x.xp + x.lv * 1000; x.tier = 2; R.doStudy(x); assert.ok(x.xp + x.lv * 1000 > x0);
});
ok('특성 14개가 저마다 규칙을 바꾼다', () => {
  const P = id => { const s = R.create(3); s.tier = 3; s.cash = 1000 * M; s.perks[id] = 1; return s; }, base = () => { const s = R.create(3); s.tier = 3; s.cash = 1000 * M; return s; };
  assert.equal(R.hpMax(P('iron')), 100 + T.perk_iron);
  assert.equal(R.sleepGain(P('sleep')), R.sleepGain(base()) + T.perk_sleep);
  const pay = s => R.acts(s).find(a => a.id === 'flyer').pay; assert.equal(pay(P('hustle')), Math.round(T.pay_flyer * (1 + T.perk_hustle) / 1000) * 1000);
  { const a = base(), b = P('hands'); R.doJob(a, 'flyer', 0.65); R.doJob(b, 'flyer', 0.65); assert.ok(b.cash > a.cash, '금손'); }
  { const a = base(), b = P('lazy'); R.doJob(a, 'flyer', null); R.doJob(b, 'flyer', null); assert.equal(b.cash - a.cash, Math.round(T.pay_flyer * T.perk_lazy / 1000) * 1000); }
  { const a = base(), b = P('streak'); for (const s of [a, b]) { s.hp = 100; R.doJob(s, 'flyer', 0.8); s.slot = 0; s.cash = 0; R.doJob(s, 'flyer', 0.8); } assert.ok(b.cash > a.cash, '리듬'); }
  assert.equal(R.mealCost(P('thrift')), Math.round(T.meal_cost * (1 - T.perk_thrift) / 1000) * 1000); assert.ok(R.weekCost(P('thrift')) < R.weekCost(base())); assert.ok(R.saunaCost(P('thrift')) <= R.saunaCost(base()));
  { const s = P('early'); s.hp = 10; while (s.slot < 3) R.doRest(s); R.endDay(s); const h = s.hp; R.nextDay(s); assert.equal(s.hp, Math.min(R.hpMax(s), h + T.perk_early)); }
  { const s = R.create(1); s.perks.quester = 1; R.doJob(s, 'flyer', 0.5); day(s); assert.ok(s.today.income.concat(s.last ? s.last.income : []).some(r => r.label === '퀘스트 보상' && r.amt === Math.round(T.q_survive_cash * (1 + T.perk_quest) / 1000) * 1000)); }
  assert.ok(R.housePrice(P('legs'), 22) < R.housePrice(base(), 22)); assert.equal(R.housePrice(P('legs'), 1), R.housePrice(base(), 1));
  assert.ok(Math.abs(R.studyAcc(P('sense')) - (T.study_acc + T.perk_sense)) < 1e-9);
  { const a = base(), b = P('vip'); R.buy(a, 'daejang', 100 * M); R.buy(b, 'daejang', 100 * M); assert.ok(R.holdValue(b, 'daejang') > R.holdValue(a, 'daejang')); }
  { let hit = 0; for (let seed = 1; seed < 12; seed++) { const s = R.create(seed); s.tier = 2; s.perks.tipster = 1; while (s.slot < 3) R.doRest(s); R.endDay(s); R.nextDay(s); const news = R.todayNews(s); if (news.length) { assert.equal(news.filter(x => x.report !== 0).length, 1); hit++; } } assert.ok(hit > 3); }
  { const s = P('guts'); R.levOpen(s, 1, 100 * M, 5); const e = s.lev.entry; s.market.px.coin = e * 0.7; s.market.chg.coin = 0; const c = s.cash; withTune({ c_sigma: 0 }, () => R.doRest(s)); assert.equal(s.lev, null); assert.equal(s.cash, c + Math.round(100 * M * T.perk_guts)); assert.equal(s.gutsUsed, true); }
});
ok('돌발 사건: 16개 모두 두 선택지가 끝까지 돌고, 돈이 음수가 되거나 숫자가 깨지지 않는다', () => {
  assert.ok(R.EVENTS.length >= 14);
  for (const e of R.EVENTS) for (const k of ['a', 'b']) for (let seed = 1; seed <= 6; seed++) {
    const s = R.create(seed); s.tier = e.tier[1]; s.cash = 100 * M; s.hp = 50; s.day = 3; s.event = e.id; s.ev.length = 0;
    const v = R.eventView(s); assert.ok(v && v.title && v.text && v.icon && v.a.label && v.b.label, e.id); assert.equal(v.b.cost, 0, e.id + ' 의 둘째 선택은 공짜여야 함');
    assert.equal(R.canAct(s), false); assert.equal(R.doRest(s), false);
    assert.ok(R.choose(s, k), e.id + k); assert.equal(s.event, null); assert.ok(s.evSeen.includes(e.id));
    const d = s.ev.find(x => x.t === 'event_done'); assert.ok(d && d.text && d.text.length > 3, e.id + k);
    assert.ok(Number.isFinite(s.cash) && s.cash >= 0 && Number.isFinite(s.hp) && s.hp >= 0 && s.hp <= R.hpMax(s) && Number.isFinite(R.worth(s)), e.id + k);
    assert.ok(!/미래/.test(JSON.stringify([v, d])), e.id);
    assert.ok(R.canAct(s));
  }
  const poor = R.create(1); poor.event = 'wrench'; poor.tier = 3; poor.cash = 1000; assert.equal(R.eventView(poor).a.ok, false); assert.equal(R.choose(poor, 'a'), false); assert.ok(R.choose(poor, 'b'));
});
ok('돌발 사건: 2일째부터 하루에 많아야 하나, 주거에 맞는 것만, 한 판에서 되풀이되지 않는다', () => {
  withTune({ event_p: 1 }, () => {
    const s = R.create(5), seen = []; assert.equal(s.event, null);
    while (!s.ended) {
      if (s.event) { const e = R.EVENTS.find(x => x.id === s.event); assert.ok(s.tier >= e.tier[0] && s.tier <= e.tier[1], e.id + ' @tier ' + s.tier); assert.ok(!seen.includes(e.id)); seen.push(e.id); assert.ok(s.day >= 2); R.choose(s, 'b'); assert.equal(s.event, null); }
      if (s.day === 4 && s.tier === 0) { s.cash += 100 * M; R.move(s, 1); R.move(s, 2); } if (s.day === 12 && s.tier === 2) { s.cash += 600 * M; R.move(s, 3); }
      while (s.slot < 3) R.doRest(s); R.endDay(s); R.nextDay(s);
    }
    assert.ok(seen.length >= 10, '본 사건 ' + seen.length);
  });
});
ok('콤보: 잘함 이상이면 쌓여 일당이 오르고, 보통은 유지, 실수 · 대충은 끊긴다. 완벽이면 팁이 붙기도 한다', () => {
  const s = R.create(2); s.hp = 100;
  R.doJob(s, 'flyer', 0.8); assert.equal(s.combo, 1); const c1 = s.cash; s.slot = 0;
  R.doJob(s, 'flyer', 0.8); assert.equal(s.combo, 2); assert.equal(s.cash - c1, Math.round(T.pay_flyer * T.mult_good * (1 + T.combo_bonus) / 1000) * 1000); s.slot = 0;
  R.doJob(s, 'flyer', 0.5); assert.equal(s.combo, 2); s.slot = 0;
  R.doJob(s, 'flyer', 0.1); assert.equal(s.combo, 0); s.slot = 0; s.hp = 100;
  R.doJob(s, 'flyer', 0.95); assert.equal(s.combo, 1); s.slot = 0; R.doJob(s, 'flyer', null); assert.equal(s.combo, 0);
  const t = R.create(2); t.hp = 1000; for (let i = 0; i < 14; i++) { t.slot = 0; R.doJob(t, 'flyer', 0.8); } assert.equal(t.combo, T.combo_max); assert.equal(t.stats.comboBest, T.combo_max);
  withTune({ tip_p: 1 }, () => { const u = R.create(2); R.doJob(u, 'flyer', 0.95); const tip = u.ev.find(e => e.t === 'tip'); assert.ok(tip && tip.amt >= T.tip_min && tip.amt <= T.tip_max); assert.ok(u.today.income.some(r => r.label === '팁')); });
  withTune({ tip_p: 1 }, () => { const u = R.create(2); R.doJob(u, 'flyer', 0.8); assert.ok(!u.ev.some(e => e.t === 'tip')); });
});
ok('일하는 동안: 투자를 들고 칸을 쓰면 그 칸에 움직인 만큼이 사건으로 나온다', () => {
  const s = R.create(4); s.tier = 2; s.cash = 300 * M; R.buy(s, 'buldak', 200 * M); s.ev.length = 0; const v0 = R.invested(s);
  R.doJob(s, 'flyer', 0.8); const w = s.ev.find(e => e.t === 'while'); assert.ok(w); assert.equal(w.delta, Math.round(R.invested(s) - v0));
  const t = R.create(4); R.doJob(t, 'flyer', 0.8); assert.ok(!t.ev.some(e => e.t === 'while'));
});
ok('업적: 24개, 조건이 되면 한 번만 얻는다 (첫 일당 · 수업료 · 내 집 마련)', () => {
  assert.ok(R.achList().length >= 18); assert.ok(R.achList().every(a => a.name && a.hint && a.icon));
  const s = R.create(1); R.doJob(s, 'flyer', 0.8); assert.ok(s.ach.includes('first_pay')); assert.equal(s.ev.filter(e => e.t === 'ach' && e.id === 'first_pay').length, 1);
  s.slot = 0; s.hp = 100; s.ev.length = 0; R.doJob(s, 'flyer', 0.8); assert.ok(!s.ev.some(e => e.t === 'ach' && e.id === 'first_pay'));
  const l = R.create(3); l.tier = 3; l.cash = 500 * M; R.levOpen(l, 1, 100 * M, 5); l.market.px.coin = l.lev.entry * 0.7; l.market.chg.coin = 0; withTune({ c_sigma: 0 }, () => R.doRest(l)); assert.ok(l.ach.includes('liq'));
  const h = R.create(1); h.cash = 4000 * M; R.buyHouse(h); assert.ok(h.ach.includes('home') && h.ach.includes('rankS'));
});
ok('판 코드: 같은 코드면 같은 판이고, 내가 뭘 하든 시세는 같다. 결과 카드에 코드가 들어간다', () => {
  for (const seed of [1, 37, 4821, 1679615]) assert.equal(R.seedOf(R.codeOf(seed)), seed);
  assert.equal(R.seedOf('ss-00a5'), R.seedOf('SS-00A5')); assert.equal(R.seedOf('00A5'), R.seedOf('SS-00A5')); assert.equal(R.seedOf('???'), 0);
  assert.ok(R.dailySeed(2026, 11, 13) > 0); assert.equal(R.dailySeed(2026, 11, 13), R.dailySeed(2026, 11, 13)); assert.notEqual(R.dailySeed(2026, 11, 13), R.dailySeed(2026, 11, 14));
  withTune({ event_p: 1, tip_p: 1 }, () => {
    const a = R.create(R.seedOf('SS-0Z9K')), b = R.create(R.seedOf('SS-0Z9K'));
    assert.deepEqual(a.market.px, b.market.px); assert.deepEqual(a.market.news, b.market.news);
    a.tier = 2; b.tier = 2; a.hp = b.hp = 1000;
    for (let d = 0; d < 6; d++) { // a 는 공부 · 알바 · 사건 선택, b 는 쉬기만
      for (const s of [a, b]) if (s.event) R.choose(s, s === a ? 'a' : 'b');
      R.doStudy(a); R.doJob(a, 'flyer', 0.95); R.doJob(a, 'flyer', null); for (let i = 0; i < 3; i++) R.doRest(b);
      R.endDay(a); R.endDay(b); R.nextDay(a); R.nextDay(b);
    }
    assert.deepEqual(a.market.px, b.market.px, '행동에 따라 시세가 달라짐'); assert.deepEqual(a.market.news.map(n => n.head + n.truth), b.market.news.map(n => n.head + n.truth));
  });
  const h = R.create(R.seedOf('SS-00A5'), '동여'); h.cash = 4000 * M; R.buyHouse(h); const card = R.resultCard(h);
  assert.ok(/내 집 마련 · S등급/.test(card) && /동여/.test(card) && /판 코드 SS-00A5/.test(card) && card.split('\n').length === 4);
  const f = R.create(2); while (!f.ended) day(f); assert.ok(/올해도 무주택/.test(R.resultCard(f)));
});
ok('예전 저장(레벨 · 사건이 없던 때)도 불러와서 이어 할 수 있다', () => {
  const s = R.create(9); R.doJob(s, 'flyer', 0.8); const o = JSON.parse(R.save(s));
  for (const k of ['lv', 'xp', 'perks', 'offer', 'picks', 'combo', 'buff', 'event', 'evSeen', 'ach', 'hpBonus', 'gutsUsed', 'rng3']) delete o[k];
  delete o.market.brief; const t = R.load(JSON.stringify(o)); assert.ok(t); assert.equal(t.lv, 1);
  R.doJob(t, 'flyer', 0.8); R.doRest(t); R.endDay(t); R.nextDay(t); assert.equal(t.day, 2); assert.ok(Number.isFinite(R.worth(t)));
});
ok('최대 체력: 쉬기 · 잠 · 보상이 최대 체력(특성 · 검진 포함)을 넘지 않는다', () => {
  const s = R.create(1); s.perks.iron = 1; s.hpBonus = 5; s.hp = 118; R.doRest(s); assert.equal(s.hp, 100 + T.perk_iron + 5);
  const t = R.create(1); t.hp = 99; R.doRest(t); assert.equal(t.hp, 100); while (t.slot < 3) R.doRest(t); R.endDay(t); assert.equal(t.hp, 100);
});
ok('사건의 뒷일: 대타는 다음 알바 한 번만 1.5배, 코골이를 참으면 그날 밤 덜 회복, 방송을 믿으면 한탕바이오가 사진다', () => {
  const a = R.create(1); a.tier = 1; a.quest = 99; a.event = 'swap'; R.choose(a, 'a'); a.hp = 100; R.doJob(a, 'flyer', 0.5); assert.equal(a.cash, Math.round(T.pay_flyer * 1.5 / 1000) * 1000); // 퀘스트 보상이 섞이지 않게 퀘스트는 끝난 것으로
  const c0 = a.cash; R.doJob(a, 'flyer', 0.5); assert.equal(a.cash - c0, T.pay_flyer);
  const b = R.create(1); b.tier = 2; b.day = 3; b.movedDay = 1; b.hp = 10; b.event = 'snore'; R.choose(b, 'b'); while (b.slot < 3) R.doRest(b); const h = b.hp; R.endDay(b); assert.equal(b.hp, Math.min(100, h + T.sleep_gosiwon - T.ev_sleep_pen)); assert.ok(!b.buff.sleepPen);
  const c = R.create(1); c.tier = 2; c.day = 3; c.cash = 50 * M; c.event = 'play'; R.choose(c, 'a'); assert.ok(R.holdValue(c, 'hantang') > 19 * M); assert.equal(c.cash, 30 * M);
});
console.log(n + '개 통과');
