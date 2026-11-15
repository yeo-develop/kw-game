// PROTOTYPE - NOT FOR PRODUCTION
// 게임이 불러오지 않는 개발용 도구. 화면 없는 브라우저(Playwright)는 KW_PLAYWRIGHT 환경 변수로 위치를 줄 수 있다.
// 규칙만으로 긴 판(기한 없음, DAYS 일까지)을 굴려 보는 봇 (균형 감 잡기용 · 게임 폴더 밖)
// 쓰는 법: node tools/sim.js [폴더] [판 수] [이름=값 …]   환경 변수: BOTS=biz,invest · DAYS=150 · TRACE=봇:씨앗 · START=집단계:만원 · WORK=1(일꾼 표: 일중독 · 일머리 · 손 점수 · 눌러앉기를 갈라 봄, DAYS=60 권장)
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

// ── 봇 공통 ──────────────────────────────────────────────────
// 하루: 아침에 사건 · 특성 → (칸마다) 키우기 · 집 사기 · 매매 → 칸 고르기 → 일요일이면 청구 현금 마련 → 하루 마치기
function play(seed, bot) {
  const s = R.create(seed, 'bot');
  if (process.env.START) { const [t, c] = process.env.START.split(':').map(Number); s.tier = t; s.movedDay = 1; s.cash = c * M; s.quest = 9; s.stats.maxTier = t; } // 중간 단계에서 바로 시작 (START=집단계:만원)
  s.bot = { labor: [], reach: {}, bizAt: {}, worth: {}, rng: seed * 2654435761 % 4294967296 }; // rng: 봇 손의 떨림 (게임 난수와 따로)
  let guard = 0;
  while (!s.ended && guard++ < DAYS * 40) {
    if (s.phase === 'night') {
      s.bot.labor.push(s.last.labor); if (s.bot.labor.length > 7) s.bot.labor.shift();
      if (process.env.TRACE) trace(s);
      if (s.day >= DAYS) break;
      R.nextDay(s); continue;
    }
    if (s.event) { const v = R.eventView(s); R.choose(s, s.event === 'den' ? 'b' : v.a.ok && v.a.cost <= s.cash * 0.05 ? 'a' : 'b'); continue; } // 돌발 사건: 현금의 5% 안이면 첫째, 아니면 둘째. 도박장은 안 간다
    if (s.den) { R.denLeave(s); continue; }
    if (s.offer) { R.pickPerk(s, (bot.prio || PRIO).find(id => s.offer.includes(id)) || s.offer.find(id => !(bot.avoid || []).includes(id)) || s.offer[0]); continue; }
    if (s.tier < 3 && !(bot.stay && s.tier === 2 && !bot.stay(s)) && R.moveInfo(s, s.tier + 1).ok) R.move(s, s.tier + 1); // 빌려 사는 곳은 기준이 되면 바로 (stay: 고시원에 눌러앉기)
    if (s.tier >= 8 && R.worth(s) >= T.top_worth) { raise(s, R.worth(s)); R.declareTop(s); break; }
    grow(s, bot);
    note(s);
    if (s.slot >= 3) {
      const b = R.bill(s);
      if (b && b.inDays === 0) raise(s, b.amt + 3 * M); // 청구 현금 마련: 투자한 것을 판다
      R.endDay(s); continue;
    }
    if (bot.trade) bot.trade(s);
    const acts = R.acts(s), act = bot.pick ? bot.pick(s, acts) : bestJob(s, acts);
    if (process.env.TRACE) (s.bot.acts = s.bot.acts || []).push(act.id + '@' + Math.round(s.hp));
    if (act.kind === 'job') R.doJob(s, act.id, typeof bot.score === 'function' ? bot.score(s) : bot.score || 0.75); else if (act.kind === 'study') { if (!R.doStudy(s, studyPick(s, act))) R.doRest(s); } else R.doRest(s);
    if (s.ev.some(e => e.t === 'sys' && /거래량/.test(e.text))) s.htSeen = s.day;
    s.ev.length = 0;
  }
  note(s);
  return s;
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
const loanK = () => T.loan_rate + 1 / T.loan_weeks; // 대출 1원에 붙는 주 원리금
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
        const have = s.cash + sellable(s), k = loanK(), fixed = i.fixed, w = weekIncome(s);
        const nb = R.bizView(s).next, withBiz = bot.biz && nb && nb.needTier === to ? nb.cost + 2 * R.weekCost(s, to) : 0;
        for (const extra of withBiz ? [withBiz, 0] : [0]) {
          const L = Math.max(0, Math.ceil((i.full + extra - have) / (1 - 3 * k) / M) * M), inc = extra ? w * T.biz_mult : w;
          if (L <= i.loanMax && inc >= 1.5 * (fixed + L * k)) { raise(s, i.full - L + 3 * L * k + extra); did = R.buyHome(s, to, L) || did; break; }
        }
      }
    }
    if (!did) break;
  }
}
const weekCostNow = s => R.weekCost(s) + (R.loanView(s) ? R.loanView(s).weekly : 0);
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
for (const p of ['WH', 'W', 'H', '']) for (const st of [0, 1]) { bots['work' + p + (st ? 'Stay' : '')] = worker(p, st); bots['mid' + p + (st ? 'Stay' : '')] = worker(p, st, 0.75); }
function newsTrade(s, useReport, lev = 3, share = 0) {
  if (s.tier < 2) return;
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
console.log('(' + ((Date.now() - t0) / 1000).toFixed(1) + '초)');
module.exports = { out };
