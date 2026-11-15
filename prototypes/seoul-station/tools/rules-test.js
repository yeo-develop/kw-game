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
  const s = R.create(1); s.cash = T.gosiwon_need + 10 * M;
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
ok('공부는 하루 한 번 · 고른 종목 하나 · 체력을 쓴다, 이틀 연속 공부해도 어제 리포트가 오늘 소식에 남는다', () => {
  const s = R.create(4); s.tier = 2; s.hp = 50;
  assert.equal(R.doStudy(s), false, '종목 없이'); assert.equal(R.doStudy(s, 'coin'), false, '원룸 전에는 코인 공부 못 함'); assert.equal(R.doStudy(s, 'nope'), false);
  const card = R.acts(s).find(a => a.id === 'study'); assert.equal(card.hp, T.study_hp); assert.equal(card.ok, true); assert.deepEqual(card.assets.map(a => a.id), ['daejang', 'buldak', 'hantang']);
  assert.ok(R.doStudy(s, 'buldak')); assert.equal(s.hp, 50 - T.study_hp); assert.equal(s.slot, 1); assert.equal(R.doStudy(s, 'daejang'), false, '하루 한 번');
  assert.equal(R.acts(s).find(a => a.id === 'study').ok, false);
  const iv = R.intelView(s); assert.deepEqual(iv.assets, ['buldak']); assert.ok(iv.items.every(i => i.asset === 'buldak')); assert.equal(iv.ht, null);
  const u = R.create(4); u.tier = 3; assert.ok(R.acts(u).find(a => a.id === 'study').assets.some(a => a.id === 'coin'));
  const w = R.create(4); w.tier = 2; w.hp = T.study_hp - 1; const c2 = R.acts(w).find(a => a.id === 'study'); assert.equal(c2.ok, false); assert.ok(c2.why); assert.equal(R.doStudy(w, 'buldak'), false);
  let seen = 0;
  for (let seed = 1; seed < 60 && !seen; seed++) {
    const t = R.create(seed); t.tier = 2; R.doStudy(t, 'buldak'); const n1 = R.intelView(t).items.length; R.doRest(t); R.doRest(t); R.endDay(t); R.nextDay(t);
    const bn = () => R.todayNews(t).filter(n => n.asset === 'buldak');
    if (!n1 || !bn().length) continue;
    assert.ok(bn().every(n => n.report !== 0)); assert.ok(R.todayNews(t).filter(n => n.asset !== 'buldak').every(n => n.report === 0), '안 고른 종목에 리포트가 붙음');
    t.hp = 100; R.doStudy(t, 'daejang'); // 오늘 또 공부해도
    assert.ok(bn().every(n => n.report !== 0), '어제 리포트 표시가 지워짐'); assert.ok(R.intelView(t)); seen = 1;
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
  R.buy(s, 'daejang', 10 * M); s.hp = 100; R.doStudy(s, 'daejang'); s.market.px.daejang *= 1.8; R.sell(s, 'daejang', 1);
  assert.equal(R.questView(s).id, 'pump');
  R.buy(s, 'hantang', 100 * M); s.market.px.hantang *= 1.3; R.sell(s, 'hantang', 1);
  assert.notEqual(R.questView(s).id, 'pump'); assert.ok(s.stats.htGain >= 10 * M);
});
ok('밤 정산이 떠 있는 동안과 엔딩 뒤에는 매매 · 이사 · 계약이 안 된다, 이상한 금액은 거절', () => {
  const s = R.create(1); s.tier = 3; s.cash = 5000 * M; while (s.slot < 3) R.doRest(s); R.endDay(s);
  assert.equal(R.buy(s, 'daejang', 10 * M), false); assert.equal(R.levOpen(s, 1, 10 * M, 2), false); assert.equal(R.buyHouse(s), false); assert.equal(s.ended, null);
  R.nextDay(s); assert.equal(R.buy(s, 'daejang', NaN), false); assert.equal(R.levOpen(s, 1, undefined, 3), false); assert.ok(Number.isFinite(s.cash));
  assert.ok(R.buyHouse(s)); assert.equal(s.ended, null, '내 집은 엔딩이 아니다'); assert.ok(R.buy(s, 'daejang', 10 * M));
  s.tier = 8; s.cash = T.top_worth; assert.ok(R.declareTop(s)); assert.equal(R.buy(s, 'daejang', 10 * M), false); assert.equal(R.repay(s, 1), false); assert.equal(R.bizUp(s), false);
});
ok('때를 놓친 퀘스트는 건너뛰어 "집을 사라"가 가려지지 않는다', () => {
  const s = R.create(1); R.doJob(s, 'flyer', 0.8); day(s); s.cash = 4000 * M; R.move(s, 1); R.move(s, 2); R.move(s, 3);
  assert.equal(R.questView(s).id, 'house'); assert.ok(s.ev.some(e => e.t === 'quest_skip'));
  const t = R.create(1); R.doJob(t, 'flyer', 0.8); day(t); t.cash = 700 * M; R.move(t, 1); R.move(t, 2); R.move(t, 3);
  assert.equal(R.questView(t).id, 'lev'); t.day = 22; R.doRest(t); assert.equal(R.questView(t).id, 'lev', '날짜로는 건너뛰지 않는다 (기한 없음)');
  t.cash += R.housePrice(t); R.doRest(t); assert.equal(R.questView(t).id, 'house', '집값의 60%를 넘으면 집 퀘스트가 앞에');
});
ok('기한 없음: 28일을 지나도 판이 안 끝나고, 집값은 오르지 않는다', () => {
  const s = R.create(2), p0 = R.housePrice(s); s.quest = 99;
  while (s.day < 40) { day(s); while (s.offer) R.pickPerk(s, safePerk(s)); if (s.event) R.choose(s, 'b'); }
  assert.equal(s.ended, null); assert.equal(s.day, 40); assert.equal(R.housePrice(s), p0); assert.equal(R.riseIn(s), null); assert.equal(p0, T.price_home);
  assert.ok(!('days' in C) && !('house_growth' in C) && !('house_price' in C));
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
ok('공부: 고른 종목의 내일 소식 방향을 미리 봄 (다음 날 그 종목 소식에만 표시됨)', () => {
  let found = false;
  for (let seed = 1; seed < 40 && !found; seed++) {
    const s = R.create(seed); s.tier = 2; R.doStudy(s, 'buldak'); const iv = R.intelView(s); assert.ok(iv && iv.day === 2);
    R.doRest(s); R.doRest(s); R.endDay(s); R.nextDay(s);
    const news = R.todayNews(s); if (news.length && iv.items.length) { assert.ok(news.every(n => (n.report !== 0) === (n.asset === 'buldak'))); found = true; }
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
  const x = R.create(1), x0 = x.xp + x.lv * 1000; x.tier = 2; R.doStudy(x, 'buldak'); assert.ok(x.xp + x.lv * 1000 > x0);
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
  assert.equal(R.housePrice(P('legs')), Math.round(T.price_home * (1 - T.perk_legs) / 10000) * 10000); assert.ok(R.homePrice(P('legs'), 7) < R.homePrice(base(), 7)); assert.ok(R.bizView(P('legs')).next.cost < R.bizView(base()).next.cost);
  assert.ok(Math.abs(R.studyAcc(P('sense')) - (T.study_acc + T.perk_sense)) < 1e-9);
  { const a = base(), b = P('vip'); R.buy(a, 'daejang', 100 * M); R.buy(b, 'daejang', 100 * M); assert.ok(R.holdValue(b, 'daejang') > R.holdValue(a, 'daejang')); }
  { let hit = 0; for (let seed = 1; seed < 12; seed++) { const s = R.create(seed); s.tier = 2; s.perks.tipster = 1; while (s.slot < 3) R.doRest(s); R.endDay(s); R.nextDay(s); const news = R.todayNews(s).filter(x => x.asset !== 'coin'); if (news.length) { assert.equal(news.filter(x => x.report !== 0).length, 1); hit++; } } assert.ok(hit > 3); } // 고시원에서는 코인 소식은 귀띔하지 않는다
  { const s = P('guts'); R.levOpen(s, 1, 100 * M, 5); const e = s.lev.entry; s.market.px.coin = e * 0.7; s.market.chg.coin = 0; const c = s.cash; withTune({ c_sigma: 0 }, () => R.doRest(s)); assert.equal(s.lev, null); assert.equal(s.cash, c + Math.round(100 * M * T.perk_guts)); assert.equal(s.gutsUsed, true); }
});
ok('돌발 사건: 16개 모두 두 선택지가 끝까지 돌고, 돈이 음수가 되거나 숫자가 깨지지 않는다', () => {
  assert.ok(R.EVENTS.length >= 14);
  for (const e of R.EVENTS) for (const k of ['a', 'b']) for (let seed = 1; seed <= 6; seed++) {
    const s = R.create(seed); s.tier = e.tier[1]; s.cash = 100 * M * R.scale(s); s.hp = 50; s.day = 3; s.event = e.id; s.ev.length = 0;
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
    while (s.day < 28) {
      while (s.offer) R.pickPerk(s, safePerk(s)); // 특성을 고르지 않고 두면 그 아침에는 사건이 뜨지 않는다
      if (s.event) { const e = R.EVENTS.find(x => x.id === s.event); assert.ok(s.tier >= e.tier[0] && s.tier <= e.tier[1], e.id + ' @tier ' + s.tier); if (!e.again) assert.ok(!seen.includes(e.id)); seen.push(e.id); assert.ok(s.day >= T.event_from); R.choose(s, 'b'); assert.equal(s.event, null); }
      if (s.day === 4 && s.tier === 0) { s.cash += T.gosiwon_need; R.move(s, 1); R.move(s, 2); } if (s.day === 12 && s.tier === 2) { s.cash += 600 * M; R.move(s, 3); }
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
  const h = R.create(1); h.tier = 3; h.cash = 4000 * M; R.buyHouse(h); assert.ok(h.ach.includes('home') && h.ach.includes('rankS'));
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
      R.doStudy(a, 'buldak'); R.doJob(a, 'flyer', 0.95); R.doJob(a, 'flyer', null); for (let i = 0; i < 3; i++) R.doRest(b);
      R.endDay(a); R.endDay(b); R.nextDay(a); R.nextDay(b);
    }
    assert.deepEqual(a.market.px, b.market.px, '행동에 따라 시세가 달라짐'); assert.deepEqual(a.market.news.map(n => n.head + n.truth), b.market.news.map(n => n.head + n.truth));
  });
  const h = R.create(R.seedOf('SS-00A5'), '동여'); h.tier = 3; h.cash = 4000 * M; R.buyHouse(h); const card = R.resultCard(h);
  assert.ok(/1막 끝 · 내 집 마련 · S등급/.test(card) && /동여/.test(card) && /판 코드 SS-00A5/.test(card) && card.split('\n').length === 4, card);
  h.tier = 8; h.cash = T.top_worth; R.declareTop(h); const end = R.resultCard(h); assert.ok(/한국 최고 부자 · S등급/.test(end) && /판 코드 SS-00A5/.test(end) && end.split('\n').length === 4, end);
  assert.ok(/1막 끝/.test(R.resultCard(h, 'act1'))); assert.equal(R.resultCard(R.create(2)), '');
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
  const h = R.create(77, '동여'); h.tier = 3; h.cash = 4000 * M; R.buyHouse(h); assert.ok(/순자산 40,000,000원/.test(R.resultCard(h)), R.resultCard(h));
  const big = R.create(1679616 + 365); assert.equal(R.seedOf(R.codeOf(big.seed)), big.seed); assert.deepEqual(R.create(R.seedOf(R.codeOf(big.seed))).market.px, big.market.px);
});
ok('복권은 남는 장사가 아니고 찜질방부터 나온다, 공짜 리포트는 그날 공부를 막지 않는다', () => {
  let net = 0; const N = 4000;
  for (let seed = 1; seed <= N; seed++) { const s = R.create(seed); s.tier = 1; s.day = 3; s.cash = 10 * M; s.event = 'ticket'; R.choose(s, 'a'); net += s.cash - 10 * M; }
  assert.ok(net / N <= 0, '한 장당 평균 ' + Math.round(net / N)); assert.equal(R.EVENTS.find(e => e.id === 'ticket').tier[0], 1);
  let hit = 0;
  for (let seed = 1; seed < 40 && !hit; seed++) {
    const s = R.create(seed); s.tier = 2; s.day = 3; s.event = 'regular'; R.choose(s, 'a'); if (!R.intelView(s)) continue;
    hit = 1; const got = R.intelView(s).assets[0], before = JSON.stringify(R.intelView(s)); assert.equal(R.intelView(s).assets.length, 1); assert.equal(R.acts(s).find(a => a.id === 'study').ok, true);
    assert.ok(R.doStudy(s, got)); assert.equal(JSON.stringify(R.intelView(s)), before, '공부했더니 리포트가 다시 뽑힘'); assert.equal(R.doStudy(s, got), false);
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
  const t = R.create(1); t.cash = T.gosiwon_need; R.move(t, 1); assert.ok(R.move(t, 2)); R.buy(t, 'daejang', t.cash - 5 * M); t.cash += T.oneroom_need - T.gosiwon_need + 10 * M; R.buy(t, 'daejang', t.cash - 15 * M);
  assert.ok(t.cash < 50 * M && R.worth(t) >= T.oneroom_need * 0.99);
  t.market.px.daejang *= 1.05; assert.ok(R.moveInfo(t, 3).ok, R.moveInfo(t, 3).why); const c = t.cash; assert.ok(R.move(t, 3)); assert.equal(t.cash, c); assert.ok(R.holdValue(t, 'daejang') > 0, '주식은 그대로');
  const u = R.create(1); u.cash = T.gosiwon_need; R.move(u, 1); assert.ok(R.move(u, 2)); u.arrears = 30 * M; u.cash = 10 * M; u.hold.daejang.units = 1000; u.hold.daejang.cost = 1;
  const iu = R.moveInfo(u, 3); if (R.worth(u) >= T.oneroom_need) { assert.equal(iu.ok, false); assert.ok(/현금/.test(iu.why), iu.why); assert.equal(iu.pay, 30 * M + iu.settle); }
});
ok('주 고정비가 오른다 (고시원 > 40만 · 원룸 > 80만, 시작값 대비)', () => {
  assert.ok(T.gosiwon_week > 400000 && T.oneroom_week > 800000); assert.ok(!('gosiwon_deposit' in C) && !('oneroom_deposit' in C));
});
ok('예전 저장(v1, 보증금 있던 때)을 불러오면 보증금을 현금으로 돌려주고 새 칸을 채운다', () => {
  const s = R.create(9); s.cash = 100 * M; R.move(s, 1); R.move(s, 2); const o = JSON.parse(R.save(s));
  o.v = 1; o.deposit = T.gosiwon_need; o.cash = 20 * M; for (const k of ['den', 'evDay']) delete o[k]; delete o.market.shocks;
  const w1 = Math.round(o.cash + o.deposit);
  const t = R.load(JSON.stringify(o)); assert.ok(t); assert.equal(t.v, 3); assert.equal(t.deposit, 0); assert.equal(t.cash, 20 * M + T.gosiwon_need);
  assert.equal(R.worth(t), w1); assert.equal(t.den, null); assert.deepEqual(t.evDay, {}); assert.deepEqual(t.market.shocks, []);
  assert.ok(t.ev.some(e => e.t === 'sys' && /보증금/.test(e.text)));
  R.doJob(t, 'flyer', 0.8); R.doRest(t); R.doRest(t); R.endDay(t); R.nextDay(t); assert.ok(Number.isFinite(R.worth(t)));
  assert.equal(JSON.parse(R.save(t)).v, 3); assert.equal(R.load(JSON.stringify(Object.assign(o, { v: 4 }))), null);
});
ok('속보: 같은 씨앗이면 같은 속보, 내가 뭘 하든 같다 (공부 리포트에는 안 나옴)', () => {
  withTune({ shock_p: 1, event_p: 1 }, () => {
    const a = R.create(R.seedOf('SS-0Z9K')), b = R.create(R.seedOf('SS-0Z9K')), seenA = [], seenB = [];
    a.tier = 2; b.tier = 2; a.hp = b.hp = 1000;
    for (let d = 0; d < 14; d++) {
      for (const s of [a, b]) { if (s.event) R.choose(s, s === a ? 'a' : 'b'); if (s.den) { R.denBet(s, T.den_bet_1, 'odd'); R.denLeave(s); } while (s.offer) R.pickPerk(s, safePerk(s)); }
      R.doStudy(a, 'buldak'); assert.ok(!JSON.stringify(R.intelView(a) || {}).includes('속보'));
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
  const card = R.offerView(Object.assign(P(), { offer: ['coinonly', 'iron', 'sleep'] })); assert.equal(card[0].aug, true); assert.equal(card[0].con, '이 판 끝까지 주식을 살 수 없다 (가진 주식은 팔 수 있다)'); assert.equal(card[1].aug, false);
});
ok('양날은 레벨 3 · 6 · 9 의 고르기에만, 한 번에 한 장, 투자 무리(코인 외길 · 주식 외길 · 야수)는 한 판에 하나', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const s = R.create(seed); s.tier = 3; s.cash = 1000 * M; s.hp = 100000; s.quest = 99; let guard = 0; const augAt = [];
    while (s.lv < 11 && guard++ < 3000) {
      s.slot = 0; s.hp = 100000; R.doJob(s, 'flyer', 0.95); // 강철 체력을 고르면 체력이 최대치로 잘리므로 매번 채운다
      while (s.offer) {
        const lvFor = s.lv - s.picks + 1, v = R.offerView(s), augs = v.filter(c => c.aug);
        assert.ok(augs.length <= 1, 'Lv ' + lvFor + ' 양날 ' + augs.length);
        if (lvFor % 3) assert.equal(augs.length, 0, 'Lv ' + lvFor);
        const left = R.PERKS.filter(p => p.aug && !s.perks[p.id] && !(p.grp && R.PERKS.some(q => q.grp === p.grp && s.perks[q.id])));
        if (lvFor % 3 === 0 && left.length) assert.equal(augs.length, 1, 'Lv ' + lvFor);
        if (augs.length) augAt.push(lvFor);
        R.pickPerk(s, augs.length ? augs[0].id : (v.find(c => c.id !== 'hustle') || v[0]).id); // 일머리를 고르면 일중독(같은 무리)이 막혀 양날 칸이 비므로, 여기서는 일머리를 피한다
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
      while (s.day < 28) {
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
ok('고정비 알림은 전날과 당일에만, week 는 "N주차 M일"', () => {
  const s = R.create(1); s.cash = T.gosiwon_need; s.quest = 99; R.move(s, 1); assert.ok(R.move(s, 2)); const seen = {};
  for (let d = 1; d <= 8; d++) {
    const n = R.notices(s), w = R.week(s); seen[d] = n.map(x => x.kind + ':' + x.when).join(',');
    assert.equal(w.day, d); assert.equal(w.dow, (d - 1) % 7 + 1); assert.equal(w.week, d <= 7 ? 1 : 2); assert.ok(!('left' in w), '기한이 없어 left 는 없다'); assert.equal(w.billDay, true); assert.deepEqual(w.bill, R.bill(s));
    for (const x of n) { assert.ok(x.text && x.amt > 0); if (x.kind === 'bill') { assert.equal(x.amt, R.bill(s).amt); assert.ok(x.text.includes(R.won(x.amt))); } }
    day(s); if (s.event) R.choose(s, 'b');
  }
  assert.deepEqual(seen, { 1: '', 2: '', 3: '', 4: '', 5: '', 6: 'bill:tomorrow', 7: 'bill:today', 8: '' }); // 집값 인상 알림은 없어졌다
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
ok('퀘스트 바로 가기는 move · stock · coin · house · biz · top 만 (사다리 없음), 글에 화면 위치 말이 없다', () => {
  const s = R.create(1); const gos = new Set();
  for (let i = 0; i < 40; i++) { s.quest = i; const q = R.questView(s); if (!q) break; gos.add(q.go); assert.ok(!/사다리/.test(q.desc + q.title), q.id); assert.ok(!/\d만/.test(q.desc + q.title), q.id); }
  assert.deepEqual([...gos].filter(Boolean).sort(), ['biz', 'coin', 'house', 'move', 'stock', 'top']);
});
// ── 투자 균형 (공부 · 밤사이 갭 · 한탕바이오) ───────────────────
const eff = n => (n.truth ? n.dir : -n.dir); // 소식의 진짜 방향
ok('단골의 공짜 리포트는 종목 하나, 다른 종목을 공부하면 둘 다 남는다', () => {
  let hit = 0;
  for (let seed = 1; seed < 60 && !hit; seed++) {
    const s = R.create(seed); s.tier = 2; s.day = 3; s.event = 'regular'; R.choose(s, 'a'); if (!R.intelView(s)) continue;
    const got = R.intelView(s).assets[0], other = ['daejang', 'buldak', 'hantang'].find(a => a !== got);
    hit = 1; assert.ok(R.doStudy(s, other)); assert.deepEqual(R.intelView(s).assets.sort(), [got, other].sort()); assert.equal(R.doStudy(s, got), false, '하루 한 번');
  }
  assert.ok(hit);
});
ok('한탕바이오 리포트: 단계 · 시점은 안 알려 주고, 매집 중일 때만 진짜/털기 기울기 (다시 읽어도 같음)', () => {
  const read = (ht, rng3) => { const s = R.create(7); s.tier = 2; s.rng3 = rng3; s.market.ht = Object.assign({ from: s.market.px.hantang }, ht); assert.ok(R.doStudy(s, 'hantang')); return R.intelView(s).ht; };
  assert.deepEqual(read({ phase: 'gather', left: 3, real: true, hint: 0.1 }, 1), { state: 'lean', lean: 1 });
  assert.deepEqual(read({ phase: 'gather', left: 3, real: true, hint: 0.1 }, 999), { state: 'lean', lean: 1 }, '플레이어 쪽 난수와 무관');
  assert.deepEqual(read({ phase: 'gather', left: 3, real: true, hint: 0.9 }, 1), { state: 'lean', lean: -1 }, '틀리는 몫');
  assert.deepEqual(read({ phase: 'gather', left: 3, real: false, hint: 0.1 }, 1), { state: 'lean', lean: -1 });
  const soon = read({ phase: 'quiet', left: 1 }, 1); assert.deepEqual([soon.state, soon.lean], ['quiet', 0], '곧 시작해도 "조용"');
  assert.equal(soon.stale, true, '읽은 칸이 끝나며 알림이 떴으면 리포트는 낡았다고 표시'); assert.ok(/리포트 뒤에 거래량/.test(R.htText(soon)));
  assert.deepEqual(read({ phase: 'quiet', left: 4 }, 1), { state: 'quiet', lean: 0 });
  assert.deepEqual(read({ phase: 'pump', left: 2, real: true, hint: 0.1 }, 1), { state: 'late', lean: 0 });
  assert.ok(R.htText({ state: 'lean', lean: 1 }) && R.htText({ state: 'quiet', lean: 0 }));
});
ok('정확도: 공부 ≈ study_acc, 정보통 ≈ perk_tip_acc, 리딩방 ≈ chat_acc', () => {
  let st = [0, 0], tp = [0, 0], ch = [0, 0];
  for (let seed = 1; seed <= 500; seed++) {
    const s = R.create(seed); s.tier = 3; s.perks.tipster = 1; s.cash = 1e9;
    for (let d = 0; d < 3; d++) {
      s.hp = 100; R.doStudy(s, ['buldak', 'coin', 'daejang'][d]);
      const tomorrow = s.market.news.filter(n => n.day === s.day + 1);
      for (const it of R.intelView(s).items) { const n = tomorrow.find(x => x.asset === it.asset); st[0]++; if (it.dir === eff(n)) st[1]++; }
      while (s.slot < 3) R.doRest(s); R.endDay(s); R.nextDay(s); s.event = null;
      for (const n of R.todayNews(s)) if (n.report) { const raw = s.market.news.find(x => x.id === n.id); if (n.asset !== ['buldak', 'coin', 'daejang'][d]) { tp[0]++; if (n.report === eff(raw)) tp[1]++; } }
    }
    const c = R.create(seed); c.tier = 3; c.cash = 10 * M; c.event = 'chat'; R.choose(c, 'a'); // 1일째 소식으로 셈
    if (c.market.brief && c.market.brief.day === c.day) for (const it of c.market.brief.items) { ch[0]++; if (it.dir === eff(c.market.news.find(x => x.id === it.nid))) ch[1]++; }
  }
  const near = (x, want, tol, name) => assert.ok(x[0] > 100 && Math.abs(x[1] / x[0] - want) < tol, name + ' ' + (x[1] / x[0]).toFixed(3) + ' (' + x[0] + '건)');
  near(st, T.study_acc, 0.04, '공부'); near(tp, T.perk_tip_acc, 0.06, '정보통'); near(ch, T.chat_acc, 0.06, '리딩방');
});
ok('밤사이 갭: 아침 값 = 어제 마지막 값 × 먼저 들어간 몫, 차트는 하루 3점, 하루 전체 움직임은 소식의 진짜 효과 그대로', () => {
  withTune({ b_sigma: 0, d_sigma: 0, d_drift: 0, c_sigma: 0, c_momentum: 0, shock_p: 0 }, () => {
    let checked = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const s = R.create(seed); s.tier = 3; s.quest = 99;
      const L = s.market.hist.coin.length; while (s.slot < 3) R.doRest(s); R.endDay(s);
      const close = Object.assign({}, s.market.px); R.nextDay(s);
      assert.equal(s.market.hist.coin.length, Math.min(120, L + 3));
      const today = s.market.news.filter(n => n.day === s.day), gap = s.ev.find(e => e.t === 'gap');
      assert.equal(!!gap, today.length > 0);
      for (const id of ['daejang', 'buldak', 'coin']) {
        const pre = today.filter(n => n.asset === id).reduce((a, n) => a + n.pre, 0);
        assert.ok(Math.abs(s.market.px[id] - close[id] * Math.exp(pre)) < 1e-6 * close[id], id + ' 아침 값');
        assert.equal(s.market.hist[id][s.market.hist[id].length - 1], s.market.px[id], '차트 마지막 점 = 아침 값');
      }
      while (s.slot < 3) R.doRest(s);
      for (const id of ['daejang', 'buldak', 'coin']) {
        const want = today.filter(n => n.asset === id).reduce((a, n) => a + (n.truth ? n.dir : -n.dir * T.fake_back) * n.mag, 0);
        if (Math.abs(want) < 0.4) { assert.ok(Math.abs(Math.log(s.market.px[id] / close[id]) - want) < 1e-6, id + ' 하루 전체'); checked++; }
      }
    }
    assert.ok(checked > 30);
  });
  withTune({ news_priced: 0 }, () => { const s = R.create(3); s.tier = 3; while (s.slot < 3) R.doRest(s); R.endDay(s); const px = Object.assign({}, s.market.px); R.nextDay(s); assert.deepEqual(s.market.px, px); assert.ok(!s.ev.some(e => e.t === 'gap')); });
});
ok('밤사이 갭의 delta = 밤 정산 순자산 → 아침 순자산 차이 (주식 · 코인 포지션)', () => {
  let seen = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const s = R.create(seed); s.tier = 3; s.quest = 99; s.cash = 3000 * M;
    R.buy(s, 'buldak', 1000 * M); R.buy(s, 'daejang', 500 * M); R.levOpen(s, seed % 2 ? 1 : -1, 500 * M, 3);
    while (s.slot < 3) R.doRest(s); R.endDay(s); const night = s.last.worthEnd; R.nextDay(s);
    const gap = s.ev.find(e => e.t === 'gap'); if (!gap) { assert.equal(R.worth(s), night); continue; }
    assert.equal(R.worth(s) - night, gap.delta, 'seed ' + seed); assert.ok(gap.pct && Object.keys(gap.pct).length); if (gap.delta) seen++;
  }
  assert.ok(seen > 10);
});
ok('밤사이 갭으로 청산될 수 있다 (강심장도 적용, delta 에 포함)', () => {
  for (const guts of [0, 1]) {
    const s = R.create(5); s.tier = 3; s.quest = 99; s.cash = 300 * M; if (guts) s.perks.guts = 1;
    R.levOpen(s, 1, 100 * M, 5); while (s.slot < 3) R.doRest(s); R.endDay(s); const night = s.last.worthEnd;
    s.market.news.push({ id: 9999, day: s.day + 1, asset: 'coin', dir: -1, src: 'official', truth: true, mag: 0.4, pre: -0.35, head: '시험' });
    R.nextDay(s);
    const gap = s.ev.find(e => e.t === 'gap'); assert.equal(s.lev, null); assert.ok(s.ev.some(e => e.t === 'liq')); assert.equal(gap.liq, true);
    assert.equal(R.worth(s) - night, gap.delta); if (guts) assert.equal(s.gutsUsed, true);
  }
});
ok('한탕바이오: 알림은 진짜 · 가짜 매집 모두에 뜨고, 가짜는 급등 없이 폭락, 폭락 = 오른 만큼 + h_dump_base', () => {
  withTune({ shock_p: 0, h_gather_sigma: 0, h_quiet_sigma: 0 }, () => {
    let real = 0, fake = 0, alertsMissing = 0;
    for (let seed = 1; seed <= 25; seed++) {
      const s = R.create(seed); s.tier = 2; s.quest = 99; s.hp = 1000; s.cash = 1e9; // 고정비에 밀려 쫓겨나면(고시원 아래) 알림이 안 뜨는 것이 맞으니 돈을 넉넉히
      let pumpLen = 0, dumpFrom = null;
      for (let t = 0; t < 120; t++) {
        const ht = s.market.ht, before = ht.phase; s.ev.length = 0; R.doRest(s);
        const now = s.market.ht.phase, alert = s.ev.some(e => e.t === 'sys' && /거래량/.test(e.text));
        if (before === 'quiet' && now === 'gather' && !alert) alertsMissing++;
        if (now === 'gather' && before !== 'gather') pumpLen = 0;
        if (before === 'pump') pumpLen++;
        if (before === 'gather' && now === 'dump') { assert.equal(ht.real, false); fake++; }
        if (before === 'gather' && now === 'pump') { assert.equal(ht.real, true); real++; }
        if (before === 'pump' && now === 'dump') assert.ok(pumpLen >= T.h_pump_min && pumpLen <= T.h_pump_max, '급등 ' + pumpLen + '칸');
        if (now === 'dump' && before !== 'dump') { dumpFrom = { px: s.market.px.hantang, drop: s.market.ht.drop, from: s.market.ht.from }; assert.ok(Math.abs(dumpFrom.drop - (Math.max(0, Math.log(dumpFrom.px / dumpFrom.from)) + T.h_dump_base)) < 1e-9); }
        if (before === 'dump' && now === 'quiet' && dumpFrom) { assert.ok(Math.abs(Math.log(s.market.px.hantang / dumpFrom.px) + dumpFrom.drop) < 0.1, '폭락 크기'); dumpFrom = null; }
        if (s.slot >= 3) { R.endDay(s); R.nextDay(s); s.event = null; s.hp = 1000; }
      }
    }
    assert.equal(alertsMissing, 0); assert.ok(real > 10 && fake > 5, '진짜 ' + real + ' · 가짜 ' + fake);
  });
});
ok('균형 회귀: 공부 · 소식 · 한탕바이오 · 레버리지가 목표 띠 안 (씨앗 120 · 40일)', () => {
  const fee2 = (a, b) => (1 - T.fee) * (1 - T.fee) * b / a - 1;
  const levRet = (p, dir, L) => { let m = 1 - L * T.lev_fee; for (let i = 1; i < p.length; i++) { m -= L * T.lev_fund; if (m * (1 + dir * L * (p[i] / p[0] - 1)) <= 0) return -1; } return m * (1 + dir * L * (p[p.length - 1] / p[0] - 1)) - 1; };
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length, lose = a => a.filter(x => x < 0).length / a.length, med = a => a.slice().sort((x, y) => x - y)[a.length >> 1];
  const run = (seed, studyId) => { // 시장만: 쉬기 · 저녁 공부. 아침 값 · 틱 값 · 소식 · 리포트 · 한탕 알림 기록
    const s = R.create(seed); s.tier = 3; s.quest = 99; const px = { buldak: [], coin: [], hantang: [] }, days = [], alerts = [];
    const push = () => { for (const k in px) px[k].push(s.market.px[k]); }; push();
    for (let d = 0; d < 40; d++) {
      const rec = { i0: px.coin.length - 1, open: Object.assign({}, s.market.px), news: R.todayNews(s) }; s.event = null;
      for (let k = 0; k < 3; k++) { s.hp = 100; s.ev.length = 0; if (k === 2 && studyId) R.doStudy(s, studyId); else R.doRest(s); push(); if (s.ev.some(e => e.t === 'sys' && /거래량/.test(e.text))) alerts.push(px.coin.length - 1); }
      rec.intel = R.intelView(s); days.push(rec); R.endDay(s); R.nextDay(s); s.event = null; s.offer = null;
    }
    return { px, days, alerts };
  };
  withTune({ event_p: 0, den_from: 999, oneroom_week: 0 }, () => {
    const sb = [], c1 = [], news = [], ht = [], hold = [], ch1 = [], ch3 = [];
    for (let seed = 1; seed <= 120; seed++) {
      const b = run(seed * 7 + 1, 'buldak'), c = run(seed * 7 + 1, 'coin'), z = run(seed * 7 + 1, null); let w1 = 1, w3 = 1;
      for (let d = 1; d < 40; d++) {
        const i0 = b.days[d].i0, ib = b.days[d - 1].intel.items.find(i => i.asset === 'buldak'); if (ib && ib.dir > 0) sb.push(fee2(b.px.buldak[i0], b.px.buldak[i0 + 3]));
        const ic = c.days[d - 1].intel.items.find(i => i.asset === 'coin'); if (ic) { const p = c.px.coin.slice(i0, i0 + 4), r1 = levRet(p, ic.dir, 1), r3 = levRet(p, ic.dir, 3); c1.push(r1); w1 *= 1 + r1; w3 *= 1 + r3; }
        const o = z.days[d].news.find(n => n.asset === 'buldak' && n.src === 'official'); if (o && o.dir > 0) news.push(fee2(z.days[d].open.buldak, z.px.buldak[i0 + 3]));
      }
      ch1.push(w1); ch3.push(w3);
      const h = z.px.hantang; hold.push(h[h.length - 1] / h[0] - 1);
      for (const a of z.alerts) { if (a + 12 > h.length - 1) continue; let out = a + 12; for (let t = a + 1; t <= a + 12; t++) { const g = Math.log(h[t] / h[t - 1]); if (g > 0.05 || g < -0.05) { out = t; break; } } ht.push(fee2(h[a], h[out])); }
    }
    const P = v => (v * 100).toFixed(1) + '%';
    console.log('    공부 화끈 ' + P(mean(sb)) + ' 잃음 ' + P(lose(sb)) + ' · 코인 1배 ' + P(mean(c1)) + ' · 공시만 따라 ' + P(mean(news)) + ' · 한탕 ' + P(mean(ht)) + ' 잃음 ' + P(lose(ht)) + ' · 한탕 보유 ' + P(mean(hold)) + ' · 코인 전부 40일 중앙 1배 ' + med(ch1).toFixed(2) + ' 3배 ' + med(ch3).toFixed(2));
    assert.ok(mean(sb) > 0.015 && mean(sb) < 0.045 && lose(sb) >= 0.3, '공부 화끈');
    assert.ok(mean(c1) > 0.01 && mean(c1) < 0.035 && lose(c1) >= 0.3, '공부 코인');
    assert.ok(mean(news) < 0.015, '공시만 따라 사기');
    assert.ok(mean(ht) > 0.015 && mean(ht) < 0.07 && lose(ht) > 0.3 && lose(ht) < 0.55, '한탕 알림 타기');
    assert.ok(mean(hold) < 0, '한탕 보유');
    assert.ok(med(ch3) < med(ch1), '코인 3배 전부 걸기가 1배보다 나으면 안 됨');
  });
});
ok('예전 저장(공부 · 한탕바이오가 바뀌기 전)을 불러와도 값이 깨지지 않고 공부할 수 있다', () => {
  const s = R.create(12); s.tier = 3; const o = JSON.parse(R.save(s));
  o.market.ht = { phase: 'gather', left: 2 }; delete o.market.gap;
  o.market.intel = { day: o.day + 1, madeOn: o.day, items: [{ nid: 1, asset: 'buldak', dir: 1 }], ht: { phase: 'gather', soon: true } };
  const t = R.load(JSON.stringify(o)); assert.ok(t);
  assert.deepEqual(R.intelView(t).assets, ['buldak']); assert.equal(R.intelView(t).ht, null);
  for (let i = 0; i < 30; i++) { t.hp = 100; if (t.slot >= 3) { R.endDay(t); R.nextDay(t); t.event = null; t.offer = null; } else R.doRest(t); }
  assert.ok(Object.values(t.market.px).every(Number.isFinite), JSON.stringify(t.market.px));
  t.hp = 100; while (t.slot >= 3 || t.phase !== 'day') { if (t.phase === 'night') R.nextDay(t); else R.endDay(t); t.event = null; }
  assert.ok(R.doStudy(t, 'coin'));
});
// ── iteration 4: 기한 없음 · 사다리 · 주담대 · 압류 · 사업 ─────────────
const home = (cash, seed) => { const s = R.create(seed || 31); s.quest = 99; s.tier = 3; s.movedDay = 1; s.stats.maxTier = 3; s.cash = cash; return s; }; // 원룸에서 시작
const toSunday = s => { while (s.day % 7) day(s); while (s.slot < 3) R.doRest(s); }; // 일요일 밤 정산 직전까지
const climb = (s, to, loanFrac) => { for (let t = s.tier + 1; t <= to; t++) { const i = R.homeInfo(s, t); assert.ok(R.buyHome(s, t, t > 4 ? Math.floor(i.loanMax * (loanFrac == null ? 1 : loanFrac)) : 0), t + ' ' + i.why); } };
ok('내 집은 현금으로만: 투자한 돈은 안 쳐 주고, 사면 순자산 그대로, 1막 끝(act1)은 한 번만', () => {
  const s = home(T.price_home - 10 * M); R.buy(s, 'daejang', 0); s.cash = T.price_home - 10 * M;
  s.hold.daejang.units = 1e6; s.hold.daejang.cost = 1; assert.ok(R.worth(s) > T.price_home);
  const i = R.homeInfo(s, 4); assert.equal(i.ok, false); assert.equal(i.canLoan, false); assert.equal(i.loanMax, 0); assert.ok(/현금/.test(i.why), i.why); assert.equal(R.buyHouse(s), false);
  s.hold.daejang.units = 0; s.hold.daejang.cost = 0; s.cash = T.price_home; const w = R.worth(s);
  assert.deepEqual(Object.keys(R.homeInfo(s, 4)).sort(), ['canLoan', 'down', 'fixed', 'full', 'have', 'loanMax', 'ok', 'pay', 'price', 'sell', 'settle', 'weekly', 'why'].sort());
  assert.ok(R.buyHome(s, 4, 99999999), '대출을 달라 해도 내 집은 0으로'); assert.equal(s.loan, null); assert.equal(s.cash, 0); assert.equal(s.tier, 4); assert.equal(s.homeVal, T.price_home);
  assert.equal(R.worth(s), w, '순자산 그대로'); assert.equal(s.ended, null);
  const a = s.ev.filter(e => e.t === 'act1'); assert.equal(a.length, 1); assert.deepEqual(Object.keys(a[0]).sort(), ['day', 'rank', 't']); assert.equal(s.act1.day, 1); assert.equal(s.act1.rank, 'S');
  s.ev.length = 0; s.tier = 3; s.homeVal = 0; s.cash = T.price_home; R.buyHome(s, 4, 0); assert.ok(!s.ev.some(e => e.t === 'act1'), '두 번째 내 집에는 act1 없음');
  assert.equal(R.homeInfo(home(1e12), 5).ok, false, '한 칸씩만 오른다');
});
ok('아파트를 대출 최대로 사면 현금은 down 만큼만 줄고 순자산 그대로, 살던 집 값이 보태진다', () => {
  const s = home(T.price_home); R.buyHouse(s); s.cash = 0;
  const i = R.homeInfo(s, 5);
  assert.equal(i.price, T.price_apt); assert.equal(i.sell, T.price_home); assert.equal(i.loanMax, Math.floor(T.price_apt * T.loan_ltv / 10000) * 10000); assert.ok(i.canLoan);
  assert.equal(i.full, T.price_apt - T.price_home); assert.equal(i.down, i.full - i.loanMax); assert.equal(i.fixed, R.weekCost(s, 5));
  assert.equal(i.weekly, Math.round(i.loanMax * T.loan_rate / 1000) * 1000 + Math.round(i.loanMax / T.loan_weeks / 1000) * 1000);
  if (i.down > 0) { assert.equal(i.ok, false); s.cash = i.down - 1; assert.equal(R.buyHome(s, 5, i.loanMax), false); }
  s.cash = i.down + 5 * M; const w = R.worth(s), c = s.cash;
  assert.equal(R.buyHome(s, 5, i.loanMax - 10 * M), false, '대출을 줄이면 현금이 더 든다');
  assert.ok(R.buyHome(s, 5, i.loanMax)); assert.equal(s.cash, c - i.down); assert.equal(R.worth(s), w); assert.equal(s.homeVal, T.price_apt);
  const l = R.loanView(s); assert.deepEqual(Object.keys(l), ['balance', 'orig', 'weekly', 'interest', 'principal', 'left']); assert.equal(l.balance, i.loanMax); assert.equal(l.weekly, i.weekly); assert.equal(l.left, T.loan_weeks);
  const t = home(T.price_home); R.buyHouse(t); t.cash = 1e10; assert.ok(R.buyHome(t, 5, 0)); assert.equal(t.loan, null); assert.equal(R.loanView(t), null);
});
ok('일요일 밤에 고정비 + 원리금이 함께 나가고, 원금만큼 대출이 줄어 순자산은 이자 · 고정비만큼만 준다', () => {
  const s = home(1e9); climb(s, 5); s.cash = 5e8; const l0 = R.loanView(s);
  toSunday(s); const b = R.bill(s); assert.equal(b.inDays, 0); assert.equal(b.days, 7);
  assert.deepEqual(Object.keys(b), ['amt', 'week', 'loan', 'interest', 'principal', 'arrears', 'days', 'inDays']);
  assert.equal(b.week, R.weekCost(s)); assert.equal(b.loan, l0.weekly); assert.equal(b.amt, b.week + b.loan);
  const c = s.cash, w = R.worth(s); R.endDay(s);
  assert.equal(s.cash, c - b.amt); assert.equal(s.loan.balance, l0.balance - l0.principal); assert.equal(R.worth(s), w - b.week - b.interest);
  assert.deepEqual(s.last.billed, { paid: true, amt: b.amt, loan: b.loan, days: 7, foreclosed: false }); assert.equal(s.stats.loanPaid, 1);
  assert.equal(s.last.invest, 0, '원금 갚기가 투자 손익에 섞이지 않음');
  R.nextDay(s); while (s.day % 7 !== 6) day(s); assert.ok(R.notices(s)[0].text.includes('고정비 · 원리금'), '전날 알림에 원리금도');
});
ok('청구일 전에 산 집은 그 주에 산 날만큼만 (고정비 · 원리금 모두)', () => {
  const s = home(1e9); while (s.day < 4) day(s); climb(s, 5); const b = R.bill(s);
  assert.equal(b.days, 4); assert.equal(b.week, Math.round(R.weekCost(s) * 4 / 7 / 1000) * 1000); assert.ok(b.loan < R.loanView(s).weekly && b.loan > 0);
});
ok('미리 갚으면 다음 주 원리금의 이자가 준다, 다 갚으면 대출이 없어진다 (칸 안 씀)', () => {
  const s = home(1e9); climb(s, 5); s.cash = 3e8; const l0 = R.loanView(s), slot = s.slot;
  assert.ok(R.repay(s, l0.balance / 2)); assert.equal(s.slot, slot); const l1 = R.loanView(s);
  assert.ok(l1.interest < l0.interest); assert.equal(l1.principal, l0.principal); assert.equal(l1.balance, l0.balance - Math.floor(l0.balance / 2));
  assert.equal(R.repay(s, 0), false); assert.equal(R.repay(s, NaN), false);
  assert.ok(R.repay(s, 1e12)); assert.equal(s.loan, null); assert.ok(s.ach.includes('loanfree')); assert.ok(s.ev.some(e => e.t === 'loan_done'));
  assert.equal(R.repay(s, 1), false); assert.equal(R.bill(s).loan, 0);
});
ok('한 번 밀리면 연체(빚 + 연체료), 두 번 연속이면 압류: 값의 foreclose_rate 에 팔려 대출 · 빚을 갚고 한 단계 아래 집으로 (남은 돈으로, 모자라면 대출)', () => {
  const s = home(1e9); climb(s, 6); s.cash = 2e8; const price6 = s.homeVal;
  toSunday(s); R.endDay(s); assert.equal(s.last.billed.paid, true); R.nextDay(s); s.cash = 0; // 한 주는 제때 내고, 그다음부터 밀린다
  toSunday(s); const b = R.bill(s), bal0 = s.loan.balance; R.endDay(s);
  assert.equal(s.last.billed.paid, false); assert.equal(s.last.billed.foreclosed, false); assert.equal(s.missed, 1); assert.equal(s.arrears, Math.round(b.amt * (1 + T.late_fee) / 1000) * 1000);
  assert.equal(s.loan.balance, bal0 - b.principal, '못 낸 원금은 빚으로 옮겨 감'); assert.equal(s.tier, 6); assert.ok(/압류/.test(s.last.notes[0].text));
  R.nextDay(s); s.cash = 0; toSunday(s); const w = R.worth(s), b2 = R.bill(s), debt = s.loan.balance - b2.principal + Math.round(b2.amt * (1 + T.late_fee) / 1000) * 1000; s.ev.length = 0; R.endDay(s);
  assert.equal(s.last.billed.foreclosed, true); assert.equal(s.tier, 5); assert.equal(s.arrears, 0); assert.equal(s.missed, 0); assert.equal(s.stats.foreclosed, 1); assert.ok(s.ach.includes('foreclosed') || (R.nextDay(s), s.ach.includes('foreclosed')));
  const f = s.ev.find(e => e.t === 'foreclose'); assert.ok(f); assert.equal(f.from, 6); assert.equal(f.to, 5); assert.equal(f.sold, Math.round(price6 * T.foreclose_rate / 1000) * 1000); assert.equal(f.left, 0);
  assert.equal(f.repaid, debt); assert.ok(R.worth(s) < w, '순자산이 준다'); assert.ok(R.worth(s) <= w - price6 * (1 - T.foreclose_rate) + 1);
  assert.equal(s.homeVal, T.price_apt); assert.ok(s.loan && s.loan.balance === T.price_apt - (f.sold - f.repaid), '남은 돈으로 아파트, 모자란 만큼만 대출'); assert.ok(s.cash >= 0);
});
ok('한 번의 압류 = 꼭 한 단계: 판 돈으로 못 갚은 빚은 아래 집 대출에 얹고(집값을 넘는 몫은 탕감), 다시 두 번 밀리면 또 한 단계, 내 집 아래는 원룸', () => {
  const s = home(1e9); climb(s, 6); s.homeVal = s.loan.balance * 0.9; s.cash = 0; // 산 값이 크게 떨어진 것처럼 (팔아도 대출을 다 못 갚는다)
  s.missed = 1; s.arrears = 1e8; toSunday(s); while (s.slot < 3) R.doRest(s); s.cash = 0; s.ev.length = 0; R.endDay(s);
  const f = s.ev.find(e => e.t === 'foreclose'); assert.ok(f && f.from === 6 && f.to === 5, JSON.stringify(f)); assert.equal(s.tier, 5);
  assert.equal(f.loan, T.price_apt, '현금이 없으면 아파트값 전부가 대출'); assert.equal(s.loan.balance, f.loan); assert.ok(f.left > 0, '아파트값을 넘는 빚은 탕감'); assert.equal(s.cash, 0); assert.ok(Number.isFinite(R.worth(s)));
  const v = home(1e9); climb(v, 6); v.homeVal = v.loan.balance * 0.9; v.missed = 1; v.arrears = 1e8; toSunday(v); while (v.slot < 3) R.doRest(v); v.cash = T.price_apt * 0.9; v.ev.length = 0; R.endDay(v);
  const k = v.ev.find(e => e.t === 'foreclose'); assert.equal(k.to, 5); assert.ok(k.carried > 0, JSON.stringify(k)); assert.equal(k.loan, T.price_apt - Math.round(T.price_apt * 0.9) + k.carried, '내 현금으로 집을 사고, 못 갚은 빚은 그 대출에 얹힘'); assert.equal(v.cash, 0);
  R.nextDay(s); s.missed = 1; s.arrears = 1; toSunday(s); while (s.slot < 3) R.doRest(s); s.cash = 0; s.ev.length = 0; R.endDay(s);
  assert.equal(s.tier, 4, '또 두 번 밀리면 또 한 단계'); const g = s.ev.find(e => e.t === 'foreclose'); assert.equal(g.to, 4); assert.equal(s.homeVal, T.price_home); assert.ok(s.loan && s.loan.balance <= T.price_home, '내 집에도 압류로 온 빚은 대출로 남는다');
  const u = home(1e9); climb(u, 6); u.homeVal = 2 * T.price_house; u.missed = 1; u.arrears = 1; toSunday(u); while (u.slot < 3) R.doRest(u); u.cash = 0; u.ev.length = 0; R.endDay(u); // 판 돈이 빚보다 크면
  const h = u.ev.find(e => e.t === 'foreclose'); assert.equal(h.to, 5); assert.equal(h.carried, 0); assert.equal(h.left, 0); assert.equal(u.loan, null, '남은 돈으로 아파트를 사서 대출이 없음'); assert.equal(u.cash, h.sold - h.repaid - T.price_apt);
  const t = home(T.price_home); R.buyHouse(t); t.cash = 0; t.missed = 1; t.arrears = 1e8; toSunday(t); R.endDay(t);
  assert.equal(t.tier, 3); assert.equal(t.homeVal, 0); assert.equal(t.loan, null); assert.equal(t.arrears, 0); assert.equal(t.last.billed.foreclosed, true); assert.ok(R.unlocked(t, 'coin'));
  R.nextDay(t); assert.equal(R.bill(t).days, 7, '내려간 곳은 다음 날(월요일)부터 셈'); assert.equal(R.bill(t).week, R.weekCost(t, 3));
});
ok('살던 집을 팔고 올라가면 대출이 정리되고 새 대출만 남는다 (순자산은 그대로)', () => {
  const s = home(1e9); climb(s, 5); s.cash = 2e9; const old = s.loan.balance, w = R.worth(s);
  const i = R.homeInfo(s, 6); assert.equal(i.sell, T.price_apt - old); s.ev.length = 0;
  assert.ok(R.buyHome(s, 6, i.loanMax)); assert.equal(s.loan.balance, i.loanMax); assert.equal(s.loan.orig, i.loanMax); assert.equal(R.worth(s), w);
  const e = s.ev.find(x => x.t === 'tier'); assert.equal(e.sold, T.price_apt); assert.equal(e.repaid, old); assert.equal(e.up, true);
  assert.ok(!s.ach.includes('loanfree'), '팔아서 정리한 것은 "다 갚음"이 아니다');
});
ok('사업: 단계마다 사는 곳 조건(가게 = 내 집 …)과 값, 일당 × biz_mult^단계, 팁도 같은 배수', () => {
  const s = home(1e12); const pay = () => R.acts(s).find(a => a.id === 'flyer').pay, p0 = pay();
  const v = R.bizView(s); assert.deepEqual(Object.keys(v), ['lv', 'name', 'mult', 'eff', 'effName', 'effMult', 'next']); assert.equal(v.next.ok, false); assert.ok(/내 집/.test(v.next.why)); assert.equal(R.bizUp(s), false);
  for (let lv = 1; lv <= 5; lv++) {
    climb(s, 3 + lv); const n = R.bizView(s).next; assert.equal(n.lv, lv); assert.equal(n.cost, T['biz_cost_' + lv]); assert.equal(n.needTier, 3 + lv);
    const c = s.cash, w = R.worth(s); assert.ok(R.bizUp(s)); assert.equal(s.cash, c - n.cost); assert.equal(R.worth(s), w - n.cost, '쓴 돈은 자산으로 안 남음'); assert.equal(R.bizUp(s), false, '다음 단계는 한 칸 위 집부터');
    assert.equal(pay(), Math.round(p0 * Math.pow(T.biz_mult, lv) / 1000) * 1000, 'lv ' + lv);
  }
  assert.equal(R.bizView(s).next, null); assert.ok(s.ach.includes('chaebol'));
  s.hp = 100; s.quest = 99; const c = s.cash; R.doJob(s, 'flyer', 0.5); assert.equal(s.cash - c, Math.round(p0 * Math.pow(T.biz_mult, 5) / 1000) * 1000); assert.ok(s.today.income.some(r => /재벌 수입/.test(r.label)));
  withTune({ tip_p: 1 }, () => { s.slot = 0; s.hp = 100; s.ev.length = 0; R.doJob(s, 'flyer', 0.99); const tip = s.ev.find(e => e.t === 'tip'); assert.ok(tip.amt >= T.tip_min * Math.pow(T.biz_mult, 5)); });
});
ok('압류로 내려가면 일당에 반영되는 단계가 깎이고, 다시 올라가면 돌아온다 (단계는 남음)', () => {
  const s = home(1e12); climb(s, 6); R.bizUp(s); climb(s, 6); R.bizUp(s); R.bizUp(s); assert.equal(s.biz, 3);
  const pay = () => R.acts(s).find(a => a.id === 'flyer').pay, top = pay();
  s.cash = 0; s.missed = 1; s.arrears = 1; toSunday(s); s.cash = 0; R.endDay(s); assert.equal(s.tier, 5); assert.equal(s.biz, 3); // 쉬는 칸에도 자동 수입이 들어오므로 정산 직전에 비움
  assert.equal(R.bizView(s).eff, 2); assert.equal(R.bizView(s).effMult, Math.pow(T.biz_mult, 2)); assert.equal(Math.round(pay() * T.biz_mult / 1000) * 1000, Math.round(top / 1000) * 1000);
  R.nextDay(s); s.cash = 1e12; climb(s, 6); assert.equal(R.bizView(s).eff, 3); assert.equal(pay(), top);
});
ok('scale: 사건 돈 · 퀘스트 보상 · 도박장 판돈이 사는 곳에 따라 커진다 (원룸까지는 그대로)', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8].map(t => { const s = R.create(1); s.tier = t; return R.scale(s); }), [1, 1, 1, 1, T.tier_scale_4, T.tier_scale_5, T.tier_scale_6, T.tier_scale_7, T.tier_scale_8]);
  const ev = (tier, id, k) => { const s = R.create(3); s.tier = tier; s.day = 5; s.quest = 99; s.cash = 1e12; s.event = id; const v = R.eventView(s); R.choose(s, k); return { v, fx: s.ev.find(e => e.t === 'event_done').fx }; };
  const a = ev(3, 'envelope', 'a'), b = ev(6, 'envelope', 'a'); assert.equal(a.v.a.cost, 50000); assert.equal(b.v.a.cost, 50000 * T.tier_scale_6); assert.equal(b.fx.cash, -50000 * T.tier_scale_6);
  assert.ok(/40,000,000원/.test(ev(8, 'chat', 'b').v.text) === (50000 * T.tier_scale_8 === 40000000));
  const d = R.create(4); d.tier = 7; d.cash = 1e12; d.quest = 99; den(d); assert.deepEqual(R.denView(d).bets.map(x => x.amt), [T.den_bet_1, T.den_bet_2, T.den_bet_3, T.den_bet_4].map(x => x * T.tier_scale_7));
  assert.ok(R.denBet(d, T.den_bet_2 * T.tier_scale_7, 'odd')); assert.equal(R.denBet(d, T.den_bet_2, 'odd'), false, '원래 판돈은 못 건다');
  const q = R.create(1); q.tier = 5; q.loan = { balance: 1e8, orig: 1e8, day: 1 }; q.stats.maxTier = 5; q.biz = 1; q.homeVal = T.price_apt; q.cash = 0;
  q.quest = 14; const qv = R.questView(q); assert.equal(qv.id, 'repay1'); assert.equal(qv.reward, R.won(T.q_repay_cash * T.tier_scale_5));
});
ok('최고 부자는 호텔에서, 순자산 기준을 넘어야만 선언 = 엔딩 (등급은 걸린 날로)', () => {
  const s = home(1e12); climb(s, 7); assert.equal(R.declareTop(s), false, '별장에서는 못 함'); climb(s, 8);
  s.cash = 0; s.homeVal = T.top_worth - 1; s.loan = null; assert.equal(R.worth(s), T.top_worth - 1); assert.equal(R.declareTop(s), false); assert.ok(/모자랍니다/.test(s.ev.filter(e => e.t === 'deny').pop().why)); assert.equal(s.ended, null);
  const g = R.goalView(s); assert.deepEqual(Object.keys(g).sort(), ['canBuy', 'have', 'kind', 'name', 'need', 'pct', 'price', 'tier'].sort()); assert.equal(g.kind, 'top'); assert.equal(g.tier, 9); assert.equal(g.canBuy, false);
  s.cash = 1; assert.equal(R.goalView(s).canBuy, true); s.ev.length = 0; assert.ok(R.declareTop(s));
  assert.equal(s.ended.kind, 'top'); assert.equal(s.ended.worth, T.top_worth); assert.equal(s.ended.rank, 'S'); assert.ok(s.ev.some(e => e.t === 'ending' && e.kind === 'top')); assert.ok(s.ach.includes('top')); assert.equal(R.questView(s), null);
  assert.equal(R.nextDay(s), false); assert.equal(R.buyHome(s, 9, 0), false);
  const late = home(0); late.tier = 8; late.day = T.rank_b + 1; late.cash = T.top_worth; R.declareTop(late); assert.equal(late.ended.rank, 'C');
});
ok('다음 목표(goalView): 빌려 사는 곳은 순자산 기준, 내 집은 현금, 아파트부터는 대출 최대일 때의 현금', () => {
  const s = R.create(1); s.cash = 0; let g = R.goalView(s); assert.equal(g.tier, 1); assert.equal(g.kind, 'home');
  const o = home(5 * M); g = R.goalView(o); assert.equal(g.tier, 4); assert.equal(g.price, T.price_home); assert.equal(g.need, T.price_home); assert.equal(g.have, 5 * M); assert.ok(Math.abs(g.pct - 5 * M / T.price_home) < 1e-9); assert.equal(g.canBuy, false);
  o.cash = T.price_home; R.buyHouse(o); g = R.goalView(o); assert.equal(g.tier, 5); assert.equal(g.need, R.homeInfo(o, 5).down); assert.equal(g.loanMax, R.homeInfo(o, 5).loanMax);
  while (o.slot < 3) R.doRest(o); R.endDay(o); assert.equal(o.last.goal.tier, 5); assert.equal(o.last.lastDay, false); assert.ok(o.last.house.price > 0);
});
ok('퀘스트: 내 집 → 가게 → 아파트 → 원리금 → … → 한국 최고 부자, 대출 없이 아파트를 사면 원리금 퀘스트는 건너뜀', () => {
  const s = home(1e12); s.quest = 11; let q = R.questView(s); assert.equal(q.id, 'house'); assert.equal(q.go, 'house'); assert.ok(q.desc.includes(R.won(T.price_home)));
  R.buyHouse(s); assert.equal(R.questView(s).id, 'shop'); assert.equal(R.questView(s).go, 'biz'); R.bizUp(s); q = R.questView(s); assert.equal(q.id, 'apt'); assert.ok(/주담대/.test(q.desc) && q.desc.includes(Math.round((1 - T.loan_ltv) * 100) + '%'));
  climb(s, 5); assert.equal(R.questView(s).id, 'repay1'); toSunday(s); R.endDay(s); R.nextDay(s); assert.equal(R.questView(s).id, 'corp');
  const ids = []; for (let i = 0; i < 40; i++) { s.quest = i; const v = R.questView(s); if (!v) break; ids.push(v.id); }
  assert.deepEqual(ids.slice(11), ['house', 'shop', 'apt', 'repay1', 'corp', 'house2', 'group', 'villa', 'big', 'hotel', 'chaebol', 'top']);
  const t = home(1e12); t.quest = 11; climb(t, 4); R.bizUp(t); climb(t, 5, 0); assert.equal(R.questView(t).id, 'corp', '대출 없이 샀으면 건너뜀');
});
ok('저장 v3: 대출 · 사업 · 집이 저장되고, v2 저장(28일 판)은 기한 없이 그대로 이어 간다', () => {
  const s = home(1e10); climb(s, 5); R.bizUp(s); const t = R.load(R.save(s));
  assert.equal(t.v, 3); assert.deepEqual(t.loan, s.loan); assert.equal(t.biz, s.biz); assert.equal(t.homeVal, s.homeVal); assert.deepEqual(t.act1, s.act1); assert.equal(R.worth(t), R.worth(s));
  const a = R.create(9); a.cash = 100 * M; R.move(a, 1); R.move(a, 2); while (a.day < 27) day(a); const o = JSON.parse(R.save(a));
  o.v = 2; for (const k of ['biz', 'loan', 'homeVal', 'act1']) delete o[k]; for (const k of ['foreclosed', 'loanPaid', 'loanDone', 'bizSpent']) delete o.stats[k];
  const b = R.load(JSON.stringify(o)); assert.ok(b); assert.equal(b.v, 3); assert.equal(b.biz, 0); assert.equal(b.loan, null); assert.equal(b.homeVal, 0); assert.equal(b.stats.foreclosed, 0); assert.equal(R.worth(b), R.worth(a));
  while (b.day < 32) day(b); assert.equal(b.ended, null); assert.ok(Number.isFinite(R.worth(b)));
  const e = JSON.parse(R.save(a)); e.v = 2; e.ended = { kind: 'home', day: 20, worth: 3e7, price: 3e7, rank: 'S' }; const c = R.load(JSON.stringify(e)); assert.equal(c.ended.kind, 'home'); assert.ok(/내 집 마련/.test(R.resultCard(c)));
});
ok('긴 판: 150일을 굴려도 기록 배열이 커지지 않고 느려지지 않는다, 큰 수(500억)도 표기 · 반올림이 깨지지 않는다', () => {
  const s = home(1e12, 5); const t0 = Date.now();
  while (s.day < 150) { if (s.event) R.choose(s, 'b'); while (s.offer) R.pickPerk(s, safePerk(s)); if (s.tier < 8) climb(s, s.tier + 1); while (R.bizView(s).next && R.bizView(s).next.ok) R.bizUp(s); while (s.slot < 3) { s.hp = 100; R.doJob(s, 'delivery', 0.8); } R.endDay(s); R.nextDay(s); }
  assert.ok(Date.now() - t0 < 3000, (Date.now() - t0) + 'ms'); assert.equal(s.day, 150);
  assert.ok(s.log.length <= 40 && Object.values(s.market.hist).every(h => h.length <= 120) && s.market.news.length < 10 && s.market.shocks.length < 5 && s.evSeen.length <= R.EVENTS.length, JSON.stringify([s.log.length, s.market.news.length]));
  assert.ok(R.save(s).length < 60000, '저장 크기 ' + R.save(s).length);
  assert.equal(R.won(50000000000), '50,000,000,000원'); assert.equal(R.num(-123456789012.4), '−123,456,789,012'); assert.equal(R.won(49999999999.6), '50,000,000,000원');
  assert.ok(Number.isInteger(R.worth(s)) && Number.isFinite(s.cash)); assert.ok(R.acts(s).every(a => a.kind !== 'job' || (Number.isInteger(a.pay) && a.pay % 1000 === 0)));
  const b = R.bill(s); assert.ok(Object.values(b).every(Number.isFinite) && b.amt % 1000 === 0);
});
ok('판 코드가 같으면 긴 판에서도(대출 · 압류 · 사업이 있어도) 시세가 같다', () => {
  const a = home(1e12, 77), b = home(0, 77), c = home(1e12, 77); climb(c, 5); c.cash = 0; // c: 아파트를 대출 최대로 사고 현금 0 — 일요일마다 못 내서 실제로 압류된다
  for (let d = 0; d < 40; d++) { for (const s of [a, b, c]) { if (s.event) R.choose(s, 'b'); while (s.offer) R.pickPerk(s, safePerk(s)); } if (a.tier < 8) climb(a, a.tier + 1); if (R.bizView(a).next && R.bizView(a).next.ok) R.bizUp(a); for (const s of [a, b, c]) { while (s.slot < 3) R.doRest(s); if (s === c) c.cash = 0; R.endDay(s); R.nextDay(s); } }
  assert.ok(c.stats.foreclosed > 0, '압류가 실제로 일어나야 함'); assert.ok(a.biz > 0 && a.loan, '사업 · 대출도');
  assert.deepEqual(a.market.px, b.market.px); assert.deepEqual(a.market.shocks, b.market.shocks); assert.deepEqual(c.market.px, a.market.px); assert.deepEqual(c.market.shocks, a.market.shocks);
});
ok('사건: 내 집부터 나오는 것이 있고(누수 · 인터뷰 · 장학금), 셋방 사건(코골이 · 보일러)은 원룸까지만', () => {
  for (const id of ['leak', 'interview', 'alumni']) { const e = R.EVENTS.find(x => x.id === id); assert.ok(e && e.tier[0] === 4 && e.tier[1] === 8, id); }
  for (const id of ['snore', 'wrench']) assert.ok(R.EVENTS.find(x => x.id === id).tier[1] <= 3, id);
  for (let t = 4; t <= 8; t++) assert.ok(R.EVENTS.filter(e => t >= e.tier[0] && t <= e.tier[1]).length >= 8, 'tier ' + t);
});
ok('사업 자동 수입: 가게부터 쉬기 · 공부 칸에도 "보통" 일당 × biz_auto_단계, 사건 auto · 정산 "사업 매출", 직접 뛰면 전부', () => {
  const s = home(1e12); s.hp = 100; assert.equal(R.acts(s).find(a => a.id === 'rest').auto, 0, '원룸에서는 없음'); const c0 = s.cash; R.doRest(s); assert.equal(s.cash, c0);
  climb(s, 4); R.bizUp(s); climb(s, 5); R.bizUp(s); assert.equal(R.bizView(s).eff, 2);
  const jobs = R.acts(s).filter(a => a.kind === 'job'), best = Math.max(...jobs.map(a => a.pay)), want = Math.round(best * T.mult_ok * T.biz_auto_2 / 1000) * 1000;
  const rest = R.acts(s).find(a => a.id === 'rest'), st = R.acts(s).find(a => a.id === 'study'); assert.equal(rest.auto, want); assert.equal(st.auto, want);
  s.ev.length = 0; const slot = s.slot, c = s.cash; R.doRest(s); assert.equal(s.cash, c + want);
  const e = s.ev.find(x => x.t === 'auto'); assert.deepEqual([e.amt, e.slot], [want, slot]); assert.ok(s.today.income.some(r => r.label === '사업 매출' && r.amt === want));
  s.hp = 100; const c2 = s.cash; R.doStudy(s, 'daejang'); assert.equal(s.cash, c2 + want, '공부 칸에도');
  while (s.slot < 3) R.doRest(s); R.endDay(s); assert.ok(s.last.income.some(r => r.label === '사업 매출' && r.amt === 2 * want), JSON.stringify(s.last.income)); // 쉬기 · 공부 두 칸
  R.nextDay(s); s.hp = 100; s.quest = 99; const c3 = s.cash, j = R.acts(s).find(a => a.id === 'flyer'); s.ev.length = 0; R.doJob(s, 'flyer', 0.5); assert.equal(s.cash - c3, j.pay, '직접 뛰면 그 일당 전부 (자동 수입은 겹치지 않음)'); assert.ok(!s.ev.some(x => x.t === 'auto'));
  assert.deepEqual([1, 2, 3, 4, 5].map(n => T['biz_auto_' + n]).every((v, i, a) => v > 0 && v < 1 && (!i || v >= a[i - 1])), true);
});
ok('체력: 내 집부터의 잠은 다 안 차고, 특성을 몰아도(잠 + 아침형 ≤ regen_max) 무거운 알바 셋을 매일 뛸 수 없다. 꿀잠은 2번까지', () => {
  assert.deepEqual([4, 5, 6, 7, 8].map(t => T[R.HOMES[t].sleep]), [58, 60, 62, 64, 66]); assert.equal(R.PERKS.find(p => p.id === 'sleep').max, 2);
  const heavy = 3 * Math.min(T.hp_loading, T.hp_delivery);
  for (let t = 0; t <= 8; t++) for (const sl of [0, 1, 2]) for (const ea of [0, 1, 2]) {
    const s = R.create(1); s.tier = t; s.perks.sleep = sl; s.perks.early = ea;
    assert.ok(R.sleepGain(s) + T.perk_early * ea < heavy, 'tier ' + t + ' 꿀잠 ' + sl + ' 아침형 ' + ea + ': ' + (R.sleepGain(s) + T.perk_early * ea));
  }
  const o = home(1e12, 3); o.perks.sleep = 2; o.perks.early = 1; o.perks.iron = 3; climb(o, 8); o.hp = R.hpMax(o); o.quest = 99; let blocked = 0; // 체력 특성 6장을 몰아도
  for (let d = 0; d < 30; d++) { for (let i = 0; i < 3; i++) if (!R.doJob(o, 'loading', 0.8)) { blocked++; R.doRest(o); } R.endDay(o); R.nextDay(o); while (o.offer) R.pickPerk(o, safePerk(o)); if (o.event) R.choose(o, 'b'); }
  assert.ok(blocked > 0, '30일 동안 한 번도 안 막힘');
});
ok('대출 안내 글은 "N회에 나눠 갚는다"로 (주담대를 끼고 살 때)', () => {
  const s = home(1e9); climb(s, 5); const t = s.ev.filter(e => e.t === 'sys').map(e => e.text).join(' ');
  assert.ok(t.includes(T.loan_weeks + '회에 나눠 갚고'), t);
});
ok('못 낸 원금으로 대출 잔액이 0 이 되어도 대출이 정리된다 (경고 글은 그대로, "빚 없는 삶"은 아님, repay1 은 건너뜀), 갚을 것이 없으면 "갚을 대출이 없습니다", 밤 · 도박장에서는 그 이유', () => {
  const s = home(1e12); climb(s, 5); s.quest = 0; while (R.questView(s) && R.questView(s).id !== 'repay1') s.quest++;
  assert.ok(R.repay(s, s.loan.balance - 50000)); assert.equal(s.loan.balance, 50000);
  toSunday(s); s.cash = 0; R.endDay(s);
  assert.equal(s.last.billed.paid, false); assert.equal(s.loan, null, '잔액 0 인 대출이 남으면 안 됨'); assert.ok(s.arrears >= 50000, '못 낸 원금은 빚으로');
  assert.ok(s.last.notes.some(n => /못 냈습니다/.test(n.text) && /한 번 더 밀리면 집이 압류/.test(n.text)), '못 낸 밤의 경고 글: ' + JSON.stringify(s.last.notes));
  { const r2 = R.create(1); r2.phase = 'night'; r2.loan = { balance: 1e6, orig: 1e6, day: 1 }; assert.equal(R.repay(r2, 1000), false); assert.ok(/낮에만/.test(r2.ev.pop().why)); r2.phase = 'day'; r2.den = { round: 0, max: 5, streak: 0, net: 0, last: null }; assert.equal(R.repay(r2, 1000), false); assert.ok(/도박장/.test(r2.ev.pop().why)); }
  R.nextDay(s); if (s.event) R.choose(s, 'b');
  assert.ok(!s.ach.includes('loanfree'), '빚으로 넘어간 것은 다 갚은 것이 아님'); assert.equal(s.stats.loanDone || 0, 0); assert.notEqual((R.questView(s) || {}).id, 'repay1', 'repay1 은 건너뜀(완료 아님)'); assert.equal(s.stats.loanPaid || 0, 0);
  s.ev.length = 0; assert.equal(R.repay(s, 10000), false); assert.equal(s.ev.find(e => e.t === 'deny').why, '갚을 대출이 없습니다');
  const t = home(1e9); t.loan = { balance: 0, orig: 100, day: 1 }; assert.equal(R.repay(t, 10000), false); assert.equal(t.ev.pop().why, '갚을 대출이 없습니다');
});
ok('고시원에서 쫓겨난 밤은 한 단계만(찜질방 요금을 안 받음), 알림 글은 실제로 일어난 일만 (주식이 없으면 "주식" 없음)', () => {
  const run = stock => {
    const s = R.create(1); s.cash = T.gosiwon_need; s.quest = 99; R.move(s, 1); assert.ok(R.move(s, 2)); s.cash = 0;
    while (s.day < 14) { day(s); if (s.event) R.choose(s, 'b'); while (s.offer) R.pickPerk(s, safePerk(s)); s.cash = 0; }
    while (s.slot < 3) R.doRest(s); if (stock) { s.hold.daejang.units = 10; s.hold.daejang.cost = 1; } R.endDay(s);
    return s;
  };
  const s = run(false), note = s.last.notes.map(x => x.text).join(' ');
  assert.equal(s.last.billed.evicted, true); assert.equal(s.tier, 1, '서울역까지 두 단계 떨어지면 안 됨'); assert.ok(!s.last.expense.some(r => r.label === '찜질방'), '그 밤 찜질방 요금 없음');
  assert.ok(/찜질방으로 내려갑니다/.test(note), note); assert.ok(!/주식/.test(note), note);
  const t = run(true), nt = t.last.notes.map(x => x.text).join(' '); assert.equal(t.tier, 1); assert.ok(/현금과 주식에서/.test(nt) || /주식은 그 자리 값에/.test(nt), nt); assert.equal(t.hold.daejang.units, 0);
  R.nextDay(s); if (s.event) R.choose(s, 'b'); while (s.slot < 3) R.doRest(s); s.cash = 0; R.endDay(s); assert.equal(s.tier, 0, '다음 밤부터는 찜질방 요금을 받는다');
});
ok('리딩방은 이미 아는 오늘 소식(어제 리포트 · 정보통)을 덮어쓰지 않고 모르는 것만 채운다', () => {
  withTune({ chat_acc: 1 }, () => {
    let s = null;
    for (let r = 1; r < 60; r++) {
      s = R.create(3); s.tier = 2; s.quest = 99; s.cash = 1e9; s.rng3 = r;
      s.market.news = [{ id: 901, day: s.day, asset: 'buldak', dir: 1, src: 'article', truth: true, mag: 0.05, head: 'a', pre: 0 }, { id: 902, day: s.day, asset: 'daejang', dir: -1, src: 'article', truth: false, mag: 0.05, head: 'b', pre: 0 }];
      s.market.brief = { day: s.day, madeOn: s.day - 1, ht: null, items: [{ nid: 901, asset: 'buldak', dir: -1, by: 'study' }] };
      s.event = 'chat'; R.choose(s, 'a'); if (s.market.brief.items.length === 2) break;
    }
    const it = s.market.brief.items; assert.equal(it.length, 2);
    assert.deepEqual(it.find(i => i.nid === 901), { nid: 901, asset: 'buldak', dir: -1, by: 'study' }, '어제 리포트는 그대로');
    assert.deepEqual([it.find(i => i.nid === 902).dir, it.find(i => i.nid === 902).by], [1, 'chat']);
  });
});
ok('자동 수입의 기준 일당은 체력과 무관하게 지금 열려 있는 알바 가운데 가장 많이 주는 것', () => {
  const s = home(1e12); climb(s, 4); assert.ok(R.bizUp(s)); s.hp = 100;
  const full = R.acts(s).find(a => a.id === 'rest').auto; s.hp = 0; const none = R.acts(s);
  assert.ok(full > 0); assert.equal(full, Math.round(Math.max(...R.acts(s).filter(a => a.kind === 'job').map(a => a.pay)) * T.mult_ok * T.biz_auto_1 / 1000) * 1000, '가장 많이 주는 알바의 보통 일당 × biz_auto'); assert.equal(none.find(a => a.id === 'rest').auto, full); assert.ok(none.filter(a => a.kind === 'job').every(a => !a.ok));
});
ok('체력이 모자라면 이유 글이 다음 행동까지 알려 준다', () => {
  const s = R.create(1); s.tier = 2; s.hp = 0;
  for (const a of R.acts(s)) if (a.kind === 'job' || a.kind === 'study') { assert.equal(a.ok, false); assert.ok(/체력이 모자랍니다 — 쉬거나 가벼운 일을/.test(a.why), a.why); assert.ok(a.why.length <= 22, a.why); }
});
ok('리포트 채점: 소식의 하루가 끝난 밤에 "말한 방향 · 진짜 방향 · 맞음/틀림" (사건 report_check · 밤 정산 reports), 리포트 글은 "열에 N 번쯤 맞음"', () => {
  const s = R.create(9); s.tier = 2; s.quest = 99; s.hp = 100;
  s.market.news = s.market.news.filter(n => n.day !== s.day + 1 || (n.asset !== 'buldak' && n.asset !== 'daejang'));
  s.market.news.push({ id: 950, day: s.day + 1, asset: 'buldak', dir: 1, src: 'article', truth: false, mag: 0.05, head: 'h', pre: 0 });
  assert.ok(R.doStudy(s, 'buldak')); const said = R.intelView(s).items[0].dir, txt = s.log.map(l => l.text).join(' ');
  assert.ok(/리포트: 내일 화끈식품 소식은 (오르는|내리는) 쪽 \(열에 여섯 번쯤 맞음\)/.test(txt), txt); assert.ok(!/기울여/.test(txt));
  assert.equal(R.accText(0.62), '열에 여섯 번쯤 맞음'); assert.equal(R.accText(0.8), '열에 여덟 번쯤 맞음');
  while (s.slot < 3) R.doRest(s); R.endDay(s); assert.deepEqual(s.last.reports, [], '공부한 날 밤에는 아직 채점 없음'); R.nextDay(s); if (s.event) R.choose(s, 'b'); while (s.offer) R.pickPerk(s, safePerk(s));
  s.ev.length = 0; while (s.slot < 3) R.doRest(s); R.endDay(s);
  const r = s.last.reports.find(x => x.asset === 'buldak'); assert.deepEqual(r, { asset: 'buldak', name: '화끈식품', said, real: -1, right: said === -1, by: 'study' });
  assert.ok(s.ev.some(e => e.t === 'report_check' && e.list.some(x => x.asset === 'buldak')));
  const q = R.create(9); q.tier = 2; q.quest = 99; q.hp = 100; q.market.news = q.market.news.filter(n => !(n.day === q.day + 1 && n.asset === 'daejang'));
  R.doStudy(q, 'daejang'); assert.ok(/리포트: 내일 대장전자는 소식 없음/.test(q.log.map(l => l.text).join(' ')));
  const h = R.create(9); h.tier = 2; h.quest = 99; h.hp = 100; h.market.ht = { phase: 'gather', left: 1, real: true, hint: 0.1, from: h.market.px.hantang };
  R.doStudy(h, 'hantang'); assert.ok(!h.today.reports.some(x => x.asset === 'hantang'), '매집이 끝나는 칸(급등 직전)에는 채점하지 않음');
  let g = 0, hr = null; while (!hr && g++ < 40) { if (h.event) R.choose(h, 'b'); while (h.offer) R.pickPerk(h, safePerk(h)); if (h.slot >= 3) { R.endDay(h); if (h.last.reports.some(x => x.asset === 'hantang')) break; R.nextDay(h); continue; } h.hp = 100; const ph = h.market.ht.phase; R.doRest(h); hr = (h.today.reports || []).find(x => x.asset === 'hantang'); if (hr) assert.ok(ph === 'dump' && h.market.ht.phase === 'quiet', '채점은 폭락까지 끝나 조용해진 뒤: ' + ph + ' → ' + h.market.ht.phase); }
  hr = hr || h.last.reports.find(x => x.asset === 'hantang'); assert.deepEqual([hr.said, hr.real, hr.right], [1, 1, true]);
  const ht = h.log.map(l => l.text).join(' '); assert.ok(/한탕바이오 리포트 맞음/.test(ht) && !/곧 (급등|폭락)/.test(ht), '예고 없이: ' + ht);
});
ok('한탕바이오 거래량 알림이 뜬 날은 htAlert 가 참 (다음 날 꺼짐), 사건 ht_alert, 계좌가 없으면 없음', () => {
  const s = R.create(9); s.tier = 2; s.quest = 99; s.market.ht = { phase: 'quiet', left: 1 }; s.ev.length = 0;
  assert.equal(R.htAlert(s), false); R.doRest(s); assert.equal(R.htAlert(s), true); assert.ok(s.ev.some(e => e.t === 'ht_alert'));
  while (s.slot < 3) R.doRest(s); R.endDay(s); R.nextDay(s); assert.equal(R.htAlert(s), false);
  const t = R.create(9); t.market.ht = { phase: 'quiet', left: 1 }; R.doRest(t); assert.equal(R.htAlert(t), false);
});
ok('이사한 주의 고정비 알림은 "(N일치)"를 붙인다 (주 고정비와 다른 까닭)', () => {
  const s = R.create(1); s.cash = T.gosiwon_need; s.quest = 99; R.move(s, 1); while (s.day < 2) day(s); s.cash = T.gosiwon_need + 50 * M; assert.ok(R.move(s, 2)); // 2일째에 입주 → 그 주는 6일
  while (s.day < 6) { day(s); if (s.event) R.choose(s, 'b'); while (s.offer) R.pickPerk(s, safePerk(s)); }
  const n = R.notices(s)[0], b = R.bill(s); assert.equal(b.days, 6); assert.ok(n && n.text.endsWith('(6일치)'), n && n.text); assert.ok(n.text.includes(R.won(b.amt)));
  while (s.day < 13) { day(s); if (s.event) R.choose(s, 'b'); while (s.offer) R.pickPerk(s, safePerk(s)); }
  assert.ok(!/일치/.test(R.notices(s)[0].text), '한 주를 다 산 주에는 안 붙음');
});
ok('한탕바이오 리포트 채점은 앞날을 흘리지 않는다: 여러 판에서 채점 뒤 다음 칸 방향을 채점 글로 맞히는 비율이 우연 수준, 알림 · 낡은 리포트 표시는 진짜 · 가짜에 똑같이', () => {
  let n2 = 0, hit = 0; const alert = { real: [], fake: [] };
  for (let seed = 1; seed <= 160; seed++) {
    const s = R.create(seed); s.quest = 99; s.tier = 2; s.movedDay = 1; s.stats.maxTier = 2; s.cash = 1e7;
    const go = () => { if (s.event) { R.choose(s, 'b'); return; } if (s.den) { R.denLeave(s); return; } if (s.offer) { R.pickPerk(s, safePerk(s)); return; } if (s.phase === 'night') { R.nextDay(s); return; } if (s.slot >= 3) { R.endDay(s); return; } s.hp = 100; s.ev.length = 0; R.doRest(s); };
    let g = 0; while (g++ < 300 && s.market.ht.phase !== 'gather') go();
    if (s.market.ht.phase !== 'gather') continue;
    const e = s.ev.find(x => x.t === 'ht_alert'); if (e) alert[s.market.ht.real ? 'real' : 'fake'].push(JSON.stringify(e) + s.ev.filter(x => x.t === 'sys' && /한탕/.test(x.text)).map(x => x.text + x.tone).join()); // 판 처음부터 매집 중인 판은 알림이 없으니 뺌
    while (s.phase !== 'day' || s.slot >= 3 || s.event || s.offer || s.den) go();
    s.hp = 100; if (!R.doStudy(s, 'hantang') || !s.market.htRead) continue;
    let msg = null; g = 0; while (g++ < 60 && !msg) { go(); msg = s.ev.find(x => x.t === 'report_check'); }
    if (!msg) continue;
    while (s.phase !== 'day' || s.slot >= 3 || s.event || s.offer || s.den) go();
    const p0 = s.market.px.hantang; s.hp = 100; R.doRest(s); const ch = s.market.px.hantang / p0 - 1;
    n2++; if (msg.list[0].real * ch > 0) hit++;
  }
  assert.ok(n2 >= 40, '표본 ' + n2); assert.ok(hit / n2 > 0.3 && hit / n2 < 0.7, '채점 뒤 다음 칸을 맞히는 비율 ' + hit + '/' + n2);
  assert.ok(alert.real.length > 10 && alert.fake.length > 10 && new Set(alert.real.concat(alert.fake)).size === 1, '거래량 알림(사건 · 글)이 진짜 · 가짜에 따라 다름: ' + JSON.stringify([...new Set(alert.real.concat(alert.fake))]));
  console.log('    한탕 채점 뒤 다음 칸 적중 ' + hit + '/' + n2);
});
// 일머리 · 일중독은 서로 못 가지는 짝 (같은 무리 'work'). levelUp: 레벨을 maxLv 까지 올리며 뜬 고르기를 모두 보고 pick 으로 고른다
const perkRun = (seed, init, maxLv, pick, look) => {
  const s = R.create(seed); s.tier = 3; s.cash = 1000 * M; s.hp = 100000; s.quest = 99; Object.assign(s.perks, init); let guard = 0;
  while (s.lv < maxLv && guard++ < 5000) { s.slot = 0; s.hp = 100000; R.doJob(s, 'flyer', 0.95); while (s.offer) { const lvFor = s.lv - s.picks + 1; if (look) look(s.offer.slice(), lvFor, s); R.pickPerk(s, pick(s.offer, s)); } }
  assert.ok(s.lv >= maxLv, 'Lv ' + s.lv); return s;
};
const pName = id => R.PERKS.find(p => p.id === id).name;
ok('일중독을 가진 판에서는 일머리가 한 번도 뜨지 않는다 (여러 씨앗 · 레벨 2~18)', () => {
  let looked = 0;
  for (let seed = 1; seed <= 10; seed++) perkRun(seed, { workaholic: 1 }, 18, o => o[0], (o, lv) => { looked++; assert.ok(!o.includes('hustle'), '씨앗 ' + seed + ' Lv ' + lv + ': ' + o); assert.ok(!o.includes('workaholic')); });
  assert.ok(looked >= 100, '본 고르기 ' + looked);
});
ok('일머리를 가진 판에서는 일중독이 한 번도 뜨지 않는다 (양날 칸에는 다른 양날이 뜬다)', () => {
  let augSeen = 0;
  for (let seed = 1; seed <= 10; seed++) perkRun(seed, { hustle: 1 }, 18, o => o.find(id => id !== 'hustle') || o[0], (o, lv) => {
    assert.ok(!o.includes('workaholic'), '씨앗 ' + seed + ' Lv ' + lv + ': ' + o);
    if (o.some(id => R.PERKS.find(p => p.id === id).aug)) augSeen++;
  });
  assert.ok(augSeen > 0, '일중독 말고 다른 양날은 여전히 뜬다');
  { const s = R.create(1); s.tier = 0; s.perks.hustle = 1; s.hp = 100000; s.quest = 99; s.cash = 100 * M; // 서울역(투자 양날이 아직 안 열림)에서 레벨 3: 뜰 양날이 없으면 보통 셋
    while (s.lv < 4) { s.slot = 0; s.hp = 100000; R.doJob(s, 'flyer', 0.95); while (s.offer) { assert.ok(!s.offer.includes('workaholic')); assert.equal(s.offer.length, Math.min(3, s.offer.length)); R.pickPerk(s, s.offer[0]); } } }
});
ok('일중독이 없으면 일머리를 최대 장수까지 찍을 수 있다 (둘째 장부터 스스로를 막지 않음)', () => {
  const max = R.PERKS.find(p => p.id === 'hustle').max;
  for (let seed = 1; seed <= 6; seed++) {
    const shown = {};
    const s = perkRun(seed, {}, 40, o => (o.includes('hustle') ? 'hustle' : o.find(id => id !== 'workaholic') || o[0]), (o, lv, st) => { if (o.includes('hustle')) shown[R.perk(st, 'hustle')] = 1; });
    assert.equal(R.perk(s, 'hustle'), max, '씨앗 ' + seed + ' 일머리 ' + R.perk(s, 'hustle'));
    for (let k = 1; k < max; k++) assert.ok(shown[k], '씨앗 ' + seed + ': ' + k + '장 가진 뒤에도 뜬다');
    assert.equal(R.perk(s, 'workaholic'), 0);
  }
});
ok('투자 무리(코인 외길 · 주식 외길 · 야수의 심장)는 전처럼 한 판에 하나, 일 무리와는 따로', () => {
  const inv = ['coinonly', 'stockonly', 'beast'];
  for (const held of inv) for (let seed = 1; seed <= 4; seed++) {
    let workSeen = 0;
    perkRun(seed, { [held]: 1 }, 15, o => o.find(id => !inv.includes(id) && id !== 'hustle') || o[0], o => { assert.ok(!inv.some(id => id !== held && o.includes(id)), held + ' 씨앗 ' + seed + ': ' + o); if (o.includes('workaholic')) workSeen++; });
    assert.ok(workSeen > 0, held + ' 를 가져도 일중독은 뜬다 (다른 무리)');
  }
  for (let seed = 1; seed <= 6; seed++) { const s = perkRun(seed, {}, 15, o => o.find(id => R.PERKS.find(p => p.id === id).aug && id !== 'workaholic') || o[0]); assert.ok(inv.filter(id => R.perk(s, id)).length <= 1); }
});
ok('카드에 함께 못 가지는 글: 일머리 카드에는 일중독, 일중독 카드에는 일머리 (가진 특성 목록에도)', () => {
  const s = R.create(1); s.offer = ['hustle', 'workaholic', 'iron'];
  const [h, w, i] = R.offerView(s);
  assert.equal(h.excl, pName('workaholic') + '과 함께 가질 수 없다'); assert.equal(w.excl, pName('hustle') + '와 함께 가질 수 없다'); assert.equal(i.excl, '');
  s.offer = ['coinonly']; assert.ok(R.offerView(s)[0].excl.includes(pName('stockonly')) && R.offerView(s)[0].excl.includes(pName('beast')));
  s.offer = null; s.perks.hustle = 2; const v = R.perksView(s).find(p => p.id === 'hustle'); assert.ok(v.excl.includes(pName('workaholic')));
});
ok('일머리 · 일중독을 둘 다 가진 예전 저장: 깨지지 않고 둘 다 남으며, 그 뒤로 일머리 · 일중독은 더 뜨지 않는다', () => {
  const a = R.create(5); a.tier = 2; a.hp = 100; a.perks.hustle = 1; a.perks.workaholic = 1;
  const s = R.load(R.save(a)); assert.ok(s);
  assert.equal(R.perk(s, 'hustle'), 1); assert.equal(R.perk(s, 'workaholic'), 1);
  assert.equal(R.acts(s).find(x => x.id === 'flyer').pay, Math.round(T.pay_flyer * (1 + T.perk_hustle) * (1 + T.perk_workaholic) / 1000) * 1000);
  assert.equal(R.perksView(s).length, 2);
  s.tier = 3; s.cash = 1000 * M; s.hp = 100000; s.quest = 99; let looked = 0;
  while (s.lv < 15) { s.slot = 0; s.hp = 100000; R.doJob(s, 'flyer', 0.95); while (s.offer) { looked++; assert.ok(!s.offer.includes('hustle') && !s.offer.includes('workaholic'), String(s.offer)); R.pickPerk(s, s.offer[0]); } }
  assert.ok(looked >= 10); assert.equal(R.perk(s, 'hustle'), 1); assert.equal(R.perk(s, 'workaholic'), 1);
});
console.log(n + '개 통과');
