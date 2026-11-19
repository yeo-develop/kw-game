// PROTOTYPE - NOT FOR PRODUCTION
// 게임이 불러오지 않는 개발용 도구. 화면 없는 브라우저(Playwright)는 KW_PLAYWRIGHT 환경 변수로 위치를 줄 수 있다.
// 규칙만으로 긴 판(기한 없음, DAYS 일까지)을 굴려 보는 봇 (균형 감 잡기용 · 게임 폴더 밖)
// 쓰는 법: node tools/sim.js [폴더] [판 수] [이름=값 …]   환경 변수: BOTS=biz,invest · DAYS=150 · TRACE=봇:씨앗 · START=집단계:만원 · WORK=1(일꾼 표: 일중독 · 일머리 · 손 점수 · 눌러앉기를 갈라 봄, DAYS=60 권장) · INT=1(강도 표: 손 둘 × 강도 넷, DAYS=90 권장)
//   PRESS=1(압박 표: 사는 곳마다 머문 날 · 하루 벌이 · 하루치 정산 · 그 몫 · 쉰 칸 · 밤 체력 · 사 먹기 · 연체 · 쓰러짐. BOTS 로 봇을 고른다)
const path = require('path');
const dir = require('path').resolve(process.argv[2] || require('path').join(__dirname, '..'));
global.window = {};
require(path.join(dir, 'config.js'));
const R = require(path.join(dir, 'rules.js'));
const C = window.CONFIG;
const over = {};
for (const a of process.argv.slice(4)) { const [k, v] = a.split('='); over[k] = Number(v); }
const T = new Proxy({}, { get: (_, k) => (k in over ? over[k] : (C[k] && typeof C[k] === 'object' ? C[k].value : C[k])) });
R.setTune(T);
const N = Number(process.argv[3] || 300);
const DAYS = Number(process.env.DAYS || 150);
const SHARE = Number(process.env.SHARE || 0.5); // invest · owner 가 한 번에 거는 몫 (현금 − 남길 돈의). 손잡이 실측용
const M = 10000;
const won = n => R.won(Math.round(n / 10000) * 10000);
// 강도 표(INT=1)의 손: 강도 하 · 중 · 상 · 최상마다 미니게임 점수 범위 [낮음, 높음] (고르게 뽑음). 미니게임을 재 본 숫자로 바꿔 끼운다
const HANDS = {
  // 2026-11-19 느린 시작을 넣은 뒤 다시 잰 값 (tools/mg-model.js, 숙련 0 → 3): 보통 0.89→0.79 · 0.65→0.57 · 0.45→0.37 · 0.35→0.29 / 잘하는 0.98→0.97 · 0.94→0.91 · 0.87→0.83 · 0.79→0.72
  mid: { name: '보통 사람', score: [[0.68, 1.0], [0.40, 0.82], [0.18, 0.64], [0.10, 0.54]] }, // 평균 0.84 · 0.61 · 0.41 · 0.32
  pro: { name: '잘하는 사람', score: [[0.93, 1.0], [0.84, 1.0], [0.72, 0.98], [0.56, 0.94]] }, // 평균 0.97 · 0.92 · 0.85 · 0.75
};

// ── 봇 공통 ──────────────────────────────────────────────────
// 하루: 아침에 사건 · 특성 → (칸마다) 키우기 · 집 사기 · 매매 → 칸 고르기 → 일요일이면 청구 현금 마련 → 하루 마치기
function play(seed, bot) {
  const s = R.create(seed, 'bot'); R.setDream(s, bot.dream || 'family');
  if (process.env.START) { const [t, c] = process.env.START.split(':').map(Number); s.tier = t; s.movedDay = 1; s.cash = c * M; s.quest = 9; s.stats.maxTier = t; s.lease = t >= 4 ? 'own' : t >= 2 ? 'rent' : ''; s.credit = 600; } // 중간 단계에서 바로 시작 (START=집단계:만원)
  s.bot = { labor: [], reach: {}, bizAt: {}, worth: {}, rng: seed * 2654435761 % 4294967296, log: [], rests: 0, tier0: 0 }; // rng: 봇 손의 떨림 (게임 난수와 따로)
  if (bot.want != null) for (const a of ['flyer', 'loading', 'store', 'delivery']) R.setInt(s, a, bot.want); // 강도 표: 늘 그 강도 (모자라면 acts 의 use 가 내려 줌)
  let guard = 0;
  while (!s.ended && guard++ < DAYS * 40) {
    if (s.phase === 'night') {
      s.bot.labor.push(s.last.labor); if (s.bot.labor.length > 7) s.bot.labor.shift();
      if (process.env.PRESS) { const b = s.last.billed; s.bot.log.push({ tier: s.bot.tier0, labor: s.last.labor, bill: b ? b.amt : 0, paid: b ? b.paid : true, rests: s.bot.rests, hp: s.last.hp.mid, ate: s.ate === s.day ? 1 : 0, fell: s.hosp === s.day ? 1 : 0 }); s.bot.rests = 0; }
      if (process.env.TRACE) trace(s);
      if (s.day >= DAYS) break;
      R.nextDay(s); continue;
    }
    if (s.event) { const v = R.eventView(s); R.choose(s, s.event === 'den' ? 'b' : v.a.ok && v.a.cost <= s.cash * 0.05 ? 'a' : 'b'); continue; } // 돌발 사건: 현금의 5% 안이면 첫째, 아니면 둘째. 도박장은 안 간다
    if (s.den) { R.denLeave(s); continue; }
    if (s.offer) { R.pickPerk(s, (bot.prio || PRIO).find(id => s.offer.includes(id)) || s.offer.find(id => !(bot.avoid || []).includes(id)) || s.offer[0]); continue; }
    // 셋방: 보증금이 되면 바로 올라간다 (stay: 고시원에 눌러앉기). 원룸은 전세 보증금 + 한 주 여유가 되면 전세로 (들어갈 때든, 살다가든)
    if (s.tier < 3 && !(bot.stay && s.tier === 2 && !bot.stay(s))) {
      const to = s.tier + 1, j = to === 3 ? R.moveInfo(s, 3, 'jeonse') : null, room = 2 * R.weekCost(s, to);
      if (j && j.ok && s.cash - j.pay >= room) R.move(s, 3, 'jeonse');
      else { const i = R.moveInfo(s, to); if (i.ok && (to < 2 || s.cash - i.pay >= (bot.reckless ? 0 : R.weekCost(s, to, i.lease) * 0.5))) R.move(s, to, i.lease); }
    }
    if (s.tier === 3 && R.leaseOf(s) === 'rent' && !bot.noJeonse) { const j = R.moveInfo(s, 3, 'jeonse'); if (j.ok && s.cash - j.pay >= 2 * R.weekCost(s, 3, 'jeonse')) R.move(s, 3, 'jeonse'); }
    feed(s, bot); shop(s, bot);
    if (s.tier >= 8 && R.worth(s) >= T.top_worth) { raise(s, R.worth(s)); R.declareTop(s); break; }
    grow(s, bot);
    note(s);
    if (s.slot >= 3) {
      const b = R.bill(s);
      if (b && b.inDays === 0) raise(s, b.amt + 3 * M); // 청구 현금 마련: 투자한 것을 판다
      R.endDay(s); continue;
    }
    if (bot.trade) bot.trade(s);
    const acts = R.acts(s), act = bot.pick ? bot.pick(s, acts) : bestJob(s, acts); s.bot.tier0 = s.tier; if (act.kind !== 'job') s.bot.rests++;
    if (process.env.TRACE) (s.bot.acts = s.bot.acts || []).push(act.id + '@' + Math.round(s.hp));
    if (act.kind === 'job') { const k = bot.want != null ? act.use : act.push ? 0 : undefined; R.doJob(s, act.id, typeof bot.score === 'function' ? bot.score(s, k) : bot.score || 0.75, k); const e = k != null && s.ev.find(x => x.t === 'job'); if (e) { s.bot.jobs = (s.bot.jobs || 0) + 1; s.bot.miss = (s.bot.miss || 0) + (e.grade === 'miss'); s.bot.ksum = (s.bot.ksum || 0) + k; } } else if (act.kind === 'study') { if (!R.doStudy(s, studyPick(s, act))) R.doRest(s); } else R.doRest(s);
    if (s.ev.some(e => e.t === 'sys' && /거래량/.test(e.text))) s.htSeen = s.day;
    s.ev.length = 0;
  }
  note(s);
  return s;
}
// 사 먹기: 하루 한 번. 체력이 최대에서 그 끼니만큼 비어 있고, 값이 현금의 10% 안이면 가장 든든한 것부터
function feed(s, bot) {
  if (bot.noEat || s.ate === s.day || s.phase !== 'day') return;
  const room = R.hpMax(s) - s.hp, f = R.shopView(s).foods.filter(x => x.ok && x.cost <= s.cash * 0.1 && x.hp <= room + 4).sort((a, b) => b.hp - a.hp)[0];
  if (f) R.eat(s, f.id);
}
// 가게: 열린 물건(사치품 빼고) 가운데 값이 현금의 8% 안인 것을 산다 — 옷은 사는 순간 갈아입으니 비싼 순서로 (작업 조끼 → 롱패딩 → 정장 → 금빛 운동복)
function shop(s, bot) {
  if (bot.noShop || s.phase !== 'day') return;
  for (const it of R.shopView(s).items) if (it.ok && it.cat !== 'lux' && it.cost <= s.cash * 0.08) R.buyItem(s, it.id);
  if (!bot.noShop && s.cash > 5e9) for (const it of R.shopView(s).items) if (it.ok && it.cat === 'lux' && it.cost <= s.cash * 0.05) R.buyItem(s, it.id);
}
function note(s) { // 단계별 처음 닿은 날
  for (let t = 4; t <= 9; t++) if (s.stats.maxTier >= t && !s.bot.reach[t]) s.bot.reach[t] = s.day;
  for (let b = 1; b <= 5; b++) if (s.biz >= b && !s.bot.bizAt[b]) s.bot.bizAt[b] = s.day;
  for (const w of WORTH) if (!s.bot.worth[w] && R.worth(s) >= w * M) s.bot.worth[w] = { day: s.day, tier: s.tier }; // 순자산 w 만 원에 처음 닿은 날 · 그때 사는 곳
  if (s.bot.reach[4] && !s.bot.perksAt4) { s.bot.perksAt4 = Object.assign({}, s.perks); s.bot.lvAt4 = s.lv; } // 내 집을 산 날의 특성
}
const WORTH = [500, 900, 1500];
function raise(s, amt) { // 현금이 amt 가 되도록 투자한 것을 판다 (작은 것부터가 아니라 그냥 다)
  if (s.cash >= amt) return;
  for (const a of R.ASSETS) if (s.cash < amt && a.kind === 'stock' && s.hold[a.id].units > 0) R.sell(s, a.id, 1);
  if (s.cash < amt && s.lev) R.levClose(s);
}
const sellable = s => R.invested(s);
const weekIncome = s => (s.bot.labor.length ? s.bot.labor.reduce((a, b) => a + b, 0) / s.bot.labor.length : 0) * 7; // 지난 며칠 평균 일당 × 7
const loanK = rate => (rate == null ? T.loan_rate : rate) + 1 / T.loan_weeks; // 대출 1원에 붙는 주 원리금 (이자는 신용등급을 따른다)
// 키우기: 사업이 먼저(바로 일당이 오름), 그다음 집. 조심하는 봇은 다음 청구 + 여유를 현금으로 남긴다
function grow(s, bot) {
  if (s.ended || s.phase !== 'day') return;
  const reserve = () => (R.bill(s) ? R.bill(s).amt : 0) + (bot.reckless ? 0 : weekCostNow(s));
  for (let guard = 0; guard < 6; guard++) {
    let did = false;
    const v = R.bizView(s);
    if (bot.biz && v.next && s.tier >= v.next.needTier && s.cash + sellable(s) >= v.next.cost + reserve()) { raise(s, v.next.cost + reserve()); did = R.bizUp(s) || did; }
    const to = s.tier + 1;
    if (to >= 4 && to <= 8) {
      const i = R.homeInfo(s, to);
      if (to === 4) { const r = bot.reckless ? 0 : i.fixed; if (s.cash + sellable(s) >= i.full + r) { raise(s, i.full + r); did = R.buyHome(s, 4, 0) || did; } } // 내 집: 산 뒤 첫 주 관리비만 남기면 된다
      else if (bot.reckless) { if (s.cash + sellable(s) >= i.down) { raise(s, i.down); did = R.buyHome(s, to, i.loanMax) || did; } }
      else {
        // 조심: 빌리는 돈은 되도록 적게. 산 뒤에 현금 ≥ 한 주 원리금 × 3 (+ 바로 차릴 사업 값), 그리고 벌이가 한 주 (고정비 + 원리금)의 1.5배를 넘을 때만.
        // 벌이: 사업 값까지 쥐고 사면 바로 한 단계 키운 뒤의 벌이로, 아니면 지금 벌이로 본다
        const have = s.cash + sellable(s), k = loanK(i.rate), fixed = i.fixed, w = weekIncome(s) + R.weekIncome(s).total;
        const nb = R.bizView(s).next, withBiz = bot.biz && nb && nb.needTier === to ? nb.cost + 2 * R.weekCost(s, to) : 0;
        for (const extra of withBiz ? [withBiz, 0] : [0]) {
          const L = Math.max(0, Math.ceil((i.full + extra - have) / (1 - 3 * k) / M) * M), inc = extra ? w * T.biz_mult : w;
          if (L <= i.loanMax && inc >= 1.5 * (fixed + L * k)) { raise(s, i.full - L + 3 * L * k + extra); did = R.buyHome(s, to, L) || did; break; }
        }
        // 대출로는 안 되지만 전세 보증금이 되면 전세로 (아파트 · 주택): 보증금 + 두 주 고정비를 쥐고서
        if (!did && s.tier < to && i.leases.indexOf('jeonse') >= 0) { const j = R.homeInfo(s, to, 'jeonse'); if (have >= j.full + 2 * j.fixed && w >= 1.5 * j.fixed) { raise(s, j.full + 2 * j.fixed); did = R.buyHome(s, to, 0, 'jeonse') || did; } }
      }
    }
    // 상가: 다음 집 · 사업에 댈 돈을 빼고도 남으면 (값 + 두 주치 여유) 가장 싼 것부터
    if (!did && bot.props !== false && (bot.biz || bot.props)) {
      const p = R.propView(s).rows.find(r => r.open && !r.have);
      if (p && s.cash >= p.cost + 2 * reserve() + (bot.propKeep == null ? p.cost : bot.propKeep * p.cost)) did = R.buyProp(s, p.id) || did;
    }
    if (!did) break;
  }
}
const weekCostNow = s => R.weekCost(s) + (R.loanView(s) ? R.loanView(s).weekly : 0) + R.creditView(s).week;
function trace(s) {
  const l = R.loanView(s), b = s.last.billed;
  console.log('day', s.day, R.HOMES[s.tier].name, R.BIZ[s.biz].name + (R.bizView(s).eff < s.biz ? '(반영 ' + R.bizView(s).eff + ')' : ''), 'cash', won(s.cash), 'worth', won(R.worth(s)), 'labor', won(s.last.labor), 'hp', Math.round(s.hp),
    (s.bot.acts || []).splice(0).join(' '), 'loan', l ? won(l.balance) + '/주 ' + won(l.weekly) : '-', b ? (b.paid ? '청구 ' + won(b.amt) : '못 냄' + (b.foreclosed ? ' 압류' : '')) : '', 'inv', won(R.invested(s)), (s.last.notes || []).map(n => n.text.slice(0, 24)).join('|'));
}
// 공부할 종목: 사람이 할 법하게. 오늘 한탕바이오 알림을 봤으면 그것 → 코인 포지션이 있으면 코인 → 든 주식 중 가장 큰 것 → 원룸부터는 코인 → 소식이 잦은 화끈식품
function studyPick(s, act) {
  const can = id => !act.assets || act.assets.some(a => a.id === id);
  if (s.htSeen === s.day && can('hantang')) return 'hantang';
  if (s.lev && can('coin')) return 'coin';
  const held = R.ASSETS.filter(a => a.kind === 'stock' && a.id !== 'hantang' && s.hold[a.id].units > 0).sort((a, b) => R.holdValue(s, b.id) - R.holdValue(s, a.id))[0];
  if (held) return held.id;
  return can('coin') ? 'coin' : 'buldak';
}
const PRIO = ['hustle', 'legs', 'iron', 'sleep', 'tipster', 'sense', 'vip', 'thrift', 'quester', 'early', 'hands', 'streak', 'guts', 'lazy']; // 봇이 특성을 고르는 순서
const bestJob = (s, acts) => { const j = acts.filter(a => a.kind === 'job' && a.ok).sort((a, b) => b.pay - a.pay)[0]; return j || acts.find(a => a.kind === 'rest'); };
// 공부가 알바 한 칸보다 값질 때 저녁 칸을 공부에: 굴리는 현금의 절반 × 하루 2% > 알바 일당 − 그 칸에도 들어오는 자동 수입.
// 어차피 쉬어야 하는 칸(체력이 모자람)이면 공부 (자동 수입은 같고 리포트가 남는다)
const studyWorth = (s, acts) => {
  const st = acts.find(a => a.kind === 'study' && a.ok), j = bestJob(s, acts);
  if (!st || s.slot !== 2) return null;
  if (!j || j.kind !== 'job') return s.cash > 100 * M ? st : null;
  return (s.cash + R.invested(s)) * SHARE * 0.02 > j.pay - st.auto ? st : null;
};
const bots = {
  // 일 + 사업 키우기 + 대장전자만 조금 (남는 현금의 10%). 대출은 산 뒤 한 주 (고정비 + 원리금)의 3배를 현금으로 쥐고서만
  biz: { biz: true, trade: s => { if (s.tier >= 2 && s.slot === 0 && s.hold.daejang.units === 0) { const spare = s.cash - 2 * ((R.bill(s) ? R.bill(s).amt : 0) + weekCostNow(s)); if (spare > 20 * M) R.buy(s, 'daejang', spare * 0.1); } } },
  // biz + 공부 따라 사기 (레버리지 없이 현금의 절반)
  invest: { biz: true, pick: (s, acts) => studyWorth(s, acts) || bestJob(s, acts), trade: s => newsTrade(s, true, 1, SHARE) },
  // 되는 대로: 대출 최대, 여유 없이 키우고, 원룸부터 매일 아침 코인 5배에 현금 전부
  reckless: { biz: true, reckless: true, trade: s => { if (s.tier >= 3 && s.slot === 0 && !s.lev && s.cash > 30 * M) { const n = R.todayNews(s).find(x => x.asset === 'coin'); R.levOpen(s, n ? n.dir : (R.rnd2(s) < 0.5 ? 1 : -1), s.cash, 5); } else if (s.lev && s.slot === 2) R.levClose(s); } },
  // 사업 · 투자 없음 (집은 biz 와 같은 기준으로 산다)
  albaOnly: {},
  // 그룹(사업 3단계)부터는 미니게임을 안 하고 자동 수입 + 투자만 (하루 한 번 공부, 나머지는 쉬기)
  owner: { biz: true, pick: (s, acts) => (R.bizView(s).eff >= 3 ? acts.find(a => a.kind === 'study' && a.ok) || acts.find(a => a.kind === 'rest') : studyWorth(s, acts) || bestJob(s, acts)), trade: s => newsTrade(s, true, 1, SHARE) },
  // 견주기용 (기본 표에는 안 나옴, BOTS=investDaily): invest 와 같되 고시원부터 매일 저녁 칸을 공부에
  investDaily: { biz: true, pick: (s, acts) => (s.slot === 2 && acts.find(a => a.kind === 'study' && a.ok)) || bestJob(s, acts), trade: s => newsTrade(s, true, 1, 0.5) },
};
// 일꾼 (견주기용, WORK=1 표): 사람처럼 잘하는 손(미니게임 점수 0.88~0.96, 봇 자기 난수) · 투자 안 함 · 특성은 일중독 → 일머리 먼저.
// perks: 'WH' 둘 다 노림 · 'W' 일중독만 · 'H' 일머리만 · '' 둘 다 안 고름. stay: 고시원에서 내 집 값 + 한 주 관리비를 모을 때까지 눌러앉음
const hand = (lo, hi) => s => { s.bot.rng = (s.bot.rng * 1664525 + 1013904223) % 4294967296; return lo + (hi - lo) * s.bot.rng / 4294967296; };
const INVEST_AUG = ['coinonly', 'stockonly', 'beast'];
function worker(perks, stay, score) {
  const want = ['workaholic', 'hustle'].filter(id => perks.includes(id === 'workaholic' ? 'W' : 'H'));
  const no = ['workaholic', 'hustle'].filter(id => !want.includes(id)).concat(INVEST_AUG);
  return { biz: true, score: score || hand(0.88, 0.96), prio: want.concat(PRIO.filter(id => !no.includes(id) && !want.includes(id))), avoid: no,
    stay: stay ? s => s.cash >= T.price_home + T.week_home + T.gosiwon_week : null };
}
// 강도 (견주기용, INT=1 표): biz 봇과 같되 늘 강도 k 를 고르고(체력이 모자라면 할 수 있는 가장 높은 강도), 손은 HANDS. 알바는 그 강도의 일당이 가장 큰 것
for (const h in HANDS) for (let k = 0; k < 4; k++) bots['int_' + h + k] = { biz: true, want: k, trade: bots.biz.trade, score: (s, n) => hand(...HANDS[h].score[n])(s),
  pick: (s, acts) => acts.filter(a => a.kind === 'job' && a.any).sort((a, b) => b.levels[b.use].pay - a.levels[a.use].pay)[0] || acts.find(a => a.kind === 'rest') }; // 체력이 되는 것만 (무리하지 않는다)
bots.mid1 = bots.int_mid1; bots.pro1 = bots.int_pro1;
// 쉬지 않는 사람 (견주기용): 체력이 모자라도 가장 많이 주는 알바를 무리해서 한다 — 쓰러짐이 값을 치르게 하는지 본다
bots.greedy = { biz: true, trade: bots.biz.trade, pick: (s, acts) => acts.filter(a => a.kind === 'job' && (a.ok || a.push)).sort((a, b) => b.pay - a.pay)[0] || acts.find(a => a.kind === 'rest') };
for (const p of ['WH', 'W', 'H', '']) for (const st of [0, 1]) { bots['work' + p + (st ? 'Stay' : '')] = worker(p, st); bots['mid' + p + (st ? 'Stay' : '')] = worker(p, st, 0.75); }
function newsTrade(s, useReport, lev = 3, share = 0) {
  if (!R.unlocked(s, 'stock') || s.tier < 2) return;
  const keep = (R.bill(s) ? R.bill(s).amt : 0) + weekCostNow(s) + 10 * M;
  if (s.slot === 0) { // 아침: 어제 들고 온 것 정리 후 오늘 소식에 맞춰 다시 잡음
    const news = R.todayNews(s);
    const sig = n => (useReport && n.report ? n.report * 2 : n.src === 'official' ? n.dir * 1.5 : n.src === 'article' ? n.dir : 0);
    const b = news.find(n => n.asset === 'buldak'), c = news.find(n => n.asset === 'coin');
    const bs = b ? sig(b) : 0, cs = c ? sig(c) : 0;
    if (s.hold.buldak.units > 0 && bs <= 0) R.sell(s, 'buldak', 1);
    if (s.lev) R.levClose(s);
    const d = news.find(n => n.asset === 'daejang'), ds = d ? sig(d) : 0;
    if (s.hold.daejang.units > 0 && (ds < 0 || bs > 0 || (s.tier >= 3 && cs !== 0))) R.sell(s, 'daejang', 1);
    if (s.tier >= 3 && cs !== 0 && s.cash > keep + 30 * M) { R.levOpen(s, cs > 0 ? 1 : -1, (s.cash - keep) * (share || (Math.abs(cs) >= 1.5 ? 0.6 : 0.4)), lev); }
    if (bs > 0 && s.cash > keep + 10 * M) R.buy(s, 'buldak', (s.cash - keep) * (share || 1));
    else if (ds >= 0 && s.cash > keep + 30 * M && s.hold.buldak.units === 0) R.buy(s, 'daejang', (s.cash - keep) * (share || 0.8));
  }
}
if (process.env.TRACE) { const [b, sd] = process.env.TRACE.split(':'); const s = play(Number(sd), bots[b]); console.log(JSON.stringify(s.ended), 'reach', JSON.stringify(s.bot.reach), 'biz', JSON.stringify(s.bot.bizAt), '압류', s.stats.foreclosed, '청산', s.stats.liq); process.exit(0); } // TRACE=봇:씨앗 → 그 한 판을 날마다 찍음

// ── 일꾼 표 (WORK=1): 순자산 500 · 900 · 1,500만에 닿은 날 · 내 집 산 날 · 그때 특성 ────────
if (process.env.WORK) {
  const q = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(arr.length * p))], f = d => (d === Infinity ? '>' + DAYS : String(d));
  const band = a => { a = a.slice().sort((x, y) => x - y); return f(q(a, 0.1)) + '/' + f(q(a, 0.5)) + '/' + f(q(a, 0.9)) + ' (' + (a.reduce((x, y) => x + Math.min(y, DAYS + 1), 0) / a.length).toFixed(1) + ')'; }; // 괄호: 평균 (못 닿은 판은 DAYS+1)
  const list = (process.env.BOTS || 'workWH,workW,workH,work,workWHStay,workWStay,workHStay,workStay,midWH,midW,midH,mid,midWHStay,midStay').split(',');
  console.log('일꾼 표 (씨앗 ' + N + '개 · ' + DAYS + '일까지) — 날짜는 p10/중앙/p90');
  console.log('봇'.padEnd(12) + '순자산500'.padEnd(19) + '900'.padEnd(19) + '1500'.padEnd(19) + '내 집'.padEnd(19) + '900 때 고시원 이하 · 내 집 때 일중독 % · 일머리 평균 · 둘 다 % · 내 집 때 레벨 중앙');
  for (const name of list) {
    const runs = [];
    for (let i = 1; i <= N; i++) runs.push(play(i * 7 + 1, bots[name]));
    const wd = w => runs.map(s => (s.bot.worth[w] ? s.bot.worth[w].day : Infinity)), p4 = runs.map(s => s.bot.perksAt4 || s.perks);
    const pct = fn => Math.round(runs.filter(fn).length / N * 100) + '%';
    console.log(name.padEnd(12) + WORTH.map(w => band(wd(w)).padEnd(19)).join('') + band(runs.map(s => s.bot.reach[4] || Infinity)).padEnd(19) +
      pct(s => s.bot.worth[900] && s.bot.worth[900].tier <= 2) + ' · ' + Math.round(p4.filter(p => p.workaholic).length / N * 100) + '% · ' + (p4.reduce((a, p) => a + (p.hustle || 0), 0) / N).toFixed(2) + ' · ' +
      Math.round(p4.filter(p => p.workaholic && p.hustle).length / N * 100) + '% · ' + q(runs.map(s => s.bot.lvAt4 || s.lv).sort((a, b) => a - b), 0.5));
  }
  process.exit(0);
}

// ── 강도 표 (INT=1): 손 둘 × 강도 넷. 내 집 · 아파트 · 엔딩에 닿은 날 · 실수 비율 · 실제로 한 강도 평균 ────────
if (process.env.INT) {
  const q = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(arr.length * p))], f = d => (d === Infinity ? '>' + DAYS : String(d));
  const band = a => { a = a.slice().sort((x, y) => x - y); return f(q(a, 0.1)) + '/' + f(q(a, 0.5)) + '/' + f(q(a, 0.9)) + ' ' + Math.round(a.filter(x => x < Infinity).length / a.length * 100) + '%'; };
  console.log('강도 표 (씨앗 ' + N + '개 · ' + DAYS + '일까지 · biz 봇 + 고른 강도) — 날짜는 p10/중앙/p90 · 닿은 판 %');
  console.log('손 · 강도'.padEnd(14) + '내 집'.padEnd(19) + '아파트'.padEnd(19) + '엔딩'.padEnd(19) + '실수 % · 한 강도 평균 · 알바/판 · 끝 순자산 중앙');
  for (const h in HANDS) for (let k = 0; k < 4; k++) {
    const runs = []; for (let i = 1; i <= N; i++) runs.push(play(i * 7 + 1, bots['int_' + h + k]));
    const jobs = runs.reduce((a, s) => a + (s.bot.jobs || 0), 0), at = t => runs.map(s => s.bot.reach[t] || Infinity);
    console.log((HANDS[h].name + ' · ' + R.INT[k]).padEnd(14) + [4, 5, 9].map(t => band(at(t)).padEnd(19)).join('') + (runs.reduce((a, s) => a + (s.bot.miss || 0), 0) / jobs * 100).toFixed(1) + '% · ' +
      (runs.reduce((a, s) => a + (s.bot.ksum || 0), 0) / jobs).toFixed(2) + ' · ' + (jobs / N).toFixed(0) + ' · ' + won(q(runs.map(s => R.worth(s)).sort((a, b) => a - b), 0.5)));
  }
  process.exit(0);
}

// ── 압박 표 (PRESS=1): 사는 곳마다 고정비가 벌이의 몇 %인지, 체력이 얼마나 모자란지 ────────
if (process.env.PRESS) {
  for (const name of (process.env.BOTS || 'biz,mid1,greedy').split(',')) {
    const runs = []; for (let i = 1; i <= N; i++) runs.push(play(i * 7 + 1, bots[name]));
    console.log('압박 표 · ' + name + ' (씨앗 ' + N + '개 · ' + DAYS + '일까지)');
    console.log('사는 곳'.padEnd(8) + '머문 날(판당)  하루 벌이     하루치 정산    정산/벌이  쉰 칸/일  밤 체력  사 먹기/일  연체/판  쓰러짐/판');
    for (let t = 0; t <= 8; t++) {
      const rows = [].concat(...runs.map(s => s.bot.log.filter(d => d.tier === t))); if (!rows.length) continue;
      const m = k => rows.reduce((a, d) => a + d[k], 0) / rows.length, labor = m('labor'), bill = rows.reduce((a, d) => a + d.bill, 0) / rows.length;
      console.log(R.HOMES[t].name.padEnd(8) + (rows.length / N).toFixed(1).padStart(8) + won(labor).padStart(16) + won(bill).padStart(16) + (labor ? Math.round(bill / labor * 100) + '%' : '-').padStart(9) + m('rests').toFixed(2).padStart(10) + m('hp').toFixed(0).padStart(9) + m('ate').toFixed(2).padStart(10) +
        (rows.filter(d => !d.paid).length / N).toFixed(2).padStart(10) + (rows.reduce((a, d) => a + d.fell, 0) / N).toFixed(2).padStart(10));
    }
  }
  process.exit(0);
}


// ── 긴 판 표: 단계별 처음 닿은 날 (못 닿은 판은 ">DAYS" 로 셈) ────────
const names = (process.env.BOTS || 'biz,invest,reckless,albaOnly,owner').split(',');
const q = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(arr.length * p))];
const fmt = d => (d === Infinity ? '>' + DAYS : String(d));
const STAGES = [[4, '내 집'], [5, '아파트'], [6, '주택'], [7, '별장'], [8, '호텔'], [9, '엔딩']];
const out = {};
const t0 = Date.now();
for (const name of names) {
  const runs = [];
  for (let i = 1; i <= N; i++) runs.push(play(i * 7 + 1, bots[name]));
  const row = { fore: runs.filter(s => s.stats.foreclosed > 0).length / N, foreN: runs.reduce((a, s) => a + s.stats.foreclosed, 0) / N, liq: runs.reduce((a, s) => a + s.stats.liq, 0) / N, st: {} };
  const avg = fn => runs.reduce((a, s) => a + fn(s), 0) / N;
  row.more = { grade: avg(s => R.creditGrade(s)), props: avg(s => Object.keys(s.props).length), fell: avg(s => s.stats.collapsed || 0), evict: avg(s => s.stats.evicted || 0), jeonse: avg(s => (s.stats.jeonse ? 1 : 0)), meals: avg(s => s.stats.meals || 0), rent: avg(s => s.stats.rent || 0), cl: avg(s => s.stats.borrowed || 0), late: avg(s => s.stats.missedTotal || 0) };
  for (const [t] of STAGES) { const d = runs.map(s => s.bot.reach[t] || Infinity).sort((a, b) => a - b); row.st[t] = { p10: q(d, 0.1), p50: q(d, 0.5), p90: q(d, 0.9), pct: d.filter(x => x < Infinity).length / N }; }
  row.maxTier = runs.reduce((a, s) => a + Math.min(s.stats.maxTier, 9), 0) / N;
  row.worth = runs.map(s => R.worth(s)).sort((a, b) => a - b);
  row.biz = runs.reduce((a, s) => a + s.biz, 0) / N;
  row.trade = runs.reduce((a, s) => a + s.stats.trade, 0) / N; row.study = runs.reduce((a, s) => a + s.studied, 0) / N;
  out[name] = row;
}
console.log('긴 판 표 (씨앗 ' + N + '개 · ' + DAYS + '일까지) — 단계마다 처음 닿은 날 p10 / 중앙 / p90, 닿은 판 %');
console.log('봇'.padEnd(12) + STAGES.map(([, n]) => n.padEnd(19)).join('') + '압류 겪은 판 · 판당 압류 · 청산/판 · 최고 단계 평균 · 사업 평균 · 끝 순자산 중앙 · 투자 손익/판 · 공부/판');
for (const name of names) {
  const r = out[name];
  console.log(name.padEnd(12) + STAGES.map(([t]) => { const x = r.st[t]; return (fmt(x.p10) + '/' + fmt(x.p50) + '/' + fmt(x.p90) + ' ' + Math.round(x.pct * 100) + '%').padEnd(20); }).join('') +
    Math.round(r.fore * 100) + '% · ' + r.foreN.toFixed(2) + ' · ' + r.liq.toFixed(2) + ' · ' + r.maxTier.toFixed(2) + ' · ' + r.biz.toFixed(2) + ' · ' + won(q(r.worth, 0.5)) + ' · ' + won(r.trade) + ' · ' + r.study.toFixed(1));
}
console.log('봇'.padEnd(12) + '끝 신용등급 · 상가 수 · 쓰러짐/판 · 쫓겨남/판 · 전세 쓴 판 · 사 먹기/판 · 임대수익/판 · 마이너스 통장으로 빌린 돈/판 · 연체/판');
for (const name of names) { const m = out[name].more; console.log(name.padEnd(12) + m.grade.toFixed(1) + ' · ' + m.props.toFixed(1) + ' · ' + m.fell.toFixed(2) + ' · ' + m.evict.toFixed(2) + ' · ' + Math.round(m.jeonse * 100) + '% · ' + m.meals.toFixed(0) + ' · ' + won(m.rent) + ' · ' + won(m.cl) + ' · ' + m.late.toFixed(2)); }
console.log('(' + ((Date.now() - t0) / 1000).toFixed(1) + '초)');
module.exports = { out };
