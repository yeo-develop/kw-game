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
const safePerk = s => s.offer.find(id => !R.PERKS.find(p => p.id === id).aug) || s.offer[0]; // 쉬기만 하는 확인들이 일중독(쉬기 못 함)에 막히지 않게
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
ok('밤: 끼니 · 잠(서울역 +20) · 굶으면 체력 깎임 · 다음 날 아침', () => {
  const s = R.create(1); R.doJob(s, 'flyer', 0.8); R.doRest(s); R.doRest(s);
  const cash = s.cash, hp = s.hp; R.endDay(s);
  assert.equal(s.cash, cash - T.meal_cost); assert.equal(s.hp, Math.min(100, hp + T.sleep_station)); assert.equal(s.phase, 'night');
  R.nextDay(s); assert.equal(s.day, 2); assert.equal(s.slot, 0); assert.equal(R.questView(s).id, 'roof');
  const t = R.create(1); t.hp = 50; day(t); assert.equal(t.hp, Math.min(100, 50 + 3 * T.rest_hp_station - T.meal_skip_hp + T.sleep_station));
});
ok('주거: 찜질방(하룻밤 요금) → 고시원(순자산 기준 · 주식/배달/공부 열림) → 원룸(코인 열림), 보증금 없이 현금이 그대로', () => {
  const s = R.create(1); s.cash = 100 * M;
  assert.equal(R.move(s, 2), false); assert.ok(R.move(s, 1)); assert.ok(R.acts(s).some(a => a.id === 'store'));
  const c = s.cash; assert.ok(R.move(s, 2)); assert.equal(s.cash, c, '입주로 현금이 줄면 안 됨'); assert.equal(s.deposit, 0);
  assert.ok(R.unlocked(s, 'stock') && R.acts(s).some(a => a.id === 'delivery') && R.acts(s).some(a => a.id === 'study'));
  assert.equal(R.unlocked(s, 'coin'), false); assert.equal(R.levOpen(s, 1, 10 * M, 3), false);
  s.cash = 600 * M; assert.ok(R.move(s, 3)); assert.equal(s.cash, 600 * M); assert.equal(s.deposit, 0); assert.ok(R.unlocked(s, 'coin'));
  assert.deepEqual(Object.keys(R.moveInfo(R.create(1), 1)).sort(), ['have', 'need', 'ok', 'pay', 'settle', 'why']);
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
ok('쫓겨날 때 빚은 현금 · 주식에서 받는다 (주식에 숨겨 두고 버티기 안 됨)', () => {
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
    if (s.den) { assert.equal(R.canAct(s), false, '도박장이 열려 있는 동안은 칸을 못 씀'); assert.ok(R.denLeave(s)); }
    const d = s.ev.find(x => x.t === 'event_done'); assert.ok(d && d.text && d.text.length > 3, e.id + k);
    assert.ok(Number.isFinite(s.cash) && s.cash >= 0 && Number.isFinite(s.hp) && s.hp >= 0 && s.hp <= R.hpMax(s) && Number.isFinite(R.worth(s)), e.id + k);
    assert.ok(!/미래/.test(JSON.stringify([v, d])), e.id);
    assert.ok(R.canAct(s));
  }
  const poor = R.create(1); poor.event = 'wrench'; poor.tier = 3; poor.cash = 1000; assert.equal(R.eventView(poor).a.ok, false); assert.equal(R.choose(poor, 'a'), false); assert.ok(R.choose(poor, 'b'));
});
ok('돌발 사건: 3일째부터 하루에 많아야 하나, 주거에 맞는 것만, 한 판에서 되풀이되지 않는다 (친구의 전화만 다시 옴)', () => {
  withTune({ event_p: 1 }, () => {
    const s = R.create(5), seen = []; assert.equal(s.event, null);
    while (!s.ended) {
      while (s.offer) R.pickPerk(s, safePerk(s)); // 특성을 고르지 않고 두면 그 아침에는 사건이 뜨지 않는다
      if (s.event) { const e = R.EVENTS.find(x => x.id === s.event); assert.ok(s.tier >= e.tier[0] && s.tier <= e.tier[1], e.id + ' @tier ' + s.tier); if (!e.again) assert.ok(!seen.includes(e.id)); seen.push(e.id); assert.ok(s.day >= T.event_from); R.choose(s, 'b'); assert.equal(s.event, null); }
      if (s.day === 4 && s.tier === 0) { s.cash += 100 * M; R.move(s, 1); R.move(s, 2); } if (s.day === 12 && s.tier === 2) { s.cash += 600 * M; R.move(s, 3); }
      while (s.slot < 3) R.doRest(s); R.endDay(s); R.nextDay(s);
    }
    assert.ok(new Set(seen).size >= 10, '본 사건 ' + new Set(seen).size);
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
ok('결과 카드에 순자산이 있고, 큰 씨앗도 판 코드로 다시 열 수 있다', () => {
  const h = R.create(77, '동여'); h.cash = 4000 * M; R.buyHouse(h); assert.ok(/순자산 40,000,000원/.test(R.resultCard(h)), R.resultCard(h));
  const big = R.create(1679616 + 365); assert.equal(R.seedOf(R.codeOf(big.seed)), big.seed); assert.deepEqual(R.create(R.seedOf(R.codeOf(big.seed))).market.px, big.market.px);
});
ok('복권은 남는 장사가 아니고 찜질방부터 나온다, 공짜 리포트는 그날 공부를 막지 않는다', () => {
  let net = 0; const N = 4000;
  for (let seed = 1; seed <= N; seed++) { const s = R.create(seed); s.tier = 1; s.day = 3; s.cash = 10 * M; s.event = 'ticket'; R.choose(s, 'a'); net += s.cash - 10 * M; }
  assert.ok(net / N <= 0, '한 장당 평균 ' + Math.round(net / N)); assert.equal(R.EVENTS.find(e => e.id === 'ticket').tier[0], 1);
  let hit = 0;
  for (let seed = 1; seed < 40 && !hit; seed++) {
    const s = R.create(seed); s.tier = 2; s.day = 3; s.event = 'regular'; R.choose(s, 'a'); if (!R.intelView(s)) continue;
    hit = 1; const before = JSON.stringify(R.intelView(s).items); assert.equal(R.acts(s).find(a => a.id === 'study').ok, true);
    assert.ok(R.doStudy(s)); assert.equal(JSON.stringify(R.intelView(s).items), before, '공부했더니 리포트가 다시 뽑힘'); assert.equal(R.doStudy(s), false);
  }
  assert.ok(hit);
});
ok('돌발 사건은 조용한 아침에만: 퀘스트가 끝나거나 특성을 고르는 아침에는 뜨지 않는다', () => {
  const night = s => { while (s.slot < 3) R.doRest(s); R.endDay(s); R.nextDay(s); };
  withTune({ event_p: 1, event_from: 2 }, () => {
    const s = R.create(5); R.doJob(s, 'flyer', 0.5); while (s.offer) R.pickPerk(s, safePerk(s));
    night(s); assert.equal(s.day, 2); assert.equal(s.quest, 2, '밤을 넘겨 "오늘을 버텨라"가 끝남'); assert.equal(s.event, null, '퀘스트가 끝난 아침');
    night(s); assert.equal(s.day, 3); assert.equal(s.offer, null); assert.ok(s.event, '조용한 아침에는 뜬다'); R.choose(s, 'b'); while (s.offer) R.pickPerk(s, safePerk(s));
    s.xp = T.lv_base + T.lv_step * (s.lv - 1) - 1; night(s); assert.ok(s.offer, '밤에 레벨이 올라 특성을 고를 차례'); assert.equal(s.event, null, '특성을 고르는 아침');
  });
  withTune({ event_p: 1 }, () => { const s = R.create(5); s.quest = 99; night(s); assert.equal(s.event, null, T.event_from + '일째 전'); });
});
ok('돌발 사건의 결과는 바뀐 것을 숫자로 알려 준다 (현금 · 체력 · 경험치 · 최대 체력 · 잠)', () => {
  const run = (id, k, tier, set) => { const s = R.create(3); s.tier = tier; s.day = 5; s.quest = 99; s.cash = 10 * M; s.hp = 50; if (set) set(s); s.event = id; s.ev.length = 0; assert.ok(R.choose(s, k)); return s.ev.find(e => e.t === 'event_done').fx; };
  assert.deepEqual(run('purse', 'b', 0), { cash: 30000, hp: -6, xp: 0, hpMax: 0, nights: 0 });
  assert.deepEqual(run('cat', 'a', 0), { cash: -3000, hp: 3, xp: 15, hpMax: 0, nights: 0 });
  assert.deepEqual(run('snore', 'b', 2), { cash: 0, hp: 0, xp: 0, hpMax: 0, nights: 1 });
  assert.deepEqual(run('wrench', 'b', 3), { cash: 0, hp: 0, xp: 0, hpMax: 0, nights: 3 });
  assert.deepEqual(run('clinic', 'a', 2), { cash: -30000, hp: 5, xp: 0, hpMax: 5, nights: 0 });
  assert.equal(run('soup', 'a', 0, s => { s.hp = R.hpMax(s) - 4; }).hp, 4, '최대 체력에서 잘린 만큼만');
});
ok('직접 하면 실수해도 "대충"보다 덜 받지 않는다 (해 보는 것이 손해가 아니다)', () => {
  const pay = (score, lazy) => { const s = R.create(4); s.quest = 99; if (lazy) s.perks.lazy = lazy; R.doJob(s, 'flyer', score); return s.cash; };
  assert.ok(pay(0.1) >= pay(null), '실수 ' + pay(0.1) + ' · 대충 ' + pay(null)); assert.ok(pay(0.5) > pay(null)); assert.ok(T.mult_miss >= T.mult_skip);
  for (const lazy of [1, 2]) { assert.ok(pay(0.1, lazy) >= pay(null, lazy), '요령 ' + lazy + ': 실수 ' + pay(0.1, lazy) + ' · 대충 ' + pay(null, lazy)); assert.ok(pay(0.5, lazy) >= pay(null, lazy)); } // 특성 '요령'으로 대충이 올라도
});

// ── iteration 3 ─────────────────────────────────────────────
const den = s => { s.event = 'den'; R.choose(s, 'a'); }; // 친구의 전화 → 간다
ok('돈 표기: won 은 1,234,000원, num 은 원 없이, 음수는 − 를 앞에', () => {
  assert.equal(R.won(1234000), '1,234,000원'); assert.equal(R.num(1234000), '1,234,000'); assert.equal(R.won(0), '0원'); assert.equal(R.num(999), '999');
  assert.equal(R.won(-50000), '−50,000원'); assert.equal(R.num(-1234567.6), '−1,234,568'); assert.equal(R.won(31000000), '31,000,000원');
  const fs = require('fs'), src = fs.readFileSync(path.join(dir, 'rules.js'), 'utf8').replace(/\/\/.*$/gm, '');
  const left = (src.match(/'[^'\n]*\d만[ 원이을과\.'][^'\n]*'/g) || []).filter(x => !/구독자 \d만/.test(x)); // 구독자 수는 돈이 아님
  assert.deepEqual(left, [], '규칙 글에 "5만" 같은 손글씨 금액이 남음');
});
ok('잠으로 다 안 찬다: 밤 회복 20 · 35 · 45 · 55, 어느 집에서도 무거운 알바 셋을 잠만으로 못 메움', () => {
  const s = R.create(1);
  assert.deepEqual([0, 1, 2, 3].map(t => { s.tier = t; return R.sleepGain(s); }), [T.sleep_station, T.sleep_sauna, T.sleep_gosiwon, T.sleep_oneroom]);
  assert.deepEqual([T.sleep_station, T.sleep_sauna, T.sleep_gosiwon, T.sleep_oneroom], [20, 35, 45, 55]); assert.equal(T.perk_sleep, 8);
  for (const k of ['sleep_station', 'sleep_sauna', 'sleep_gosiwon', 'sleep_oneroom']) assert.ok(3 * Math.min(T.hp_loading, T.hp_delivery) > T[k] + T.rest_hp * 0, k);
  const o = R.create(1); o.tier = 3; o.movedDay = 1; o.cash = 1000 * M; o.hp = 100; o.quest = 99; // 원룸에서 매일 배달 셋을 시도하면 사흘 안에 못 뛰는 칸이 생긴다
  let blocked = 0; for (let d = 0; d < 3; d++) { for (let i = 0; i < 3; i++) { if (!R.doJob(o, 'delivery', 0.8)) { blocked++; R.doJob(o, 'store', 0.8) || R.doRest(o); } } R.endDay(o); R.nextDay(o); while (o.offer) R.pickPerk(o, safePerk(o)); if (o.event) R.choose(o, 'b'); }
  assert.ok(blocked > 0);
});
ok('입주는 순자산 기준: 모자라면 거절하고 이유를 알려 준다, 주식으로 든 돈도 기준에 든다', () => {
  const s = R.create(1); s.cash = 30 * M; R.move(s, 1); s.ev.length = 0;
  const i = R.moveInfo(s, 2); assert.equal(i.ok, false); assert.equal(i.need, T.gosiwon_need); assert.equal(i.have, R.worth(s)); assert.ok(/순자산/.test(i.why), i.why);
  assert.equal(R.move(s, 2), false); const d = s.ev.find(e => e.t === 'deny'); assert.ok(d && /순자산/.test(d.why)); assert.equal(s.tier, 1);
  const t = R.create(1); t.cash = 100 * M; R.move(t, 1); R.move(t, 2); R.buy(t, 'daejang', 95 * M); t.cash += 410 * M; R.buy(t, 'daejang', 400 * M);
  assert.ok(t.cash < 50 * M && R.worth(t) >= T.oneroom_need * 0.99);
  t.market.px.daejang *= 1.05; assert.ok(R.moveInfo(t, 3).ok, R.moveInfo(t, 3).why); const c = t.cash; assert.ok(R.move(t, 3)); assert.equal(t.cash, c); assert.ok(R.holdValue(t, 'daejang') > 0, '주식은 그대로');
  const u = R.create(1); u.cash = 100 * M; R.move(u, 1); R.move(u, 2); u.arrears = 30 * M; u.cash = 10 * M; u.hold.daejang.units = 1000; u.hold.daejang.cost = 1;
  const iu = R.moveInfo(u, 3); if (R.worth(u) >= T.oneroom_need) { assert.equal(iu.ok, false); assert.ok(/현금/.test(iu.why), iu.why); assert.equal(iu.pay, 30 * M + iu.settle); }
});
ok('주 고정비가 오른다 (고시원 > 40만 · 원룸 > 80만, 시작값 대비)', () => {
  assert.ok(T.gosiwon_week > 400000 && T.oneroom_week > 800000); assert.ok(!('gosiwon_deposit' in C) && !('oneroom_deposit' in C));
});
ok('예전 저장(v1, 보증금 있던 때)을 불러오면 보증금을 현금으로 돌려주고 새 칸을 채운다', () => {
  const s = R.create(9); s.cash = 100 * M; R.move(s, 1); R.move(s, 2); const o = JSON.parse(R.save(s));
  o.v = 1; o.deposit = T.gosiwon_need; o.cash = 20 * M; for (const k of ['den', 'evDay']) delete o[k]; delete o.market.shocks;
  const w1 = Math.round(o.cash + o.deposit);
  const t = R.load(JSON.stringify(o)); assert.ok(t); assert.equal(t.v, 2); assert.equal(t.deposit, 0); assert.equal(t.cash, 20 * M + T.gosiwon_need);
  assert.equal(R.worth(t), w1); assert.equal(t.den, null); assert.deepEqual(t.evDay, {}); assert.deepEqual(t.market.shocks, []);
  assert.ok(t.ev.some(e => e.t === 'sys' && /보증금/.test(e.text)));
  R.doJob(t, 'flyer', 0.8); R.doRest(t); R.doRest(t); R.endDay(t); R.nextDay(t); assert.ok(Number.isFinite(R.worth(t)));
  assert.equal(JSON.parse(R.save(t)).v, 2); assert.equal(R.load(JSON.stringify(Object.assign(o, { v: 3 }))), null);
});
ok('속보: 같은 씨앗이면 같은 속보, 내가 뭘 하든 같다 (공부 리포트에는 안 나옴)', () => {
  withTune({ shock_p: 1, event_p: 1 }, () => {
    const a = R.create(R.seedOf('SS-0Z9K')), b = R.create(R.seedOf('SS-0Z9K')), seenA = [], seenB = [];
    a.tier = 2; b.tier = 2; a.hp = b.hp = 1000;
    for (let d = 0; d < 14; d++) {
      for (const s of [a, b]) { if (s.event) R.choose(s, s === a ? 'a' : 'b'); if (s.den) { R.denBet(s, T.den_bet_1, 'odd'); R.denLeave(s); } while (s.offer) R.pickPerk(s, safePerk(s)); }
      R.doStudy(a); assert.ok(!JSON.stringify(R.intelView(a) || {}).includes('속보'));
      R.doJob(a, 'flyer', 0.95); R.doJob(a, 'flyer', null); for (let i = 0; i < 3; i++) R.doRest(b);
      seenA.push(...a.market.shocks.map(k => JSON.stringify(k))); seenB.push(...b.market.shocks.map(k => JSON.stringify(k)));
      R.endDay(a); R.endDay(b); R.nextDay(a); R.nextDay(b);
    }
    assert.ok(seenA.length > 0, '속보가 하나도 없음'); assert.deepEqual(seenA, seenB); assert.deepEqual(a.market.px, b.market.px);
    assert.ok(a.market.shocks.every(k => k.day >= T.shock_from && k.slot >= 0 && k.slot <= 2 && R.SHOCKS.some(x => x.head === k.head)));
  });
  const fresh = R.create(3); assert.ok(fresh.market.shocks.every(k => k.day >= T.shock_from)); // 첫 주에는 없음
});
ok('속보가 그 칸에 든 종목 값을 바꾸고, 내가 들고 있으면 손익과 함께 알린다', () => {
  withTune({ d_sigma: 0, d_drift: 0 }, () => {
    const s = R.create(3); s.tier = 2; s.cash = 100 * M; s.quest = 99; R.buy(s, 'daejang', 100 * M); s.ev.length = 0; s.market.news = []; // 소식의 움직임이 섞이지 않게
    s.market.shocks.push({ id: 999, day: s.day, slot: s.slot, asset: 'daejang', pct: -0.12, head: '대장전자 회장 사생활 폭로' });
    const p0 = s.market.px.daejang, v0 = R.holdValue(s, 'daejang'); R.doRest(s);
    assert.ok(Math.abs(s.market.px.daejang / p0 - 0.88) < 1e-9, String(s.market.px.daejang / p0));
    const e = s.ev.find(x => x.t === 'shock'); assert.ok(e && e.held && e.asset === 'daejang' && e.name === '대장전자' && e.pct === -0.12 && e.head);
    assert.equal(e.delta, Math.round(R.holdValue(s, 'daejang') - v0)); assert.ok(e.delta < 0); assert.ok(s.ev.some(x => x.t === 'sys' && /속보/.test(x.text)));
    const t = R.create(3); t.tier = 2; t.ev.length = 0; t.market.shocks.push({ id: 998, day: t.day, slot: t.slot, asset: 'buldak', pct: 0.18, head: 'x' }); R.doRest(t);
    const f = t.ev.find(x => x.t === 'shock'); assert.ok(f && !f.held && f.delta === 0);
    const u = R.create(3); u.ev.length = 0; u.market.shocks.push({ id: 997, day: u.day, slot: u.slot, asset: 'daejang', pct: -0.12, head: 'x' }); R.doRest(u);
    assert.ok(!u.ev.some(x => x.t === 'shock'), '계좌가 없을 때는 알리지 않음');
  });
});
ok('양날 특성 4종: 얻는 것과 못 하는 것 (막히면 이유가 뜬다)', () => {
  const P = id => { const s = R.create(3); s.tier = 3; s.cash = 1000 * M; s.quest = 99; if (id) s.perks[id] = 1; return s; };
  const denied = s => (s.ev.filter(e => e.t === 'deny').pop() || {}).why || '';
  const levGain = id => { const s = P(id); R.levOpen(s, 1, 100 * M, 3); s.market.px.coin = s.lev.entry * 1.1; const c = s.cash; R.levClose(s); return s.cash - c; };
  const stockGain = id => { const s = P(id); const c = s.cash; R.buy(s, 'daejang', 100 * M); s.market.px.daejang *= 1.1; R.sell(s, 'daejang', 1); return s.cash - c; };
  assert.ok(R.PERKS.filter(p => p.aug).length === 4 && R.PERKS.filter(p => p.aug).every(p => p.con));
  { const s = P('coinonly'); assert.equal(R.buy(s, 'daejang', 10 * M), false); assert.ok(/주식/.test(denied(s))); const base = levGain(), g = levGain('coinonly'); assert.ok(Math.abs((g - 100 * M) - (base - 100 * M) * (1 + T.perk_coinonly)) < 3, base + ' ' + g); }
  { const s = P('stockonly'); assert.equal(R.levOpen(s, 1, 10 * M, 2), false); assert.ok(/코인/.test(denied(s))); assert.ok(stockGain('stockonly') > stockGain() * (1 + T.perk_stockonly)); const t = P('stockonly'); R.buy(t, 'daejang', 100 * M); assert.equal(t.stats.fees, 0); }
  { const s = P('workaholic'); s.hp = 100; assert.equal(R.acts(s).find(a => a.id === 'rest').ok, false); assert.equal(R.doRest(s), false); assert.ok(/쉬/.test(denied(s)));
    assert.equal(R.acts(s).find(a => a.id === 'flyer').pay, Math.round(T.pay_flyer * (1 + T.perk_workaholic) / 1000) * 1000);
    s.hp = 0; assert.ok(R.acts(s).find(a => a.id === 'rest').ok, '할 수 있는 알바가 없으면 쉰다 (갇히지 않게)'); assert.ok(R.doRest(s)); }
  { const s = P('beast'); assert.equal(R.levOpen(s, 1, 10 * M, T.beast_min_lev - 1), false); assert.ok(/배/.test(denied(s))); assert.ok(R.levOpen(s, 1, 10 * M, T.beast_min_lev));
    const base = levGain(), g = levGain('beast'); assert.ok(Math.abs((g - 100 * M) - (base - 100 * M) * (1 + T.perk_beast)) < 3); }
  const card = R.offerView(Object.assign(P(), { offer: ['coinonly', 'iron', 'sleep'] })); assert.equal(card[0].aug, true); assert.equal(card[0].con, '주식을 살 수 없다'); assert.equal(card[1].aug, false);
});
ok('양날은 레벨 3 · 6 · 9 의 고르기에만, 한 번에 한 장, 투자 무리(코인 외길 · 주식 외길 · 야수)는 한 판에 하나', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const s = R.create(seed); s.tier = 3; s.cash = 1000 * M; s.hp = 100000; s.quest = 99; let guard = 0; const augAt = [];
    while (s.lv < 11 && guard++ < 3000) {
      s.slot = 0; R.doJob(s, 'flyer', 0.95);
      while (s.offer) {
        const lvFor = s.lv - s.picks + 1, v = R.offerView(s), augs = v.filter(c => c.aug);
        assert.ok(augs.length <= 1, 'Lv ' + lvFor + ' 양날 ' + augs.length);
        if (lvFor % 3) assert.equal(augs.length, 0, 'Lv ' + lvFor);
        const left = R.PERKS.filter(p => p.aug && !s.perks[p.id] && !(p.grp && R.PERKS.some(q => q.grp === p.grp && s.perks[q.id])));
        if (lvFor % 3 === 0 && left.length) assert.equal(augs.length, 1, 'Lv ' + lvFor);
        if (augs.length) augAt.push(lvFor);
        R.pickPerk(s, augs.length ? augs[0].id : v[0].id);
      }
    }
    assert.ok(['coinonly', 'stockonly', 'beast'].filter(id => s.perks[id]).length <= 1); assert.ok(augAt.includes(3) && augAt.includes(6), String(augAt));
  }
});
ok('도박장: 열려 있는 동안 칸 · 매매 불가, 다섯 판 뒤 닫힘, 따블은 이긴 직후만, 정해진 판돈만', () => {
  const s = R.create(4); s.tier = 2; s.cash = 100 * M; s.quest = 99; s.day = 6; den(s);
  assert.ok(s.den && s.ev.some(e => e.t === 'den_open')); assert.equal(R.canAct(s), false); assert.equal(R.doJob(s, 'flyer', 1), false); assert.equal(R.buy(s, 'daejang', 10 * M), false);
  const v = R.denView(s); assert.deepEqual(v.bets.map(b => b.amt), [T.den_bet_1, T.den_bet_2, T.den_bet_3, T.den_bet_4]); assert.equal(v.max, T.den_rounds); assert.equal(v.canDouble, false); assert.equal(v.last, null);
  assert.equal(R.denBet(s, 12345, 'odd'), false); assert.equal(R.denBet(s, T.den_bet_1, 'big'), false);
  let rounds = 0, doubled = 0;
  while (s.den) {
    const w = R.denView(s), amt = w.canDouble ? w.doubleAmt : T.den_bet_2, c = s.cash;
    if (w.canDouble) doubled++;
    assert.ok(R.denBet(s, amt, rounds % 2 ? 'odd' : 'even')); rounds++;
    const r = s.ev.filter(e => e.t === 'den_roll').pop(); assert.equal((r.dice[0] + r.dice[1]) % 2 === 1, r.pick === 'odd' ? r.win : !r.win);
    assert.equal(s.cash - c, r.win ? Math.round(amt * T.den_pay) - amt : -amt);
    if (s.den) { const after = R.denView(s); assert.equal(after.canDouble, r.win); if (!r.win) assert.equal(R.denBet(s, Math.round(amt * T.den_pay), 'odd'), false); }
  }
  assert.equal(rounds, T.den_rounds); assert.equal(s.den, null); assert.ok(s.ev.some(e => e.t === 'den_done' && e.rounds === T.den_rounds)); assert.ok(R.canAct(s)); assert.equal(R.denBet(s, T.den_bet_1, 'odd'), false);
  const t = R.create(4); t.tier = 2; t.cash = 100 * M; den(t); R.denBet(t, T.den_bet_1, 'odd'); assert.ok(R.denLeave(t)); assert.equal(t.den, null); assert.ok(R.canAct(t));
  const p = R.create(4); p.tier = 2; p.cash = 2 * M; den(p); assert.deepEqual(R.denView(p).bets.map(b => b.ok), [true, false, false, false]);
});
ok('도박장 기대값: 1만 번 굴리면 판돈의 −3% ~ −7%', () => {
  const s = R.create(12); s.tier = 2; s.cash = 1e10; s.quest = 99; let bet = 0, net = 0;
  for (let i = 0; i < 10000; i++) { if (!s.den) den(s); const c = s.cash; R.denBet(s, T.den_bet_1, i % 3 ? 'odd' : 'even'); bet += T.den_bet_1; net += s.cash - c; if (i % 200 === 0) s.ev.length = 0; }
  const r = net / bet; assert.ok(r <= -0.03 && r >= -0.07, '기대값 ' + (r * 100).toFixed(2) + '%');
});
ok('도박장 굴림은 시세를 바꾸지 않는다 (시세 난수와 따로)', () => {
  const a = R.create(21), b = R.create(21); for (const s of [a, b]) { s.tier = 2; s.cash = 100 * M; s.quest = 99; }
  den(a); while (a.den) R.denBet(a, T.den_bet_2, 'odd'); assert.equal(a.rng, b.rng);
  for (let d = 0; d < 4; d++) for (const s of [a, b]) { while (s.slot < 3) R.doRest(s); R.endDay(s); R.nextDay(s); if (s.event) R.choose(s, 'b'); }
  assert.deepEqual(a.market.px, b.market.px); assert.deepEqual(a.market.shocks, b.market.shocks);
});
ok('친구의 전화: 고시원부터 · 6일째부터, 다시 오지만 사흘 간격 이상, 업적 둘 (3연승 · 크게 잃음)', () => {
  withTune({ event_p: 1 }, () => {
    let calls = [];
    for (const seed of [1, 2, 3]) {
      const s = R.create(seed); s.quest = 99; s.cash = 100 * M; R.move(s, 1); const days = [];
      while (!s.ended) {
        while (s.offer) R.pickPerk(s, safePerk(s));
        if (s.event) { if (s.event === 'den') { assert.ok(s.tier >= 2 && s.day >= T.den_from, 'tier ' + s.tier + ' day ' + s.day); days.push(s.day); } R.choose(s, 'b'); }
        if (s.day === 2 && s.tier === 1) { s.cash += 100 * M; R.move(s, 2); }
        while (s.slot < 3) R.doRest(s); R.endDay(s); R.nextDay(s);
      }
      for (let i = 1; i < days.length; i++) assert.ok(days[i] - days[i - 1] >= T.den_gap, String(days));
      calls = calls.concat(days);
    }
    assert.ok(calls.length >= 3, '전화 ' + calls.length);
  });
  let got3 = false;
  for (let seed = 1; seed < 60 && !got3; seed++) { const s = R.create(seed); s.tier = 2; s.cash = 100 * M; s.quest = 99; den(s); while (s.den) R.denBet(s, T.den_bet_1, 'odd'); got3 = s.ach.includes('den3'); if (got3) assert.ok(s.stats.denStreak >= 3); }
  assert.ok(got3);
  let lost = false;
  for (let seed = 1; seed < 20 && !lost; seed++) { const s = R.create(seed); s.tier = 2; s.cash = 100 * M; s.quest = 99; den(s); R.denBet(s, T.den_bet_4, 'odd'); lost = s.ach.includes('denloss'); if (s.den) R.denLeave(s); }
  assert.ok(lost); assert.ok(R.achList().some(a => a.id === 'denloss' && /300,000원/.test(a.hint)));
});
ok('고정비 · 집값 알림은 전날과 당일에만, week 는 "N주차 M일"', () => {
  const s = R.create(1); s.cash = 100 * M; s.quest = 99; R.move(s, 1); R.move(s, 2); const seen = {};
  for (let d = 1; d <= 8; d++) {
    const n = R.notices(s), w = R.week(s); seen[d] = n.map(x => x.kind + ':' + x.when).join(',');
    assert.equal(w.day, d); assert.equal(w.dow, (d - 1) % 7 + 1); assert.equal(w.week, d <= 7 ? 1 : 2); assert.equal(w.left, T.days - d + 1); assert.equal(w.billDay, true); assert.deepEqual(w.bill, R.bill(s));
    for (const x of n) { assert.ok(x.text && x.amt > 0); if (x.kind === 'bill') { assert.equal(x.amt, R.bill(s).amt); assert.ok(x.text.includes(R.won(x.amt))); } }
    day(s); if (s.event) R.choose(s, 'b');
  }
  assert.deepEqual(seen, { 1: '', 2: '', 3: '', 4: '', 5: '', 6: 'bill:tomorrow', 7: 'bill:today,rise:tomorrow', 8: '' });
  const t = R.create(1); assert.deepEqual(R.notices(t), []); assert.equal(R.week(t).billDay, false); assert.equal(R.week(t).bill, null);
  t.day = 28; assert.ok(!R.notices(t).some(x => x.kind === 'rise'), '마지막 날엔 집값 인상 없음');
});
ok('보유 한눈에: 주식 3종 줄(안 가진 것도) + 코인 포지션 + 합계', () => {
  const s = R.create(3); s.tier = 3; s.cash = 1000 * M;
  let h = R.holdings(s); assert.deepEqual(h.rows.map(r => r.id), ['daejang', 'buldak', 'hantang']); assert.ok(h.rows.every(r => r.units === 0 && r.value === 0 && r.pct === 0)); assert.equal(h.lev, null); assert.deepEqual(h.total, { value: 0, cost: 0, pnl: 0, pct: 0 });
  R.buy(s, 'daejang', 100 * M); R.levOpen(s, 1, 50 * M, 2); s.market.px.daejang *= 1.2;
  h = R.holdings(s); const d = h.rows[0]; assert.deepEqual(Object.keys(d), ['id', 'name', 'tag', 'units', 'value', 'cost', 'pnl', 'pct']);
  assert.equal(d.cost, 100 * M); assert.equal(d.value, Math.round(R.holdValue(s, 'daejang'))); assert.equal(d.pnl, d.value - d.cost); assert.ok(d.pct > 0.18);
  assert.deepEqual(Object.keys(h.lev), ['dir', 'lev', 'put', 'value', 'pnl', 'pct']); assert.equal(h.lev.put, 50 * M); assert.equal(h.total.value, d.value + h.lev.value); assert.equal(h.total.cost, 150 * M);
});
ok('퀘스트 바로 가기는 move · stock · coin · house 만 (사다리 없음), 글에 화면 위치 말이 없다', () => {
  const s = R.create(1); const gos = new Set();
  for (let i = 0; i < 12; i++) { s.quest = i; const q = R.questView(s); if (!q) break; gos.add(q.go); assert.ok(!/사다리/.test(q.desc + q.title), q.id); assert.ok(!/\d만/.test(q.desc + q.title), q.id); }
  assert.deepEqual([...gos].filter(Boolean).sort(), ['coin', 'house', 'move', 'stock']);
});
console.log(n + '개 통과');
